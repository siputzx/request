<div align="center">

# @sptzx/request

**A zero-dependency HTTP client for server-side runtimes — built on top of the native Fetch API.**

[![npm version](https://img.shields.io/npm/v/%40sptzx%2Frequest.svg?style=flat-square)](https://www.npmjs.com/package/@sptzx/request)
[![license](https://img.shields.io/badge/license-MIT%20%2F%20BSD--3--Clause-blue.svg?style=flat-square)](#license)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg?style=flat-square)](package.json)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-success.svg?style=flat-square)](https://nodejs.org)
[![Bun](https://img.shields.io/badge/bun-supported-f472b6.svg?style=flat-square)](https://bun.sh)
[![Deno](https://img.shields.io/badge/deno-supported-000000.svg?style=flat-square)](https://deno.land)

</div>

---

`@sptzx/request` is a production-grade HTTP client that wraps the native `fetch` API with everything server-side code actually needs: smart retries, automatic cookie persistence, circuit breaking, NDJSON streaming, proxy support, and lifecycle hooks — all with **zero external dependencies**.

It is built for **Node.js ≥ 18**, **Bun**, and **Deno**, and ships as fully typed TypeScript source alongside a compiled `dist/`.

---

## Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Usage](#-usage)
  - [Basic Requests](#basic-requests)
  - [Cookie Jar (Session Management)](#cookie-jar-session-management)
  - [Retry & Circuit Breaker](#retry--circuit-breaker)
  - [Smart Redirects](#smart-redirects)
  - [NDJSON Streaming](#ndjson-streaming)
  - [Instance Configuration](#instance-configuration)
  - [Upload & Download Progress](#upload--download-progress)
  - [Error Handling](#error-handling)
- [API Reference](#-api-reference)
- [Credits](#-credits)
- [License](#-license)

---

## ✨ Features

| Feature | Description |
|---|---|
| **Zero Dependencies** | No `node_modules` at runtime. Ever. |
| **Smart Retry** | Exponential backoff, per-status retry rules, `Retry-After` header support, and jitter |
| **Cookie Jar** | RFC 6265-compliant automatic cookie management across requests and redirects |
| **Circuit Breaker** | CLOSED → OPEN → HALF_OPEN state machine to protect upstream services |
| **Smart Redirects** | Native redirect for speed; manual redirect when a CookieJar is active for correctness |
| **NDJSON Streaming** | First-class `AsyncGenerator` for newline-delimited JSON (LLMs, event streams) |
| **Lifecycle Hooks** | `beforeRequest`, `beforeRetry`, `afterResponse`, `beforeError` |
| **Progress Callbacks** | Streaming upload and download progress |
| **Proxy Support** | `proxyUrl` shorthand or raw Undici `dispatcher` |
| **OOM Protection** | Error body reads capped at 10 MB, racing against active timeout |
| **Full TypeScript** | 100% typed — every option, hook, error, and return value |

---

## 📦 Installation

```bash
# npm
npm install @sptzx/request

# yarn
yarn add @sptzx/request

# pnpm
pnpm add @sptzx/request

# bun
bun add @sptzx/request
```

> **Runtime requirements:** Node.js ≥ 18.0.0, Bun (any version), or Deno (any version).

---

## ⚡ Quick Start

```typescript
import request from '@sptzx/request';

// GET and parse JSON
const users = await request.get('https://api.example.com/users').json();

// POST with JSON body
const created = await request.post('https://api.example.com/users', {
  json: { name: 'Alice', role: 'admin' },
}).json();

// Automatic retry on failure (default: 2 retries)
const data = await request.get('https://api.example.com/data', {
  retry: 3,
  timeout: 5_000,
}).json();
```

---

## 🚀 Usage

### Basic Requests

```typescript
import request from '@sptzx/request';

// GET
const data = await request.get('https://api.example.com/users').json<User[]>();

// GET with query parameters
const results = await request.get('https://api.example.com/search', {
  searchParams: { q: 'nodejs', page: '1', limit: '20' },
}).json();

// POST — JSON body
const user = await request.post('https://api.example.com/users', {
  json: { name: 'Alice', role: 'admin' },
}).json<User>();

// PUT / PATCH / DELETE
await request.put('https://api.example.com/users/1', { json: { name: 'Bob' } });
await request.patch('https://api.example.com/users/1', { json: { role: 'viewer' } });
await request.delete('https://api.example.com/users/1');

// Access the raw Response
const response = await request.get('https://api.example.com/health');
console.log(response.status);                          // 200
console.log(response.headers.get('x-request-id'));

// Other body types
const text   = await request.get('https://api.example.com/report').text();
const buffer = await request.get('https://files.example.com/file.bin').arrayBuffer();
const blob   = await request.get('https://files.example.com/image.png').blob();
```

---

### Cookie Jar (Session Management)

`@sptzx/request` includes a built-in RFC 6265-compliant `CookieJar`. When attached to an instance, it automatically stores `Set-Cookie` response headers and injects the correct `Cookie` header on all subsequent requests — including across redirects and retries.

```typescript
import request, { CookieJar } from '@sptzx/request';

const jar = new CookieJar();
const session = request.extend({ cookieJar: jar });

// Login — the response's Set-Cookie is stored automatically
await session.post('https://api.example.com/auth/login', {
  json: { username: 'alice', password: 's3cr3t' },
});

// All subsequent requests send the stored cookie automatically
const profile = await session.get('https://api.example.com/me').json();
const orders  = await session.get('https://api.example.com/orders').json();

// Logout — jar is cleared when the session cookie expires
await session.post('https://api.example.com/auth/logout');
```

---

### Retry & Circuit Breaker

```typescript
import request, { CircuitBreaker } from '@sptzx/request';

const breaker = new CircuitBreaker({
  threshold:        5,      // Open after 5 consecutive failures
  halfOpenAfterMs:  15_000, // Try again after 15 seconds
  successThreshold: 2,      // Close again after 2 successful probes
  onStateChange: (from, to) => console.log(`Circuit: ${from} → ${to}`),
});

const api = request.extend({
  prefixUrl:      'https://api.example.com',
  timeout:        8_000,
  circuitBreaker: breaker,
  retry: {
    limit:            3,
    methods:          ['get', 'post', 'put'],
    statusCodes:      [408, 429, 502, 503, 504],
    afterStatusCodes: [429],          // Respect Retry-After header on 429
    backoffLimit:     30_000,         // Cap individual delay at 30 s
    jitter:           true,           // Randomise delay to avoid thundering-herd
    delay: (attempt) => 300 * 2 ** (attempt - 1), // 300ms, 600ms, 1200ms...
  },
  hooks: {
    beforeRequest: [
      ({ request }) => {
        request.headers.set('Authorization', `Bearer ${process.env.API_TOKEN}`);
      },
    ],
    beforeRetry: [
      ({ error, retryCount }) => {
        console.warn(`[retry #${retryCount}] ${error.message}`);
      },
    ],
  },
});

const data = await api.get('users').json();
```

---

### Smart Redirects

`@sptzx/request` automatically selects the right redirect strategy based on your configuration:

- **Native redirect** (default) — when no `cookieJar` is active, redirects are delegated entirely to the runtime's native `fetch`. Zero overhead.
- **Manual redirect** (with `cookieJar`) — when a `cookieJar` is active, every redirect hop is intercepted in userland. This is required because native `fetch` silently drops `Set-Cookie` headers on intermediate hops, which would corrupt session state.

During manual redirect, `@sptzx/request`:
1. Persists `Set-Cookie` from each intermediate response to the jar.
2. Injects the correct `Cookie` header for the next hop URL.
3. Rewrites `POST` → `GET` on `303 See Other` (per RFC 7231).
4. Preserves the method on `307 Temporary Redirect` and `308 Permanent Redirect`.
5. Throws if the number of hops exceeds `maxRedirects` (default: `10`).

```typescript
import request, { CookieJar } from '@sptzx/request';

const jar     = new CookieJar();
const session = request.extend({ cookieJar: jar });

// Cookies from 302 intermediate hops are captured automatically
await session.get('https://api.example.com/login');

// Limit redirect depth
await session.get('https://api.example.com/page', { maxRedirects: 5 });
```

---

### NDJSON Streaming

Ideal for consuming LLM token streams, server-sent database diffs, or any newline-delimited JSON endpoint.

```typescript
import request from '@sptzx/request';

const stream = request.post('https://api.example.com/llm/completions', {
  json: { model: 'gpt-4', prompt: 'Hello', stream: true },
  timeout: false, // Disable timeout for long-running streams
});

for await (const chunk of stream.ndjson<{ token: string; done: boolean }>()) {
  process.stdout.write(chunk.token);
  if (chunk.done) break;
}
```

---

### Instance Configuration

Use `extend()` to create pre-configured instances with shared defaults. Instances inherit and deep-merge from their parent — ideal for building service-specific clients once and reusing them everywhere.

```typescript
import request from '@sptzx/request';

// Base HTTP client
const http = request.extend({
  timeout: 10_000,
  retry:   { limit: 2 },
  headers: { 'User-Agent': 'MyApp/2.0' },
});

// GitHub API client (extends http)
const github = http.extend((parent) => ({
  ...parent,
  prefixUrl: 'https://api.github.com/',
  headers: {
    ...parent.headers,
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
  },
}));

// Stripe API client (extends http)
const stripe = http.extend({
  prefixUrl: 'https://api.stripe.com/v1/',
  headers: {
    Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
  },
});

const repos   = await github.get('user/repos').json();
const charges = await stripe.get('charges').json();
```

---

### Upload & Download Progress

```typescript
import request from '@sptzx/request';

// Download with progress
const response = await request.get('https://files.example.com/dataset.zip', {
  onDownloadProgress: ({ percent, transferredBytes, totalBytes }) => {
    process.stdout.write(`\rDownloading: ${Math.round(percent * 100)}%`);
  },
});
const buffer = await response.arrayBuffer();

// Upload with progress
await request.post('https://api.example.com/upload', {
  body: fileStream,
  onUploadProgress: ({ percent, transferredBytes }) => {
    process.stdout.write(`\rUploading: ${Math.round(percent * 100)}%`);
  },
});
```

---

### Error Handling

```typescript
import request, {
  HTTPError,
  TimeoutError,
  CircuitBreakerOpenError,
  isRequestError,
} from '@sptzx/request';

try {
  const data = await request.get('https://api.example.com/resource').json();
} catch (error) {
  if (error instanceof HTTPError) {
    // error.response — the raw Response object
    // error.data     — parsed response body (JSON or text)
    console.error(`HTTP ${error.response.status}:`, error.data);

  } else if (error instanceof TimeoutError) {
    console.error('Request timed out after', error.request.url);

  } else if (error instanceof CircuitBreakerOpenError) {
    console.error('Circuit breaker is OPEN — request skipped');

  } else if (isRequestError(error)) {
    // Catches any @sptzx/request error (umbrella guard)
    console.error('Request error:', error.message);

  } else {
    throw error; // Re-throw unrecognised errors
  }
}
```

To disable automatic error throwing and handle responses manually:

```typescript
const response = await request.get('https://api.example.com/resource', {
  throwHttpErrors: false,
});

if (!response.ok) {
  const body = await response.json();
  console.error(`Error ${response.status}:`, body);
}
```

---

## 🗂️ API Reference

### HTTP Methods

```typescript
request(url, options?)          // Generic request
request.get(url, options?)
request.post(url, options?)
request.put(url, options?)
request.patch(url, options?)
request.delete(url, options?)
request.head(url, options?)
```

All methods return a `ResponsePromise` — a native `Promise<Response>` extended with body helpers:

| Method | Returns |
|---|---|
| `.json<T>()` | `Promise<T>` |
| `.text()` | `Promise<string>` |
| `.blob()` | `Promise<Blob>` |
| `.arrayBuffer()` | `Promise<ArrayBuffer>` |
| `.formData()` | `Promise<FormData>` |
| `.bytes()` | `Promise<Uint8Array>` |
| `.ndjson<T>()` | `AsyncGenerator<T>` |

### Instance Methods

| Method | Description |
|---|---|
| `request.extend(defaults \| fn)` | Create a new instance that inherits and merges from the current instance |
| `request.create(defaults)` | Create a new instance with only the given defaults (no inheritance) |

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `prefixUrl` | `string \| URL` | `''` | Base URL prepended to every request path |
| `method` | `string` | `'GET'` | HTTP method |
| `headers` | `HeadersInit` | `{}` | Request headers |
| `json` | `unknown` | — | JSON body — auto-sets `Content-Type: application/json` |
| `searchParams` | `string \| Record \| URLSearchParams` | — | Query string parameters |
| `timeout` | `number \| false` | `10000` | Wall-clock timeout (ms) for the entire operation including retries |
| `retry` | `RetryOptions \| number` | `2` | Retry limit or full retry configuration |
| `cookieJar` | `CookieJar` | — | Enables automatic RFC 6265 cookie management |
| `circuitBreaker` | `CircuitBreaker` | — | Circuit breaker instance |
| `throwHttpErrors` | `boolean \| (status) => boolean` | `true` | Throw `HTTPError` on non-2xx responses |
| `redirect` | `'follow' \| 'manual' \| 'error'` | `'follow'` | Redirect mode — overridden to `'manual'` automatically when `cookieJar` is active |
| `maxRedirects` | `number` | `10` | Maximum redirect hops (applies when `cookieJar` is active) |
| `proxyUrl` | `string` | — | HTTP/HTTPS proxy URL |
| `dispatcher` | `Dispatcher` | — | Raw Undici dispatcher (Pool, ProxyAgent, etc.) |
| `hooks` | `Hooks` | `{}` | Lifecycle hooks object |
| `onDownloadProgress` | `(progress, chunk) => void` | — | Called during response body streaming |
| `onUploadProgress` | `(progress, chunk) => void` | — | Called during request body streaming |
| `parseJson` | `(text) => unknown` | `JSON.parse` | Custom JSON deserializer |
| `stringifyJson` | `(value) => string` | `JSON.stringify` | Custom JSON serializer |
| `context` | `Record<string, unknown>` | `{}` | Arbitrary metadata passed through to all hooks |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation |

### Retry Options

| Option | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `2` | Maximum number of retry attempts |
| `methods` | `string[]` | `['get','put','head','delete']` | Methods eligible for retry |
| `statusCodes` | `number[]` | `[408,413,429,500,502,503,504,521,522,524]` | Status codes that trigger a retry |
| `afterStatusCodes` | `number[]` | `[413,429,503]` | Status codes that trigger `Retry-After` header parsing |
| `maxRetryAfter` | `number` | `undefined` | Maximum ms to wait when honouring `Retry-After` |
| `backoffLimit` | `number` | `Infinity` | Maximum ms for any single retry delay |
| `delay` | `(attempt) => number` | Exponential | Custom delay function |
| `jitter` | `boolean \| (delay) => number` | `false` | Randomise delay to reduce thundering-herd |
| `retryOnTimeout` | `boolean` | `false` | Retry on `TimeoutError` |

### Error Classes

| Class | Description |
|---|---|
| `HTTPError` | Thrown on non-2xx responses. Has `.response`, `.request`, `.options`, `.data` |
| `TimeoutError` | Thrown when the wall-clock timeout expires |
| `ForceRetryError` | Thrown inside hooks to force an immediate retry |
| `CircuitBreakerOpenError` | Thrown when the circuit breaker is in OPEN state |

### Type Guards

```typescript
import {
  isRequestError,           // HTTPError | TimeoutError | ForceRetryError | CircuitBreakerOpenError
  isHTTPError,              // HTTPError
  isTimeoutError,           // TimeoutError
  isForceRetryError,        // ForceRetryError
  isCircuitBreakerOpenError // CircuitBreakerOpenError
} from '@sptzx/request';
```

---

## 🙏 Credits

`@sptzx/request` was built by consolidating and extending the work of these open-source projects:

- **[sindresorhus/ky](https://github.com/sindresorhus/ky)** _(MIT © Sindre Sorhus)_ — The architecture, retry logic, hook system, and `ResponsePromise` pattern that form the structural foundation of this library.
- **[salesforce/tough-cookie](https://github.com/salesforce/tough-cookie)** _(BSD-3-Clause © Salesforce)_ — The RFC 6265 cookie algorithms powering domain matching, path matching, and attribute parsing.
- **[nfriedly/set-cookie-parser](https://github.com/nfriedly/set-cookie-parser)** _(MIT © Nathaniel Friedman)_ — The `Set-Cookie` header splitting and parsing logic used in `cookie/parser.ts`.

---

## 📜 License

**MIT** — `@sptzx/request` core and Ky-derived portions.
**BSD-3-Clause** — tough-cookie-derived portions.

See [LICENSE](./LICENSE) for the full license texts.
