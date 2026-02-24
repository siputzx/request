/**
 * 11 — Search Params
 * Tests: string, object, URLSearchParams, array-of-tuples, merge from extend,
 *        undefined values omitted, overlap with existing URL query.
 */

import { TestSuite, MockServer, assert, assertEqual, assertIncludes } from "./_harness.js";
import request from "../dist/index.js";

const suite = new TestSuite("11 · Search Params");
const server = new MockServer();

function getQuery(req) {
  return Object.fromEntries(new URL(`http://x${req.url}`).searchParams.entries());
}

suite.beforeEach(async () => { server.clearRequests(); });

suite.test("object searchParams appended", async () => {
  server.on("GET", "/sp-obj", (req, res) => server.json(res, getQuery(req)));
  const data = await request.get(`${server.baseUrl}/sp-obj`, {
    searchParams: { foo: "bar", n: 42 }, retry: 0, timeout: 5000,
  }).json();
  assertEqual(data.foo, "bar");
  assertEqual(data.n, "42");
});

suite.test("URLSearchParams instance", async () => {
  server.on("GET", "/sp-usp", (req, res) => server.json(res, getQuery(req)));
  const params = new URLSearchParams({ a: "1", b: "2" });
  const data = await request.get(`${server.baseUrl}/sp-usp`, {
    searchParams: params, retry: 0, timeout: 5000,
  }).json();
  assertEqual(data.a, "1");
  assertEqual(data.b, "2");
});

suite.test("string searchParams", async () => {
  server.on("GET", "/sp-str", (req, res) => server.json(res, getQuery(req)));
  const data = await request.get(`${server.baseUrl}/sp-str`, {
    searchParams: "q=hello&page=1", retry: 0, timeout: 5000,
  }).json();
  assertEqual(data.q, "hello");
  assertEqual(data.page, "1");
});

suite.test("array-of-tuples searchParams", async () => {
  server.on("GET", "/sp-arr", (req, res) => server.json(res, getQuery(req)));
  const data = await request.get(`${server.baseUrl}/sp-arr`, {
    searchParams: [["x", "10"], ["y", "20"]], retry: 0, timeout: 5000,
  }).json();
  assertEqual(data.x, "10");
  assertEqual(data.y, "20");
});

suite.test("undefined values in object are omitted", async () => {
  server.on("GET", "/sp-undef", (req, res) => server.json(res, { raw: req.url }));
  const data = await request.get(`${server.baseUrl}/sp-undef`, {
    searchParams: { a: "yes", b: undefined }, retry: 0, timeout: 5000,
  }).json();
  assertIncludes(data.raw, "a=yes");
  assert(!data.raw.includes("b="), "undefined value should not appear");
});

suite.test("extend merges searchParams additively", async () => {
  server.on("GET", "/sp-merge", (req, res) => server.json(res, getQuery(req)));
  const base = request.extend({ searchParams: { env: "prod" }, retry: 0, timeout: 5000 });
  const data = await base.get(`${server.baseUrl}/sp-merge`, { searchParams: { ver: "2" } }).json();
  assertEqual(data.env, "prod");
  assertEqual(data.ver, "2");
});

suite.test("boolean value stringified", async () => {
  server.on("GET", "/sp-bool", (req, res) => server.json(res, getQuery(req)));
  const data = await request.get(`${server.baseUrl}/sp-bool`, {
    searchParams: { active: true, deleted: false }, retry: 0, timeout: 5000,
  }).json();
  assertEqual(data.active, "true");
  assertEqual(data.deleted, "false");
});

export async function run() {
  await server.start();
  const result = await suite.run();
  await server.stop();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
