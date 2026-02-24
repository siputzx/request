/**
 * 07 — CookieStore
 * Tests: putCookie, findCookie, findCookiesForDomain, domain matching,
 *        path matching, expiry filtering, OOM eviction (MAX_COOKIES_PER_DOMAIN),
 *        removeCookie, removeAllCookies, getAllCookies.
 */

import { TestSuite, assert, assertEqual } from "./_harness.js";
import { CookieStore } from "../dist/index.js";

const suite = new TestSuite("07 · CookieStore");

function makeCookie(name, value, overrides = {}) {
  return {
    name,
    value,
    domain: "example.com",
    path: "/",
    creationTime: Date.now(),
    lastAccessTime: Date.now(),
    ...overrides,
  };
}

suite.test("putCookie and findCookie", () => {
  const store = new CookieStore();
  store.putCookie(makeCookie("sid", "abc"));
  const found = store.findCookie("example.com", "/", "sid");
  assert(found !== undefined, "cookie should be found");
  assertEqual(found.value, "abc");
});

suite.test("findCookie returns undefined for unknown", () => {
  const store = new CookieStore();
  const result = store.findCookie("example.com", "/", "nope");
  assertEqual(result, undefined);
});

suite.test("findCookiesForDomain — basic retrieval", () => {
  const store = new CookieStore();
  store.putCookie(makeCookie("a", "1"));
  store.putCookie(makeCookie("b", "2"));
  const cookies = store.findCookiesForDomain("example.com", "/");
  assert(cookies.length === 2, `Expected 2, got ${cookies.length}`);
});

suite.test("findCookiesForDomain — path filtering", () => {
  const store = new CookieStore();
  store.putCookie(makeCookie("root", "1", { path: "/" }));
  store.putCookie(makeCookie("api", "2", { path: "/api" }));
  const root = store.findCookiesForDomain("example.com", "/public");
  assert(root.some((c) => c.name === "root"), "root cookie should match /public");
  assert(!root.some((c) => c.name === "api"), "api cookie should not match /public");
});

suite.test("findCookiesForDomain — subdomain matching", () => {
  const store = new CookieStore();
  store.putCookie(makeCookie("parent", "1", { domain: "example.com", path: "/", hostOnly: false }));
  const cookies = store.findCookiesForDomain("sub.example.com", "/");
  assert(cookies.some((c) => c.name === "parent"), "parent domain cookie should match subdomain");
});

suite.test("expired cookie via maxAge not returned", () => {
  const store = new CookieStore();
  store.putCookie(makeCookie("dead", "x", {
    maxAge: 1,
    creationTime: Date.now() - 5000,
  }));
  const cookies = store.findCookiesForDomain("example.com", "/");
  assert(!cookies.some((c) => c.name === "dead"), "expired cookie should not be returned");
});

suite.test("expired cookie via Expires date not returned", () => {
  const store = new CookieStore();
  store.putCookie(makeCookie("old", "x", {
    expires: new Date(Date.now() - 1000),
  }));
  const cookies = store.findCookiesForDomain("example.com", "/");
  assert(!cookies.some((c) => c.name === "old"), "past-expires cookie should not be returned");
});

suite.test("overwrite existing cookie", () => {
  const store = new CookieStore();
  store.putCookie(makeCookie("tok", "first"));
  store.putCookie(makeCookie("tok", "second"));
  const found = store.findCookie("example.com", "/", "tok");
  assertEqual(found.value, "second");
});

suite.test("removeCookie removes it", () => {
  const store = new CookieStore();
  store.putCookie(makeCookie("del", "yes"));
  store.removeCookie("example.com", "/", "del");
  const found = store.findCookie("example.com", "/", "del");
  assertEqual(found, undefined);
});

suite.test("removeAllCookies clears everything", () => {
  const store = new CookieStore();
  store.putCookie(makeCookie("a", "1"));
  store.putCookie(makeCookie("b", "2", { domain: "other.com" }));
  store.removeAllCookies();
  assertEqual(store.getAllCookies().length, 0);
});

suite.test("getAllCookies returns all non-expired cookies", () => {
  const store = new CookieStore();
  store.putCookie(makeCookie("x", "1"));
  store.putCookie(makeCookie("y", "2", { domain: "other.com" }));
  store.putCookie(makeCookie("z", "3", { expires: new Date(Date.now() - 1) }));
  const all = store.getAllCookies();
  assertEqual(all.length, 2, "expired cookie should not appear in getAllCookies");
});

suite.test("OOM protection — MAX_COOKIES_PER_DOMAIN (50) triggers eviction", () => {
  const store = new CookieStore();
  for (let i = 0; i < 60; i++) {
    store.putCookie(makeCookie(`c${i}`, String(i)));
  }
  const all = store.getAllCookies().filter((c) => c.domain === "example.com");
  assert(all.length <= 50, `Expect <= 50 cookies per domain, got ${all.length}`);
});

suite.test("OOM eviction removes oldest cookie first", () => {
  const store = new CookieStore();
  const base = Date.now();
  for (let i = 0; i < 50; i++) {
    store.putCookie(makeCookie(`c${i}`, String(i), { creationTime: base + i }));
  }
  store.putCookie(makeCookie("newest", "yes", { creationTime: base + 1000 }));
  const all = store.getAllCookies();
  assert(!all.some((c) => c.name === "c0"), "oldest cookie (c0) should have been evicted");
  assert(all.some((c) => c.name === "newest"), "newest cookie should be present");
});

suite.test("cookies across domains do not interfere", () => {
  const store = new CookieStore();
  store.putCookie(makeCookie("tok", "A", { domain: "alpha.com" }));
  store.putCookie(makeCookie("tok", "B", { domain: "beta.com" }));
  const a = store.findCookie("alpha.com", "/", "tok");
  const b = store.findCookie("beta.com", "/", "tok");
  assertEqual(a?.value, "A");
  assertEqual(b?.value, "B");
});

export async function run() {
  const result = await suite.run();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
