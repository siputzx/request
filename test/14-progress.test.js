/**
 * 14 — Progress (Download)
 * Tests: onDownloadProgress called with increasing percent,
 *        final callback has percent=1, transferredBytes equals content,
 *        download with known content-length,
 *        download without content-length (streaming).
 */

import { TestSuite, MockServer, assert, assertEqual } from "./_harness.js";
import request from "../dist/index.js";

const suite = new TestSuite("14 · Progress (Download)");
const server = new MockServer();

suite.beforeEach(async () => { server.clearRequests(); });

suite.test("onDownloadProgress called at least once", async () => {
  const payload = Buffer.alloc(1024, "x");
  server.on("GET", "/dl-prog", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(payload.length),
    });
    res.end(payload);
  });

  let callCount = 0;
  await request.get(`${server.baseUrl}/dl-prog`, {
    retry: 0, timeout: 5000,
    onDownloadProgress: (progress, chunk) => {
      callCount++;
      assert(typeof progress.percent === "number", "percent should be number");
      assert(progress.transferredBytes >= 0, "transferredBytes should be >= 0");
      assert(progress.totalBytes >= 0, "totalBytes should be >= 0");
      assert(chunk instanceof Uint8Array, "chunk should be Uint8Array");
    },
  }).arrayBuffer();

  assert(callCount >= 1, `onDownloadProgress should have been called at least once, got ${callCount}`);
});

suite.test("final onDownloadProgress has percent === 1", async () => {
  const payload = Buffer.alloc(512, "a");
  server.on("GET", "/dl-final", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(payload.length),
    });
    res.end(payload);
  });

  let lastProgress = null;
  await request.get(`${server.baseUrl}/dl-final`, {
    retry: 0, timeout: 5000,
    onDownloadProgress: (progress) => { lastProgress = progress; },
  }).arrayBuffer();

  assert(lastProgress !== null, "at least one progress event");
  assertEqual(lastProgress.percent, 1, "final progress should be percent=1");
});

suite.test("transferredBytes equals actual content size", async () => {
  const size = 2048;
  const payload = Buffer.alloc(size, "z");
  server.on("GET", "/dl-bytes", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
    });
    res.end(payload);
  });

  let finalTransferred = 0;
  await request.get(`${server.baseUrl}/dl-bytes`, {
    retry: 0, timeout: 5000,
    onDownloadProgress: (progress) => { finalTransferred = progress.transferredBytes; },
  }).arrayBuffer();

  assertEqual(finalTransferred, size, `Expected ${size} transferred bytes, got ${finalTransferred}`);
});

suite.test("onDownloadProgress works without Content-Length header", async () => {
  const payload = Buffer.alloc(256, "n");
  server.on("GET", "/dl-nolen", (req, res) => {
    res.writeHead(200, { "Content-Type": "application/octet-stream" });
    res.end(payload);
  });

  let called = false;
  await request.get(`${server.baseUrl}/dl-nolen`, {
    retry: 0, timeout: 5000,
    onDownloadProgress: () => { called = true; },
  }).arrayBuffer();

  assert(called, "progress should fire even without Content-Length");
});

suite.test("percent stays within [0, 1] range throughout", async () => {
  const payload = Buffer.alloc(4096, "p");
  server.on("GET", "/dl-pct-range", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(payload.length),
    });
    // Send in small chunks to generate multiple progress events
    let offset = 0;
    const interval = setInterval(() => {
      const chunk = payload.slice(offset, offset + 256);
      if (chunk.length === 0) { clearInterval(interval); res.end(); return; }
      res.write(chunk);
      offset += 256;
    }, 5);
  });

  const percents = [];
  await request.get(`${server.baseUrl}/dl-pct-range`, {
    retry: 0, timeout: 5000,
    onDownloadProgress: (p) => { percents.push(p.percent); },
  }).arrayBuffer();

  for (const pct of percents) {
    assert(pct >= 0 && pct <= 1, `percent ${pct} out of range [0, 1]`);
  }
  assert(percents.length > 0, "should have recorded progress events");
});

export async function run() {
  await server.start();
  const result = await suite.run();
  await server.stop();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
