/**
 * 06 — Cookie Parser
 * Tests: parseSetCookieString edge cases, splitCookiesString, extractSetCookieHeaders,
 *        control char rejection, Max-Age, Expires, Path, Domain, Secure, HttpOnly,
 *        SameSite, Partitioned, value decoding, empty name.
 */

import { TestSuite, assert, assertEqual } from "./_harness.js";
import {
  parseSetCookieString,
  splitCookiesString,
  extractSetCookieHeaders,
} from "../dist/index.js";

const suite = new TestSuite("06 · Cookie Parser");

suite.test("basic name=value", () => {
  const c = parseSetCookieString("session=abc");
  assert(c !== null, "should parse");
  assertEqual(c.name, "session");
  assertEqual(c.value, "abc");
});

suite.test("value with URL encoding", () => {
  const c = parseSetCookieString("tok=hello%20world");
  assertEqual(c.value, "hello world");
});

suite.test("empty name (value-only cookie)", () => {
  const c = parseSetCookieString("noname");
  assert(c !== null, "should parse");
  assertEqual(c.name, "");
  assertEqual(c.value, "noname");
});

suite.test("Max-Age parsed as number", () => {
  const c = parseSetCookieString("x=1; Max-Age=3600");
  assert(c !== null);
  assertEqual(c.maxAge, 3600);
});

suite.test("Max-Age=0 parsed correctly", () => {
  const c = parseSetCookieString("x=1; Max-Age=0");
  assert(c !== null);
  assertEqual(c.maxAge, 0);
});

suite.test("Expires parsed as Date", () => {
  const c = parseSetCookieString("x=1; Expires=Wed, 01 Jan 2099 00:00:00 GMT");
  assert(c !== null);
  assert(c.expires instanceof Date, "expires should be Date");
  assert(c.expires.getFullYear() === 2099, "wrong year");
});

suite.test("Domain lowercased and dot-stripped", () => {
  const c = parseSetCookieString("x=1; Domain=.Example.COM");
  assert(c !== null);
  assertEqual(c.domain, "example.com");
});

suite.test("Path attribute", () => {
  const c = parseSetCookieString("x=1; Path=/api");
  assert(c !== null);
  assertEqual(c.path, "/api");
});

suite.test("Secure flag", () => {
  const c = parseSetCookieString("x=1; Secure");
  assert(c !== null);
  assertEqual(c.secure, true);
});

suite.test("HttpOnly flag", () => {
  const c = parseSetCookieString("x=1; HttpOnly");
  assert(c !== null);
  assertEqual(c.httpOnly, true);
});

suite.test("SameSite attribute", () => {
  const c = parseSetCookieString("x=1; SameSite=Strict");
  assert(c !== null);
  assertEqual(c.sameSite, "Strict");
});

suite.test("Partitioned flag", () => {
  const c = parseSetCookieString("x=1; Partitioned");
  assert(c !== null);
  assertEqual(c.partitioned, true);
});

suite.test("all attributes combined", () => {
  const c = parseSetCookieString(
    "tok=xyz; Domain=example.com; Path=/; Max-Age=86400; Secure; HttpOnly; SameSite=Lax"
  );
  assert(c !== null);
  assertEqual(c.name, "tok");
  assertEqual(c.domain, "example.com");
  assertEqual(c.path, "/");
  assertEqual(c.maxAge, 86400);
  assertEqual(c.secure, true);
  assertEqual(c.httpOnly, true);
  assertEqual(c.sameSite, "Lax");
});

suite.test("control chars in name returns null", () => {
  const c = parseSetCookieString("na\x01me=val");
  assertEqual(c, null);
});

suite.test("control chars in value returns null", () => {
  const c = parseSetCookieString("name=va\x00l");
  assertEqual(c, null);
});

suite.test("null / empty input returns null", () => {
  assertEqual(parseSetCookieString(""), null);
  assertEqual(parseSetCookieString("   "), null);
});

suite.test("newline terminators in header cause rejection (security)", () => {
  // \r\n in cookie string are treated as control chars and the cookie is rejected
  // This prevents header injection via Set-Cookie values
  const c = parseSetCookieString("a=b\r\nSet-Cookie: inject=1");
  assertEqual(c, null, "cookie with CRLF should be rejected entirely");
});

suite.test("creationTime and lastAccessTime set", () => {
  const before = Date.now();
  const c = parseSetCookieString("x=1");
  const after = Date.now();
  assert(c !== null);
  assert(c.creationTime >= before && c.creationTime <= after, "creationTime out of range");
  assert(c.lastAccessTime >= before && c.lastAccessTime <= after, "lastAccessTime out of range");
});

suite.test("splitCookiesString — array passthrough", () => {
  const result = splitCookiesString(["a=1", "b=2"]);
  assertEqual(result.length, 2);
  assertEqual(result[0], "a=1");
});

suite.test("splitCookiesString — single cookie string", () => {
  const result = splitCookiesString("a=1; Path=/");
  assertEqual(result.length, 1);
  assertEqual(result[0], "a=1; Path=/");
});

suite.test("splitCookiesString — two cookies with comma (not date)", () => {
  const result = splitCookiesString("a=1; Path=/, b=2; Path=/");
  assertEqual(result.length, 2);
});

suite.test("extractSetCookieHeaders — uses getSetCookie when available", () => {
  const headers = new Headers();
  headers.append("set-cookie", "a=1");
  headers.append("set-cookie", "b=2");
  const result = extractSetCookieHeaders(headers);
  assert(Array.isArray(result), "should return array");
  assert(result.length >= 1, "should have at least one entry");
});

suite.test("value truncated beyond MAX_COOKIE_VALUE_LENGTH", () => {
  const longValue = "x".repeat(5000);
  const c = parseSetCookieString(`tok=${longValue}`);
  assertEqual(c, null, "should reject oversized cookie values");
});

export async function run() {
  const result = await suite.run();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
