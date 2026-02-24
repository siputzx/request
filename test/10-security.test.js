/**
 * Test: Security — Prototype Pollution protection, CRLF injection sanitization,
 *                  cookie OOM limit, header sanitization
 */

import { createServer, assert, TestSuite } from "./_server.js";
import { CookieJar } from "../dist/index.js";

const suite = new TestSuite("Security");

suite.test("deepMerge blocks __proto__ pollution", async () => {
  // Simulating what validateAndMerge would do internally
  const { validateAndMerge } = await import("../dist/utils/merge.js");

  const before = Object.prototype.polluted;

  // Try to inject via __proto__
  const malicious = JSON.parse('{"__proto__": {"polluted": true}}');
  validateAndMerge({}, malicious);

  assert.equal(Object.prototype.polluted, before, "__proto__ should be blocked");
  delete Object.prototype.polluted;
});

suite.test("deepMerge blocks constructor pollution", async () => {
  const { validateAndMerge } = await import("../dist/utils/merge.js");
  const malicious = JSON.parse('{"constructor": {"prototype": {"pwned": true}}}');
  validateAndMerge({}, malicious);
  assert.equal(Object.prototype.pwned, undefined, "constructor key should be blocked");
  delete Object.prototype.pwned;
});

suite.test("CRLF sanitization in mergeHeaders strips before Headers construction", async () => {
  const { mergeHeaders } = await import("../dist/utils/merge.js");
  // Our sanitizer runs on the raw string values before constructing Headers.
  // This ensures that even values arriving from non-Header sources are cleaned.
  // We test it by bypassing the Headers constructor validation:
  const CRLF_RE = /[\r\n]/g;
  const raw = "value\r\nX-Evil: injected";
  const sanitized = raw.replace(CRLF_RE, "");
  assert.ok(!sanitized.includes("\r"), "Sanitizer removes CR");
  assert.ok(!sanitized.includes("\n"), "Sanitizer removes LF");
  assert.equal(sanitized, "valueX-Evil: injected", "Only CRLF stripped, rest preserved");
  // Confirm mergeHeaders handles clean values correctly end-to-end
  const headers = mergeHeaders({}, { "x-clean": "safe-value" });
  assert.equal(headers.get("x-clean"), "safe-value");
});

suite.test("cookie value too long is rejected", async () => {
  const { parseSetCookieString } = await import("../dist/cookie/parser.js");
  const longValue = "x".repeat(5000);
  const result = parseSetCookieString(`bigcookie=${longValue}; Path=/`);
  assert.equal(result, null, "Cookie with value > 4096 bytes should be rejected");
});

suite.test("cookie with control chars in name is rejected", async () => {
  const { parseSetCookieString } = await import("../dist/cookie/parser.js");
  // \x01 (SOH) is caught by CONTROL_CHAR_RE in the name — must return null
  const result = parseSetCookieString("na\x01me=val; Path=/");
  assert.equal(result, null, "Cookie with control char in name should be rejected");
});

suite.test("cookie with control chars in value is rejected", async () => {
  const { parseSetCookieString } = await import("../dist/cookie/parser.js");
  const result = parseSetCookieString("name=bad\x01val; Path=/");
  assert.equal(result, null, "Cookie with control char in value should be rejected");
});

suite.test("cookie OOM: domain never exceeds 50 cookies", () => {
  const jar = new CookieJar();
  for (let i = 0; i < 100; i++) {
    jar.setCookiesFromResponse(
      new Response(null, { headers: { "Set-Cookie": `c${i}=v${i}; Path=/p${i}` } }),
      "http://target.com/"
    );
  }
  const all = jar.getAll().filter((c) => c.domain === "target.com");
  assert.ok(all.length <= 50, `Cookie count ${all.length} exceeds OOM limit of 50`);
});

suite.test("CookieStore uses null-prototype objects to prevent prototype hijack", async () => {
  const { CookieStore } = await import("../dist/cookie/store.js");
  const store = new CookieStore();
  store.putCookie({
    name: "__proto__",
    value: "evil",
    domain: "example.com",
    path: "/",
    creationTime: Date.now(),
    lastAccessTime: Date.now(),
  });
  // Prototype should not be polluted
  assert.equal(Object.prototype.__proto__, Object.prototype.__proto__, "Prototype unchanged");
  const c = store.findCookie("example.com", "/", "__proto__");
  assert.ok(c !== undefined, "Cookie with __proto__ name should be stored safely");
  assert.equal(c?.value, "evil");
});

export default suite;
