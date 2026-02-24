/**
 * 08 — Circuit Breaker
 * Tests: CLOSED→OPEN on threshold, OPEN rejects immediately,
 *        OPEN→HALF_OPEN after halfOpenAfterMs, HALF_OPEN→CLOSED on success,
 *        HALF_OPEN→OPEN on failure, reset(), onStateChange callback,
 *        CircuitBreakerOpenError, successThreshold > 1,
 *        integration with FetchEngine.
 */

import { TestSuite, MockServer, assert, assertEqual, assertRejects } from "./_harness.js";
import request, {
  CircuitBreaker,
  CircuitBreakerOpenError,
  isCircuitBreakerOpenError,
} from "../dist/index.js";

const suite = new TestSuite("08 · Circuit Breaker");
const server = new MockServer();

suite.beforeEach(async () => { server.clearRequests(); });

suite.test("starts in CLOSED state", () => {
  const cb = new CircuitBreaker({ threshold: 3 });
  assertEqual(cb.state, "CLOSED");
  assert(cb.canRequest(), "should allow requests when CLOSED");
});

suite.test("opens after threshold failures", () => {
  const cb = new CircuitBreaker({ threshold: 3 });
  cb.onFailure();
  cb.onFailure();
  assertEqual(cb.state, "CLOSED");
  cb.onFailure();
  assertEqual(cb.state, "OPEN");
  assert(!cb.canRequest(), "should block requests when OPEN");
});

suite.test("success resets failure count in CLOSED state", () => {
  const cb = new CircuitBreaker({ threshold: 3 });
  cb.onFailure();
  cb.onFailure();
  cb.onSuccess();
  cb.onFailure();
  cb.onFailure();
  assertEqual(cb.state, "CLOSED", "2 failures after reset should not open");
});

suite.test("OPEN → HALF_OPEN after halfOpenAfterMs", async () => {
  const cb = new CircuitBreaker({ threshold: 1, halfOpenAfterMs: 50 });
  cb.onFailure();
  assertEqual(cb.state, "OPEN");
  await new Promise((r) => setTimeout(r, 80));
  assert(cb.canRequest(), "should allow probe request after halfOpenAfterMs");
  assertEqual(cb.state, "HALF_OPEN");
});

suite.test("HALF_OPEN → CLOSED on success", async () => {
  const cb = new CircuitBreaker({ threshold: 1, halfOpenAfterMs: 30 });
  cb.onFailure();
  await new Promise((r) => setTimeout(r, 50));
  cb.canRequest();
  assertEqual(cb.state, "HALF_OPEN");
  cb.onSuccess();
  assertEqual(cb.state, "CLOSED");
});

suite.test("HALF_OPEN → OPEN on failure", async () => {
  const cb = new CircuitBreaker({ threshold: 1, halfOpenAfterMs: 30 });
  cb.onFailure();
  await new Promise((r) => setTimeout(r, 50));
  cb.canRequest();
  assertEqual(cb.state, "HALF_OPEN");
  cb.onFailure();
  assertEqual(cb.state, "OPEN");
});

suite.test("successThreshold > 1 — requires multiple successes to close", async () => {
  const cb = new CircuitBreaker({ threshold: 1, halfOpenAfterMs: 30, successThreshold: 3 });
  cb.onFailure();
  await new Promise((r) => setTimeout(r, 50));
  cb.canRequest();
  cb.onSuccess();
  assertEqual(cb.state, "HALF_OPEN", "1 success not enough");
  cb.onSuccess();
  assertEqual(cb.state, "HALF_OPEN", "2 successes not enough");
  cb.onSuccess();
  assertEqual(cb.state, "CLOSED", "3 successes should close");
});

suite.test("reset() restores CLOSED state", () => {
  const cb = new CircuitBreaker({ threshold: 2 });
  cb.onFailure();
  cb.onFailure();
  assertEqual(cb.state, "OPEN");
  cb.reset();
  assertEqual(cb.state, "CLOSED");
  assert(cb.canRequest(), "should accept requests after reset");
});

suite.test("onStateChange callback fires on transitions", () => {
  const transitions = [];
  const cb = new CircuitBreaker({
    threshold: 1,
    onStateChange: (prev, next) => transitions.push(`${prev}→${next}`),
  });
  cb.onFailure();
  assert(transitions.includes("CLOSED→OPEN"), `Expected CLOSED→OPEN, got ${JSON.stringify(transitions)}`);
});

suite.test("CircuitBreakerOpenError thrown by FetchEngine when OPEN", async () => {
  server.on("GET", "/cb-open", (req, res) => server.json(res, {}));
  const cb = new CircuitBreaker({ threshold: 1 });
  cb.onFailure();
  assertEqual(cb.state, "OPEN");

  await assertRejects(
    () => request.get(`${server.baseUrl}/cb-open`, { circuitBreaker: cb, retry: 0, timeout: 5000 }),
    "CircuitBreakerOpenError"
  );
});

suite.test("isCircuitBreakerOpenError helper", () => {
  const err = new CircuitBreakerOpenError("http://example.com");
  assert(isCircuitBreakerOpenError(err), "should identify by instance");
  assert(!isCircuitBreakerOpenError(new Error("nope")), "should not match generic Error");
});

suite.test("circuit breaker records success on 2xx", async () => {
  server.on("GET", "/cb-ok", (req, res) => server.json(res, { ok: true }));
  const cb = new CircuitBreaker({ threshold: 5 });
  await request.get(`${server.baseUrl}/cb-ok`, { circuitBreaker: cb, retry: 0, timeout: 5000 }).json();
  assertEqual(cb.state, "CLOSED");
});

suite.test("circuit breaker records failure on 5xx HTTPError", async () => {
  server.on("GET", "/cb-fail", (req, res) => server.json(res, {}, 500));
  const cb = new CircuitBreaker({ threshold: 1 });
  await assertRejects(
    () => request.get(`${server.baseUrl}/cb-fail`, { circuitBreaker: cb, retry: 0, timeout: 5000 }).json(),
    "HTTPError"
  );
  assertEqual(cb.state, "OPEN");
});

export async function run() {
  await server.start();
  const result = await suite.run();
  await server.stop();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
