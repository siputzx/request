/**
 * 03 — Timeout
 * Tests: per-request timeout, timeout:false disables it, total timeout across
 *        retries, TimeoutError thrown, AbortSignal user cancellation.
 */

import { TestSuite, MockServer, assert, assertEqual, assertRejects } from "./_harness.js";
import request, { TimeoutError, isTimeoutError } from "../dist/index.js";

const suite = new TestSuite("03 · Timeout");
const server = new MockServer();

suite.beforeEach(async () => { server.clearRequests(); });

suite.test("throws TimeoutError when server is slow", async () => {
  server.on("GET", "/slow", (req, res) => server.slow(res, 300, { ok: true }));
  await assertRejects(
    () => request.get(`${server.baseUrl}/slow`, { timeout: 80, retry: 0 }).json(),
    "TimeoutError"
  );
});

suite.test("isTimeoutError helper identifies correctly", async () => {
  server.on("GET", "/slow2", (req, res) => server.slow(res, 300, {}));
  let caught = null;
  try {
    await request.get(`${server.baseUrl}/slow2`, { timeout: 80, retry: 0 }).json();
  } catch (e) { caught = e; }
  assert(caught !== null, "should have thrown");
  assert(isTimeoutError(caught), "isTimeoutError should return true");
  assert(caught instanceof TimeoutError, "should be TimeoutError instance");
  assertEqual(caught.request.method, "GET");
});

suite.test("fast response succeeds with tight timeout", async () => {
  server.on("GET", "/fast", (req, res) => server.json(res, { ok: true }));
  const data = await request.get(`${server.baseUrl}/fast`, { timeout: 2000, retry: 0 }).json();
  assertEqual(data.ok, true);
});

suite.test("timeout:false — no timeout applied", async () => {
  server.on("GET", "/notimeout", (req, res) => server.slow(res, 80, { ok: true }));
  const data = await request.get(`${server.baseUrl}/notimeout`, { timeout: false, retry: 0 }).json();
  assertEqual(data.ok, true);
});

suite.test("total timeout applies across retries", async () => {
  let calls = 0;
  server.on("GET", "/total-timeout", (req, res) => {
    calls++;
    server.slow(res, 150, {}, 500);
  });
  const start = Date.now();
  await assertRejects(
    () => request.get(`${server.baseUrl}/total-timeout`, {
      timeout: 300,
      retry: { limit: 5, delay: () => 5, statusCodes: [500] },
    }).json(),
    undefined
  );
  const elapsed = Date.now() - start;
  assert(elapsed < 600, `total timeout should stop retries; elapsed=${elapsed}ms`);
  assert(calls < 5, `should stop before exhausting retries (calls=${calls})`);
});

suite.test("AbortSignal cancellation", async () => {
  server.on("GET", "/abort", (req, res) => server.slow(res, 500, {}));
  const controller = new AbortController();
  const p = request.get(`${server.baseUrl}/abort`, { signal: controller.signal, timeout: false, retry: 0 });
  setTimeout(() => controller.abort(), 60);
  let caught = null;
  try { await p; } catch (e) { caught = e; }
  assert(caught !== null, "should have thrown on abort");
});

suite.test("RangeError when timeout exceeds maxSafeTimeout", async () => {
  server.on("GET", "/range", (req, res) => server.json(res, {}));
  await assertRejects(
    () => request.get(`${server.baseUrl}/range`, { timeout: 2_200_000_000, retry: 0 }),
    "RangeError"
  );
});

export async function run() {
  await server.start();
  const result = await suite.run();
  await server.stop();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
