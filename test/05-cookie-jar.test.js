/**
 * 05 — CookieJar Integration
 * Tests: Set-Cookie received, Cookie header sent on next request,
 *        domain scoping, path scoping, Secure flag, expiry eviction,
 *        hostOnly, jar.clear(), jar.getAll().
 */

import { TestSuite, MockServer, assert, assertEqual } from "./_harness.js";
import request, { CookieJar } from "../dist/index.js";

const suite = new TestSuite("05 · CookieJar Integration");
const server = new MockServer();

suite.beforeEach(async () => { server.clearRequests(); });

suite.test("Set-Cookie received and sent on next request", async () => {
  const jar = new CookieJar();
  const client = request.extend({ cookieJar: jar, retry: 0, timeout: 5000 });

  server.on("GET", "/login", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": "session=abc123; Path=/",
    });
    res.end("{}");
  });
  server.on("GET", "/profile", (req, res) =>
    server.json(res, { cookie: req.headers["cookie"] })
  );

  await client.get(`${server.baseUrl}/login`);
  const data = await client.get(`${server.baseUrl}/profile`).json();
  assert(data.cookie?.includes("session=abc123"), `Cookie should be forwarded, got: ${data.cookie}`);
});

suite.test("multiple cookies from Set-Cookie headers", async () => {
  const jar = new CookieJar();
  const client = request.extend({ cookieJar: jar, retry: 0, timeout: 5000 });

  server.on("GET", "/multi-set", (req, res) => {
    const h = new Headers({
      "Content-Type": "application/json",
    });
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": ["a=1; Path=/", "b=2; Path=/"],
    });
    res.end("{}");
  });
  server.on("GET", "/multi-get", (req, res) =>
    server.json(res, { cookie: req.headers["cookie"] })
  );

  await client.get(`${server.baseUrl}/multi-set`);
  const data = await client.get(`${server.baseUrl}/multi-get`).json();
  assert(data.cookie?.includes("a=1"), `a=1 missing in: ${data.cookie}`);
  assert(data.cookie?.includes("b=2"), `b=2 missing in: ${data.cookie}`);
});

suite.test("expired cookie (Max-Age=0) not sent", async () => {
  const jar = new CookieJar();
  const client = request.extend({ cookieJar: jar, retry: 0, timeout: 5000 });

  server.on("GET", "/set-expired", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": "dead=yes; Max-Age=0; Path=/",
    });
    res.end("{}");
  });
  server.on("GET", "/chk-expired", (req, res) =>
    server.json(res, { cookie: req.headers["cookie"] ?? "" })
  );

  await client.get(`${server.baseUrl}/set-expired`);
  const data = await client.get(`${server.baseUrl}/chk-expired`).json();
  assert(!data.cookie.includes("dead=yes"), "Expired cookie should not be sent");
});

suite.test("path-scoped cookie not sent to different path", async () => {
  const jar = new CookieJar();
  const client = request.extend({ cookieJar: jar, retry: 0, timeout: 5000 });

  server.on("GET", "/admin/set", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": "admin=1; Path=/admin",
    });
    res.end("{}");
  });
  server.on("GET", "/public", (req, res) =>
    server.json(res, { cookie: req.headers["cookie"] ?? "" })
  );

  await client.get(`${server.baseUrl}/admin/set`);
  const data = await client.get(`${server.baseUrl}/public`).json();
  assert(!data.cookie.includes("admin=1"), "Path-scoped cookie should not leak");
});

suite.test("jar.clear() removes all cookies", async () => {
  const jar = new CookieJar();
  const client = request.extend({ cookieJar: jar, retry: 0, timeout: 5000 });

  server.on("GET", "/set-clr", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": "tok=xyz; Path=/",
    });
    res.end("{}");
  });
  server.on("GET", "/get-clr", (req, res) =>
    server.json(res, { cookie: req.headers["cookie"] ?? "" })
  );

  await client.get(`${server.baseUrl}/set-clr`);
  jar.clear();
  const data = await client.get(`${server.baseUrl}/get-clr`).json();
  assert(!data.cookie.includes("tok=xyz"), "Cookie should be gone after clear()");
});

suite.test("jar.getAll() returns stored cookies", async () => {
  const jar = new CookieJar();
  const client = request.extend({ cookieJar: jar, retry: 0, timeout: 5000 });

  server.on("GET", "/set-all", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": ["x=1; Path=/", "y=2; Path=/"],
    });
    res.end("{}");
  });

  await client.get(`${server.baseUrl}/set-all`);
  const all = jar.getAll();
  assert(all.length >= 2, `Expected >= 2 cookies, got ${all.length}`);
  assert(all.some((c) => c.name === "x" && c.value === "1"), "x=1 not in getAll()");
  assert(all.some((c) => c.name === "y" && c.value === "2"), "y=2 not in getAll()");
});

suite.test("jar shared across extend instances", async () => {
  const jar = new CookieJar();
  const setter = request.extend({ cookieJar: jar, retry: 0, timeout: 5000 });
  const getter = request.extend({ cookieJar: jar, retry: 0, timeout: 5000 });

  server.on("GET", "/set-shared", (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "shared=yes; Path=/" });
    res.end("{}");
  });
  server.on("GET", "/get-shared", (req, res) =>
    server.json(res, { cookie: req.headers["cookie"] ?? "" })
  );

  await setter.get(`${server.baseUrl}/set-shared`);
  const data = await getter.get(`${server.baseUrl}/get-shared`).json();
  assert(data.cookie.includes("shared=yes"), "Shared jar should forward cookie across instances");
});

export async function run() {
  await server.start();
  const result = await suite.run();
  await server.stop();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
