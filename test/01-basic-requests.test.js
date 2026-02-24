/**
 * 01 — Basic Requests
 * Tests: GET, POST, PUT, PATCH, DELETE, HEAD, prefixUrl, custom fetch, json body,
 *        text body, 204 empty, response ok flag, response status.
 */

import { TestSuite, MockServer, assert, assertEqual, assertIncludes } from "./_harness.js";
import request from "../dist/index.js";

const suite = new TestSuite("01 · Basic Requests");
const server = new MockServer();

suite.beforeEach(async () => { server.clearRequests(); });

suite.test("GET — returns JSON", async () => {
  server.on("GET", "/data", (req, res) => server.json(res, { ok: true }));
  const data = await request.get(`${server.baseUrl}/data`).json();
  assertEqual(data.ok, true);
});

suite.test("POST — sends JSON body", async () => {
  server.on("POST", "/echo", (req, res) => {
    const body = JSON.parse(req.body);
    server.json(res, { received: body.name });
  });
  const data = await request.post(`${server.baseUrl}/echo`, { json: { name: "Alice" } }).json();
  assertEqual(data.received, "Alice");
});

suite.test("PUT — correct method forwarded", async () => {
  server.on("PUT", "/item", (req, res) => server.json(res, { method: req.method }));
  const data = await request.put(`${server.baseUrl}/item`, { json: {} }).json();
  assertEqual(data.method, "PUT");
});

suite.test("PATCH — correct method forwarded", async () => {
  server.on("PATCH", "/item", (req, res) => server.json(res, { method: req.method }));
  const data = await request.patch(`${server.baseUrl}/item`, { json: {} }).json();
  assertEqual(data.method, "PATCH");
});

suite.test("DELETE — correct method forwarded", async () => {
  server.on("DELETE", "/item", (req, res) => server.json(res, { method: req.method }));
  const data = await request.delete(`${server.baseUrl}/item`).json();
  assertEqual(data.method, "DELETE");
});

suite.test("HEAD — returns no body, status 200", async () => {
  server.on("HEAD", "/ping", (req, res) => { res.writeHead(200); res.end(); });
  const res = await request.head(`${server.baseUrl}/ping`);
  assertEqual(res.status, 200);
  assertEqual(res.ok, true);
});

suite.test("prefixUrl — concatenates correctly", async () => {
  server.on("GET", "/users/1", (req, res) => server.json(res, { id: 1 }));
  const api = request.extend({ prefixUrl: server.baseUrl, retry: 0, timeout: 5000 });
  const data = await api.get("users/1").json();
  assertEqual(data.id, 1);
});

suite.test("prefixUrl — trailing slash normalised", async () => {
  server.on("GET", "/v1/ping", (req, res) => server.json(res, { pong: true }));
  const api = request.extend({ prefixUrl: `${server.baseUrl}/v1/`, retry: 0, timeout: 5000 });
  const data = await api.get("ping").json();
  assertEqual(data.pong, true);
});

suite.test(".text() — returns plain text", async () => {
  server.on("GET", "/text", (req, res) => server.text(res, "hello world"));
  const text = await request.get(`${server.baseUrl}/text`, { retry: 0 }).text();
  assertEqual(text, "hello world");
});

suite.test(".arrayBuffer() — returns binary data", async () => {
  server.on("GET", "/bin", (req, res) => {
    res.writeHead(200, { "Content-Type": "application/octet-stream" });
    res.end(Buffer.from([1, 2, 3, 4]));
  });
  const buf = await request.get(`${server.baseUrl}/bin`, { retry: 0 }).arrayBuffer();
  assert(buf instanceof ArrayBuffer, "should be ArrayBuffer");
  assertEqual(buf.byteLength, 4);
});

suite.test("204 No Content — json() returns undefined", async () => {
  server.on("GET", "/empty", (req, res) => server.empty(res, 204));
  const result = await request.get(`${server.baseUrl}/empty`, { retry: 0 }).json();
  assertEqual(result, undefined);
});

suite.test("content-type header set for json body", async () => {
  server.on("POST", "/ct", (req, res) => server.json(res, { ct: req.headers["content-type"] }));
  const data = await request.post(`${server.baseUrl}/ct`, { json: {}, retry: 0 }).json();
  assertIncludes(data.ct, "application/json");
});

suite.test("custom headers forwarded", async () => {
  server.on("GET", "/hdr", (req, res) => server.json(res, { xfoo: req.headers["x-foo"] }));
  const data = await request.get(`${server.baseUrl}/hdr`, {
    headers: { "x-foo": "bar" }, retry: 0,
  }).json();
  assertEqual(data.xfoo, "bar");
});

suite.test("response.ok is false for 4xx", async () => {
  server.on("GET", "/notfound", (req, res) => server.json(res, {}, 404));
  const res = await request.get(`${server.baseUrl}/notfound`, {
    throwHttpErrors: false, retry: 0,
  });
  assertEqual(res.ok, false);
  assertEqual(res.status, 404);
});

suite.test("URL object as input", async () => {
  server.on("GET", "/url-obj", (req, res) => server.json(res, { ok: true }));
  const data = await request.get(new URL(`${server.baseUrl}/url-obj`), { retry: 0 }).json();
  assertEqual(data.ok, true);
});

suite.test("Request object as input", async () => {
  server.on("GET", "/req-obj", (req, res) => server.json(res, { ok: true }));
  const req = new Request(`${server.baseUrl}/req-obj`);
  const data = await request.get(req, { retry: 0 }).json();
  assertEqual(data.ok, true);
});

suite.test("parseJson — custom JSON parser used", async () => {
  server.on("GET", "/pj", (req, res) => server.json(res, { v: 1 }));
  let called = false;
  const data = await request.get(`${server.baseUrl}/pj`, {
    retry: 0,
    parseJson: (text) => { called = true; return JSON.parse(text); },
  }).json();
  assert(called, "custom parseJson should be called");
  assertEqual(data.v, 1);
});

suite.test("stringifyJson — custom serializer used", async () => {
  server.on("POST", "/sj", (req, res) => server.json(res, { body: req.body }));
  let called = false;
  const data = await request.post(`${server.baseUrl}/sj`, {
    retry: 0,
    json: { x: 1 },
    stringifyJson: (v) => { called = true; return JSON.stringify(v); },
  }).json();
  assert(called, "custom stringifyJson should be called");
  assertIncludes(data.body, '"x":1');
});

export async function run() {
  await server.start();
  const result = await suite.run();
  await server.stop();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
