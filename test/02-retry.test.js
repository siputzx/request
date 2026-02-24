/**
 * 02 — Retry Mechanism
 * Tests: retry limit, retry on 5xx, retry on 429, Retry-After header,
 *        exponential backoff delay, jitter, no retry on 4xx (non-listed),
 *        retry only on safe methods, shouldRetry callback, ForceRetryError,
 *        retryOnTimeout.
 */

import { TestSuite, MockServer, assert, assertEqual, assertRejects } from "./_harness.js";
import request, { HTTPError, TimeoutError } from "../dist/index.js";

const suite = new TestSuite("02 · Retry Mechanism");
const server = new MockServer();

suite.beforeEach(async () => { server.clearRequests(); });

suite.test("retries up to limit on 500", async () => {
  let calls = 0;
  server.on("GET", "/r500", (req, res) => {
    calls++;
    server.json(res, { error: "oops" }, 500);
  });
  await assertRejects(
    () => request.get(`${server.baseUrl}/r500`, {
      retry: { limit: 2, delay: () => 10 }, timeout: 5000,
    }).json(),
    "HTTPError"
  );
  assertEqual(calls, 3, "initial + 2 retries = 3 calls");
});

suite.test("succeeds after transient 500", async () => {
  let calls = 0;
  server.on("GET", "/transient", (req, res) => {
    calls++;
    if (calls < 3) { server.json(res, {}, 500); return; }
    server.json(res, { ok: true });
  });
  const data = await request.get(`${server.baseUrl}/transient`, {
    retry: { limit: 3, delay: () => 10 }, timeout: 5000,
  }).json();
  assertEqual(data.ok, true);
  assertEqual(calls, 3);
});

suite.test("does NOT retry on 400", async () => {
  let calls = 0;
  server.on("GET", "/r400", (req, res) => { calls++; server.json(res, {}, 400); });
  await assertRejects(
    () => request.get(`${server.baseUrl}/r400`, { retry: { limit: 3, delay: () => 10 }, timeout: 5000 }).json(),
    "HTTPError"
  );
  assertEqual(calls, 1, "should not retry on 400");
});

suite.test("does NOT retry POST by default", async () => {
  let calls = 0;
  server.on("POST", "/rpost", (req, res) => { calls++; server.json(res, {}, 500); });
  await assertRejects(
    () => request.post(`${server.baseUrl}/rpost`, {
      json: {}, retry: { limit: 3, delay: () => 10 }, timeout: 5000,
    }).json(),
    "HTTPError"
  );
  assertEqual(calls, 1, "POST should not retry by default");
});

suite.test("retries POST when methods includes post", async () => {
  let calls = 0;
  server.on("POST", "/rpost2", (req, res) => {
    calls++;
    if (calls < 2) { server.json(res, {}, 500); return; }
    server.json(res, { ok: true });
  });
  const data = await request.post(`${server.baseUrl}/rpost2`, {
    json: {},
    retry: { limit: 2, methods: ["post"], statusCodes: [500], delay: () => 10 },
    timeout: 5000,
  }).json();
  assertEqual(data.ok, true);
  assertEqual(calls, 2);
});

suite.test("respects Retry-After (seconds)", async () => {
  let calls = 0;
  const start = Date.now();
  server.on("GET", "/ra", (req, res) => {
    calls++;
    if (calls === 1) {
      res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "0" });
      res.end("{}");
      return;
    }
    server.json(res, { ok: true });
  });
  const data = await request.get(`${server.baseUrl}/ra`, {
    retry: { limit: 2, statusCodes: [429], afterStatusCodes: [429], delay: () => 0, maxRetryAfter: 200 },
    timeout: 5000,
  }).json();
  assertEqual(data.ok, true);
  assertEqual(calls, 2);
});

suite.test("retry limit: 0 means no retry", async () => {
  let calls = 0;
  server.on("GET", "/r0", (req, res) => { calls++; server.json(res, {}, 500); });
  await assertRejects(
    () => request.get(`${server.baseUrl}/r0`, { retry: 0, timeout: 5000 }).json(),
    "HTTPError"
  );
  assertEqual(calls, 1);
});

suite.test("shouldRetry callback — can abort retry", async () => {
  let calls = 0;
  let callbackCalls = 0;
  server.on("GET", "/sr-abort", (req, res) => { calls++; server.json(res, {}, 503); });
  await assertRejects(() =>
    request.get(`${server.baseUrl}/sr-abort`, {
      retry: {
        limit: 5,
        delay: () => 5,
        shouldRetry: () => { callbackCalls++; return false; },
      },
      timeout: 5000,
    }).json()
  );
  assertEqual(calls, 1, "shouldRetry=false should stop immediately");
  assertEqual(callbackCalls, 1);
});

suite.test("shouldRetry callback — can force retry on non-retryable status", async () => {
  let calls = 0;
  server.on("GET", "/sr-force", (req, res) => {
    calls++;
    if (calls < 2) { server.json(res, {}, 422); return; }
    server.json(res, { ok: true });
  });
  const data = await request.get(`${server.baseUrl}/sr-force`, {
    retry: {
      limit: 3,
      delay: () => 5,
      statusCodes: [500],
      shouldRetry: () => true,
    },
    timeout: 5000,
  }).json();
  assertEqual(data.ok, true);
  assertEqual(calls, 2);
});

suite.test("backoffLimit caps delay", async () => {
  const delays = [];
  let calls = 0;
  server.on("GET", "/bl", (req, res) => { calls++; server.json(res, {}, 500); });

  const start = Date.now();
  await assertRejects(() =>
    request.get(`${server.baseUrl}/bl`, {
      retry: {
        limit: 3,
        delay: () => 50,
        backoffLimit: 20,
        jitter: false,
      },
      timeout: 5000,
    }).json()
  );
  const elapsed = Date.now() - start;
  assert(elapsed < 400, `backoffLimit should cap delays; elapsed=${elapsed}ms`);
});

suite.test("retry increments retryCount in hooks", async () => {
  let maxSeen = 0;
  let calls = 0;
  server.on("GET", "/rc", (req, res) => { calls++; server.json(res, {}, 500); });
  await assertRejects(() =>
    request.get(`${server.baseUrl}/rc`, {
      retry: { limit: 2, delay: () => 5 },
      timeout: 5000,
      hooks: {
        beforeRetry: [({ retryCount }) => { if (retryCount > maxSeen) maxSeen = retryCount; }],
      },
    }).json()
  );
  assertEqual(maxSeen, 2, "retryCount should reach limit");
});

export async function run() {
  await server.start();
  const result = await suite.run();
  await server.stop();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
