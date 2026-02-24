/**
 * 15 — Smart Redirect
 * Tests: Set-Cookie preserved across 302, maxRedirects limit, POST→GET on 303.
 */

import { TestSuite, MockServer, assert, assertEqual } from "./_harness.js";
import request, { CookieJar } from "../dist/index.js";

const suite = new TestSuite("15 · Smart Redirect");
const server = new MockServer();

suite.beforeEach(async () => { server.clearRequests(); });

suite.test("302 — Set-Cookie from redirect hop is stored and forwarded", async () => {
  const jar = new CookieJar();
  const session = request.extend({ cookieJar: jar, throwHttpErrors: false });

  server.on("GET", "/redir-login", (req, res) => {
    res.writeHead(302, {
      "Location": `${server.baseUrl}/redir-dashboard`,
      "Set-Cookie": "session=abc123; Path=/",
    });
    res.end();
  });

  server.on("GET", "/redir-dashboard", (req, res) => {
    const cookie = req.headers["cookie"] ?? "";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ cookie }));
  });

  const data = await session.get(`${server.baseUrl}/redir-login`).json();
  assert(data.cookie.includes("session=abc123"), `Cookie should be forwarded to redirect destination, got: "${data.cookie}"`);
});

suite.test("maxRedirects — throws error when redirect limit exceeded", async () => {
  const jar = new CookieJar();
  const session = request.extend({ cookieJar: jar, throwHttpErrors: false });

  server.on("GET", "/loop1", (req, res) => {
    res.writeHead(302, { "Location": `${server.baseUrl}/loop2` });
    res.end();
  });
  server.on("GET", "/loop2", (req, res) => {
    res.writeHead(302, { "Location": `${server.baseUrl}/loop3` });
    res.end();
  });
  server.on("GET", "/loop3", (req, res) => {
    res.writeHead(302, { "Location": `${server.baseUrl}/loop1` });
    res.end();
  });

  let threw = false;
  try {
    await session.get(`${server.baseUrl}/loop1`, { maxRedirects: 2 });
  } catch (err) {
    threw = true;
    assert(err.message.includes("Maximum redirects"), `Expected max redirects error, got: ${err.message}`);
  }
  assert(threw, "Should throw when maxRedirects is exceeded");
});

suite.test("303 — POST redirected as GET", async () => {
  const jar = new CookieJar();
  const session = request.extend({ cookieJar: jar, throwHttpErrors: false });

  server.on("POST", "/form-submit", (req, res) => {
    res.writeHead(303, { "Location": `${server.baseUrl}/form-result` });
    res.end();
  });

  server.on("GET", "/form-result", (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ method: req.method }));
  });

  const data = await session.post(`${server.baseUrl}/form-submit`, {
    json: { form: "data" },
  }).json();

  assertEqual(data.method, "GET", "After 303, method should switch to GET");
});

export async function run() {
  await server.start();
  const result = await suite.run();
  await server.stop();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
