/**
 * fetch-support test harness
 * Zero-dependency test runner — Node.js ESM, no external packages needed.
 *
 * Usage:
 *   node test/_harness.js                  # runs all suites
 *   node test/01-basic-requests.test.js    # run single suite
 */

import { createServer } from "node:http";
import { EventEmitter } from "node:events";

// ─── Assertion helpers ────────────────────────────────────────────────────────

export function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

export function assertEqual(actual, expected, message = "") {
  if (actual !== expected)
    throw new Error(
      `${message ? message + " — " : ""}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
}

export function assertIncludes(haystack, needle, message = "") {
  if (!haystack.includes(needle))
    throw new Error(`${message ? message + " — " : ""}Expected "${haystack}" to include "${needle}"`);
}

export function assertThrows(fn, expectedName, message = "") {
  let threw = false;
  try { fn(); } catch (e) {
    threw = true;
    if (expectedName && e?.name !== expectedName && e?.constructor?.name !== expectedName)
      throw new Error(`${message} — Expected error name "${expectedName}", got "${e?.name}"`);
  }
  if (!threw) throw new Error(`${message ? message + " — " : ""}Expected function to throw`);
}

export async function assertRejects(fn, expectedName, message = "") {
  let threw = false;
  try { await fn(); } catch (e) {
    threw = true;
    if (expectedName && e?.name !== expectedName && e?.constructor?.name !== expectedName)
      throw new Error(`${message} — Expected rejection name "${expectedName}", got "${e?.name}"`);
  }
  if (!threw) throw new Error(`${message ? message + " — " : ""}Expected async function to reject`);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED   = "\x1b[31m";
const YELLOW= "\x1b[33m";
const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";

export class TestSuite {
  #name;
  #tests = [];
  #beforeEach = null;
  #afterEach = null;

  constructor(name) { this.#name = name; }

  beforeEach(fn) { this.#beforeEach = fn; }
  afterEach(fn)  { this.#afterEach  = fn; }

  test(name, fn) { this.#tests.push({ name, fn }); }

  async run() {
    console.log(`\n${BOLD}▶ ${this.#name}${RESET}`);
    let passed = 0, failed = 0;
    const failures = [];

    for (const { name, fn } of this.#tests) {
      const ctx = {};
      try {
        if (this.#beforeEach) await this.#beforeEach(ctx);
        await fn(ctx);
        if (this.#afterEach) await this.#afterEach(ctx);
        console.log(`  ${GREEN}✓${RESET} ${DIM}${name}${RESET}`);
        passed++;
      } catch (e) {
        if (this.#afterEach) try { await this.#afterEach(ctx); } catch {}
        console.log(`  ${RED}✗${RESET} ${name}`);
        console.log(`    ${RED}${e.message}${RESET}`);
        failed++;
        failures.push({ name, error: e });
      }
    }

    const total = passed + failed;
    const statusColor = failed === 0 ? GREEN : RED;
    console.log(`  ${DIM}────────────────────────────────${RESET}`);
    console.log(`  ${statusColor}${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ""}${RESET}`);
    return { passed, failed, failures };
  }
}

// ─── Mock HTTP Server ─────────────────────────────────────────────────────────

export class MockServer {
  #server;
  #handlers = new Map();
  #defaultHandler = null;
  #requests = [];
  port = 0;
  baseUrl = "";

  constructor() {
    this.#server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        req.body = body;
        this.#requests.push({ method: req.method, url: req.url, headers: req.headers, body });
        const pathname = req.url.split("?")[0];
        const key = `${req.method}:${pathname}`;
        const handler = this.#handlers.get(key) ?? this.#handlers.get(`*:${pathname}`) ?? this.#defaultHandler;
        if (handler) {
          handler(req, res);
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `No handler for ${key}` }));
        }
      });
    });
  }

  async start() {
    return new Promise((resolve) => {
      this.#server.listen(0, "127.0.0.1", () => {
        this.port = this.#server.address().port;
        this.baseUrl = `http://127.0.0.1:${this.port}`;
        resolve();
      });
    });
  }

  async stop() {
    return new Promise((resolve, reject) => {
      this.#server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  on(method, path, handler) {
    this.#handlers.set(`${method.toUpperCase()}:${path}`, handler);
    return this;
  }

  onAny(handler) { this.#defaultHandler = handler; return this; }

  clearRequests() { this.#requests = []; }
  getRequests()   { return [...this.#requests]; }
  lastRequest()   { return this.#requests.at(-1); }

  /** Shorthand response helpers */
  json(res, data, status = 200, headers = {}) {
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(JSON.stringify(data));
  }

  text(res, body, status = 200, headers = {}) {
    res.writeHead(status, { "Content-Type": "text/plain", ...headers });
    res.end(body);
  }

  empty(res, status = 204) {
    res.writeHead(status);
    res.end();
  }

  ndjson(res, rows) {
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    for (const row of rows) res.write(JSON.stringify(row) + "\n");
    res.end();
  }

  slow(res, ms, data, status = 200) {
    setTimeout(() => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    }, ms);
  }
}

// ─── Global runner (when this file is the entry point) ───────────────────────

const suiteFiles = [
  "./01-basic-requests.test.js",
  "./02-retry.test.js",
  "./03-timeout.test.js",
  "./04-hooks.test.js",
  "./05-cookie-jar.test.js",
  "./06-cookie-parser.test.js",
  "./07-cookie-store.test.js",
  "./08-circuit-breaker.test.js",
  "./09-ndjson-stream.test.js",
  "./10-headers-security.test.js",
  "./11-search-params.test.js",
  "./12-instance-extend.test.js",
  "./13-errors.test.js",
  "./14-progress.test.js",
  "./15-smart-redirect.test.js",
];

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    let totalPassed = 0, totalFailed = 0;
    const allFailures = [];

    for (const file of suiteFiles) {
      const mod = await import(file);
      if (typeof mod.run === "function") {
        const result = await mod.run();
        totalPassed += result.passed;
        totalFailed += result.failed;
        allFailures.push(...result.failures.map((f) => ({ suite: file, ...f })));
      }
    }

    console.log(`\n${"═".repeat(46)}`);
    const color = totalFailed === 0 ? GREEN : RED;
    console.log(`${BOLD}${color}TOTAL: ${totalPassed} passed, ${totalFailed} failed${RESET}`);

    if (allFailures.length > 0) {
      console.log(`\n${RED}${BOLD}Failures:${RESET}`);
      for (const f of allFailures) {
        console.log(`  ${RED}✗${RESET} ${DIM}${f.suite}${RESET} › ${f.name}`);
        console.log(`    ${RED}${f.error.message}${RESET}`);
      }
      process.exit(1);
    }
  })();
}
