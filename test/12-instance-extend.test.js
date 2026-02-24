/**
 * 12 — Instance create / extend
 * Tests: create() is fresh (no parent defaults), extend() inherits parent defaults,
 *        extend() with function callback, defaults override, independent instances,
 *        stop symbol accessible, retry helper accessible, throwHttpErrors default.
 */

import { TestSuite, MockServer, assert, assertEqual, assertRejects } from "./_harness.js";
import request, { HTTPError } from "../dist/index.js";

const suite = new TestSuite("12 · Instance create / extend");
const server = new MockServer();

suite.beforeEach(async () => { server.clearRequests(); });

suite.test("create() produces independent instance", async () => {
  server.on("GET", "/cr", (req, res) => server.json(res, { h: req.headers["x-base"] ?? "" }));
  const custom = request.create({ retry: 0, timeout: 5000, headers: { "x-base": "yes" } });
  const data = await custom.get(`${server.baseUrl}/cr`).json();
  assertEqual(data.h, "yes");
});

suite.test("create() does NOT inherit parent defaults", async () => {
  server.on("GET", "/cr2", (req, res) => server.json(res, { h: req.headers["x-parent"] ?? "" }));
  const parent = request.extend({ headers: { "x-parent": "parentval" }, retry: 0, timeout: 5000 });
  const child = parent.create({ retry: 0, timeout: 5000 });
  const data = await child.get(`${server.baseUrl}/cr2`).json();
  assertEqual(data.h, "", "create() should not inherit parent headers");
});

suite.test("extend() inherits parent headers", async () => {
  server.on("GET", "/ext-inherit", (req, res) => server.json(res, { h: req.headers["x-p"] ?? "" }));
  const parent = request.extend({ headers: { "x-p": "pval" }, retry: 0, timeout: 5000 });
  const child = parent.extend({});
  const data = await child.get(`${server.baseUrl}/ext-inherit`).json();
  assertEqual(data.h, "pval");
});

suite.test("extend() child overrides parent header", async () => {
  server.on("GET", "/ext-override", (req, res) => server.json(res, { h: req.headers["x-common"] ?? "" }));
  const parent = request.extend({ headers: { "x-common": "parent" }, retry: 0, timeout: 5000 });
  const child = parent.extend({ headers: { "x-common": "child" } });
  const data = await child.get(`${server.baseUrl}/ext-override`).json();
  assertEqual(data.h, "child");
});

suite.test("extend() with function callback receives parent defaults", () => {
  const parent = request.extend({ context: { env: "prod" }, retry: 0, timeout: 5000 });
  let received = null;
  const child = parent.extend((parentDefaults) => {
    received = parentDefaults;
    return {};
  });
  assert(received !== null, "callback should be called");
  assert(typeof received === "object", "callback should receive object");
});

suite.test("two extend() chains are independent", async () => {
  server.on("GET", "/ind", (req, res) => server.json(res, { h: req.headers["x-branch"] ?? "" }));
  const base = request.extend({ retry: 0, timeout: 5000 });
  const branchA = base.extend({ headers: { "x-branch": "A" } });
  const branchB = base.extend({ headers: { "x-branch": "B" } });
  const [a, b] = await Promise.all([
    branchA.get(`${server.baseUrl}/ind`).json(),
    branchB.get(`${server.baseUrl}/ind`).json(),
  ]);
  assertEqual(a.h, "A");
  assertEqual(b.h, "B");
});

suite.test("stop symbol is the same reference across instances", () => {
  const a = request.extend({});
  const b = request.extend({});
  assert(a.stop === b.stop, "stop should be same symbol");
  assert(typeof a.stop === "symbol");
});

suite.test("retry helper is a function", () => {
  const marker = request.retry({ delay: 100 });
  assert(marker !== null && typeof marker === "object", "retry() should return a RetryMarker");
});

suite.test("throwHttpErrors:false — 4xx returns response without throw", async () => {
  server.on("GET", "/no-throw", (req, res) => server.json(res, {}, 403));
  const api = request.extend({ throwHttpErrors: false, retry: 0, timeout: 5000 });
  const res = await api.get(`${server.baseUrl}/no-throw`);
  assertEqual(res.status, 403);
  assertEqual(res.ok, false);
});

suite.test("throwHttpErrors:true (default) — 4xx throws HTTPError", async () => {
  server.on("GET", "/throw-default", (req, res) => server.json(res, {}, 401));
  await assertRejects(
    () => request.get(`${server.baseUrl}/throw-default`, { retry: 0, timeout: 5000 }),
    "HTTPError"
  );
});

suite.test("throwHttpErrors as function — selective throwing", async () => {
  server.on("GET", "/selective", (req, res) => server.json(res, {}, 404));
  const api = request.extend({
    retry: 0, timeout: 5000,
    throwHttpErrors: (status) => status !== 404,
  });
  const res = await api.get(`${server.baseUrl}/selective`);
  assertEqual(res.status, 404, "404 should not throw with selective function");
});

export async function run() {
  await server.start();
  const result = await suite.run();
  await server.stop();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
