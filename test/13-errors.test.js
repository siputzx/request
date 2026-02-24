/**
 * 13 — Error Types & Guards
 * Tests: HTTPError shape (response, request, options, data, status text),
 *        TimeoutError shape, ForceRetryError shape, isRequestError umbrella,
 *        isHTTPError / isTimeoutError / isForceRetryError / isCircuitBreakerOpenError,
 *        HTTPError.data populated for JSON error body,
 *        HTTPError.data populated for text error body.
 */

import { TestSuite, MockServer, assert, assertEqual } from "./_harness.js";
import request, {
  HTTPError,
  TimeoutError,
  ForceRetryError,
  CircuitBreakerOpenError,
  CircuitBreaker,
  isHTTPError,
  isTimeoutError,
  isForceRetryError,
  isCircuitBreakerOpenError,
  isRequestError,
} from "../dist/index.js";

const suite = new TestSuite("13 · Error Types & Guards");
const server = new MockServer();

suite.beforeEach(async () => { server.clearRequests(); });

suite.test("HTTPError has correct shape", async () => {
  server.on("GET", "/err-shape", (req, res) => {
    res.writeHead(422, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Unprocessable" }));
  });
  let caught = null;
  try { await request.get(`${server.baseUrl}/err-shape`, { retry: 0, timeout: 5000 }).json(); }
  catch (e) { caught = e; }

  assert(caught !== null, "should have thrown");
  assert(caught instanceof HTTPError, "should be HTTPError");
  assertEqual(caught.name, "HTTPError");
  assertEqual(caught.response.status, 422);
  assert(caught.request instanceof Request, "request should be a Request");
  assert(caught.options !== undefined, "options should be present");
  assert(caught.message.includes("422"), "message should include status code");
  assert(caught.message.includes("GET"), "message should include method");
});

suite.test("HTTPError.data populated with JSON body", async () => {
  server.on("GET", "/err-json", (req, res) => {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: "BAD_INPUT", field: "email" }));
  });
  let caught = null;
  try { await request.get(`${server.baseUrl}/err-json`, { retry: 0, timeout: 5000 }).json(); }
  catch (e) { caught = e; }
  assert(caught instanceof HTTPError);
  assert(typeof caught.data === "object" && caught.data !== null, "data should be parsed JSON");
  assertEqual(caught.data.code, "BAD_INPUT");
});

suite.test("HTTPError.data populated with text body", async () => {
  server.on("GET", "/err-text", (req, res) => {
    res.writeHead(503, { "Content-Type": "text/plain" });
    res.end("Service Unavailable");
  });
  let caught = null;
  try { await request.get(`${server.baseUrl}/err-text`, { retry: 0, timeout: 5000 }).json(); }
  catch (e) { caught = e; }
  assert(caught instanceof HTTPError);
  assertEqual(caught.data, "Service Unavailable");
});

suite.test("TimeoutError has correct shape", async () => {
  server.on("GET", "/te-shape", (req, res) => server.slow(res, 500, {}));
  let caught = null;
  try { await request.get(`${server.baseUrl}/te-shape`, { timeout: 50, retry: 0 }); }
  catch (e) { caught = e; }
  assert(caught instanceof TimeoutError, "should be TimeoutError");
  assertEqual(caught.name, "TimeoutError");
  assert(caught.request instanceof Request, "request should be present");
  assert(caught.message.includes("timed out"), "message should say timed out");
});

suite.test("ForceRetryError has correct shape", () => {
  const err = new ForceRetryError({ delay: 500, code: "MANUAL" });
  assertEqual(err.name, "ForceRetryError");
  assertEqual(err.customDelay, 500);
  assertEqual(err.code, "MANUAL");
  assert(err instanceof Error);
});

suite.test("CircuitBreakerOpenError has correct shape", () => {
  const err = new CircuitBreakerOpenError("http://example.com");
  assertEqual(err.name, "CircuitBreakerOpenError");
  assert(err.message.includes("OPEN"), "message should mention OPEN");
});

suite.test("isHTTPError — true for HTTPError", async () => {
  server.on("GET", "/ish", (req, res) => server.json(res, {}, 500));
  let caught = null;
  try { await request.get(`${server.baseUrl}/ish`, { retry: 0, timeout: 5000 }).json(); }
  catch (e) { caught = e; }
  assert(isHTTPError(caught), "isHTTPError should return true");
  assert(!isHTTPError(new Error("nope")), "isHTTPError should return false for generic Error");
});

suite.test("isTimeoutError — true for TimeoutError", async () => {
  server.on("GET", "/ist", (req, res) => server.slow(res, 300, {}));
  let caught = null;
  try { await request.get(`${server.baseUrl}/ist`, { timeout: 60, retry: 0 }); }
  catch (e) { caught = e; }
  assert(isTimeoutError(caught), "isTimeoutError should return true");
  assert(!isTimeoutError(new Error("nope")));
});

suite.test("isForceRetryError — true for ForceRetryError", () => {
  const err = new ForceRetryError({ code: "test" });
  assert(isForceRetryError(err));
  assert(!isForceRetryError(new Error("nope")));
});

suite.test("isCircuitBreakerOpenError — true for CircuitBreakerOpenError", () => {
  const err = new CircuitBreakerOpenError("http://x");
  assert(isCircuitBreakerOpenError(err));
  assert(!isCircuitBreakerOpenError(new Error("nope")));
});

suite.test("isRequestError — umbrella for all library errors", async () => {
  server.on("GET", "/isfs", (req, res) => server.json(res, {}, 400));
  let caught = null;
  try { await request.get(`${server.baseUrl}/isfs`, { retry: 0, timeout: 5000 }).json(); }
  catch (e) { caught = e; }
  assert(isRequestError(caught), "isRequestError should be true for HTTPError");
  assert(!isRequestError(new SyntaxError("bad JSON")), "generic errors should return false");
});

suite.test("HTTPError message includes URL", async () => {
  server.on("GET", "/url-in-msg", (req, res) => server.json(res, {}, 404));
  let caught = null;
  try { await request.get(`${server.baseUrl}/url-in-msg`, { retry: 0, timeout: 5000 }); }
  catch (e) { caught = e; }
  assert(caught instanceof HTTPError);
  assert(caught.message.includes("/url-in-msg"), `URL should be in message: ${caught.message}`);
});

export async function run() {
  await server.start();
  const result = await suite.run();
  await server.stop();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
