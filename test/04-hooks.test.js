/**
 * 04 — Lifecycle Hooks
 * Tests: beforeRequest (mutate headers, short-circuit with Response/Request),
 *        beforeRetry (stop symbol, replace request), afterResponse (mutate response,
 *        trigger retry with RetryMarker), beforeError (augment HTTPError).
 */

import { TestSuite, MockServer, assert, assertEqual, assertRejects } from "./_harness.js";
import request, { HTTPError } from "../dist/index.js";

const suite = new TestSuite("04 · Lifecycle Hooks");
const server = new MockServer();

suite.beforeEach(async () => { server.clearRequests(); });

suite.test("beforeRequest — mutates headers", async () => {
  server.on("GET", "/brhdr", (req, res) => server.json(res, { auth: req.headers["authorization"] }));
  const data = await request.get(`${server.baseUrl}/brhdr`, {
    retry: 0,
    hooks: {
      beforeRequest: [({ request }) => { request.headers.set("Authorization", "Bearer test"); }],
    },
  }).json();
  assertEqual(data.auth, "Bearer test");
});

suite.test("beforeRequest — returns Response short-circuits fetch", async () => {
  let serverHit = false;
  server.on("GET", "/short", (req, res) => { serverHit = true; server.json(res, {}); });
  const data = await request.get(`${server.baseUrl}/short`, {
    retry: 0,
    hooks: {
      beforeRequest: [() => new Response(JSON.stringify({ mock: true }), {
        headers: { "Content-Type": "application/json" },
      })],
    },
  }).json();
  assertEqual(data.mock, true);
  assert(!serverHit, "server should not be hit");
});

suite.test("beforeRequest — multiple hooks run in order", async () => {
  server.on("GET", "/multi-br", (req, res) => server.json(res, {
    h1: req.headers["x-hook-1"],
    h2: req.headers["x-hook-2"],
  }));
  const data = await request.get(`${server.baseUrl}/multi-br`, {
    retry: 0,
    hooks: {
      beforeRequest: [
        ({ request }) => { request.headers.set("x-hook-1", "one"); },
        ({ request }) => { request.headers.set("x-hook-2", "two"); },
      ],
    },
  }).json();
  assertEqual(data.h1, "one");
  assertEqual(data.h2, "two");
});

suite.test("afterResponse — can mutate response", async () => {
  server.on("GET", "/ar", (req, res) => server.json(res, { original: true }));
  const data = await request.get(`${server.baseUrl}/ar`, {
    retry: 0,
    hooks: {
      afterResponse: [({ response }) => {
        return new Response(JSON.stringify({ mutated: true }), {
          status: response.status,
          headers: response.headers,
        });
      }],
    },
  }).json();
  assertEqual(data.mutated, true);
});

suite.test("afterResponse — retry marker triggers retry", async () => {
  let calls = 0;
  server.on("GET", "/arm", (req, res) => { calls++; server.json(res, { calls }); });
  const data = await request.get(`${server.baseUrl}/arm`, {
    retry: { limit: 2, delay: () => 5 },
    timeout: 5000,
    hooks: {
      afterResponse: [({ response, retryCount }) => {
        if (retryCount < 1) return request.retry();
        return response;
      }],
    },
  }).json();
  assert(calls >= 2, `should have retried; calls=${calls}`);
});

suite.test("beforeRetry — stop symbol halts retries", async () => {
  let calls = 0;
  server.on("GET", "/stop", (req, res) => { calls++; server.json(res, {}, 500); });
  await assertRejects(() =>
    request.get(`${server.baseUrl}/stop`, {
      retry: { limit: 5, delay: () => 5 },
      timeout: 5000,
      hooks: {
        beforeRetry: [() => request.stop],
      },
    }).json()
  );
  assertEqual(calls, 1, "stop should halt before first retry");
});

suite.test("beforeRetry — receives retryCount and error", async () => {
  let seenCount = 0;
  let seenError = null;
  server.on("GET", "/brinfo", (req, res) => server.json(res, {}, 500));
  await assertRejects(() =>
    request.get(`${server.baseUrl}/brinfo`, {
      retry: { limit: 1, delay: () => 5 },
      timeout: 5000,
      hooks: {
        beforeRetry: [({ retryCount, error }) => { seenCount = retryCount; seenError = error; }],
      },
    }).json()
  );
  assertEqual(seenCount, 1);
  assert(seenError !== null, "error should be set");
});

suite.test("beforeError — augments HTTPError", async () => {
  server.on("GET", "/be", (req, res) => server.json(res, { detail: "bad" }, 400));
  let caught = null;
  try {
    await request.get(`${server.baseUrl}/be`, {
      retry: 0,
      hooks: {
        beforeError: [({ error }) => { error.extra = "enriched"; return error; }],
      },
    }).json();
  } catch (e) { caught = e; }
  assert(caught instanceof HTTPError, "should be HTTPError");
  assertEqual(caught.extra, "enriched");
});

suite.test("hooks inherited via extend", async () => {
  server.on("GET", "/ext-hook", (req, res) => server.json(res, { h: req.headers["x-base"] }));
  const base = request.extend({
    retry: 0,
    timeout: 5000,
    hooks: { beforeRequest: [({ request }) => { request.headers.set("x-base", "yes"); }] },
  });
  const data = await base.get(`${server.baseUrl}/ext-hook`).json();
  assertEqual(data.h, "yes");
});

suite.test("extend merges hooks additively", async () => {
  server.on("GET", "/additive", (req, res) => server.json(res, {
    h1: req.headers["x-h1"],
    h2: req.headers["x-h2"],
  }));
  const base = request.extend({
    retry: 0, timeout: 5000,
    hooks: { beforeRequest: [({ request }) => { request.headers.set("x-h1", "A"); }] },
  });
  const ext = base.extend({
    hooks: { beforeRequest: [({ request }) => { request.headers.set("x-h2", "B"); }] },
  });
  const data = await ext.get(`${server.baseUrl}/additive`).json();
  assertEqual(data.h1, "A");
  assertEqual(data.h2, "B");
});

export async function run() {
  await server.start();
  const result = await suite.run();
  await server.stop();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
