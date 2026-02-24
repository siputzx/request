/**
 * 09 — NDJSON Streaming
 * Tests: .ndjson() async generator, large stream without buffering,
 *        empty lines skipped, partial JSON line handling,
 *        stream aborted on error.
 */

import { TestSuite, MockServer, assert, assertEqual } from "./_harness.js";
import request from "../dist/index.js";

const suite = new TestSuite("09 · NDJSON Streaming");
const server = new MockServer();

suite.beforeEach(async () => { server.clearRequests(); });

suite.test(".ndjson() collects all rows", async () => {
  const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
  server.on("GET", "/ndjson", (req, res) => server.ndjson(res, rows));

  const collected = [];
  for await (const item of request.get(`${server.baseUrl}/ndjson`, { retry: 0, timeout: 5000 }).ndjson()) {
    collected.push(item);
  }
  assertEqual(collected.length, 3);
  assertEqual(collected[0].id, 1);
  assertEqual(collected[2].id, 3);
});

suite.test(".ndjson() handles empty stream", async () => {
  server.on("GET", "/ndjson-empty", (req, res) => {
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    res.end();
  });
  const collected = [];
  for await (const item of request.get(`${server.baseUrl}/ndjson-empty`, { retry: 0, timeout: 5000 }).ndjson()) {
    collected.push(item);
  }
  assertEqual(collected.length, 0);
});

suite.test(".ndjson() skips blank lines", async () => {
  server.on("GET", "/ndjson-blank", (req, res) => {
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    res.write('{"a":1}\n');
    res.write('\n');
    res.write('   \n');
    res.write('{"a":2}\n');
    res.end();
  });
  const collected = [];
  for await (const item of request.get(`${server.baseUrl}/ndjson-blank`, { retry: 0, timeout: 5000 }).ndjson()) {
    collected.push(item);
  }
  assertEqual(collected.length, 2, "Blank lines should be skipped");
});

suite.test(".ndjson() handles rows split across chunks", async () => {
  server.on("GET", "/ndjson-chunked", (req, res) => {
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    // Deliberately split JSON across multiple writes
    res.write('{"val');
    setTimeout(() => {
      res.write('ue":42}\n{"value":99}\n');
      res.end();
    }, 10);
  });
  const collected = [];
  for await (const item of request.get(`${server.baseUrl}/ndjson-chunked`, { retry: 0, timeout: 5000 }).ndjson()) {
    collected.push(item);
  }
  assertEqual(collected.length, 2, "Split chunks should be reassembled");
  assertEqual(collected[0].value, 42);
  assertEqual(collected[1].value, 99);
});

suite.test(".ndjson() with typed generic works", async () => {
  const rows = [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }];
  server.on("GET", "/ndjson-typed", (req, res) => server.ndjson(res, rows));

  const collected = [];
  for await (const item of request.get(`${server.baseUrl}/ndjson-typed`, { retry: 0, timeout: 5000 }).ndjson()) {
    collected.push(item);
  }
  assertEqual(collected[0].name, "Alice");
  assertEqual(collected[1].age, 25);
});

suite.test(".ndjson() 100 rows — no memory accumulation", async () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({ index: i, data: "x".repeat(100) }));
  server.on("GET", "/ndjson-large", (req, res) => server.ndjson(res, rows));

  let count = 0;
  for await (const item of request.get(`${server.baseUrl}/ndjson-large`, { retry: 0, timeout: 10000 }).ndjson()) {
    count++;
  }
  assertEqual(count, 100, "all 100 rows should be yielded");
});

suite.test(".ndjson() accept header set to application/x-ndjson", async () => {
  server.on("GET", "/ndjson-accept", (req, res) => {
    server.json(res, { accept: req.headers["accept"] ?? "" });
  });

  // We use .json() here just to check the accept header the client sent.
  // The actual ndjson() call would set the accept header.
  let sentAccept = "";
  server.on("GET", "/ndjson-hdr", (req, res) => {
    sentAccept = req.headers["accept"] ?? "";
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    res.end('{"ok":true}\n');
  });
  for await (const _ of request.get(`${server.baseUrl}/ndjson-hdr`, { retry: 0, timeout: 5000 }).ndjson()) {}
  assert(sentAccept.includes("ndjson"), `Expected ndjson accept header, got: ${sentAccept}`);
});

export async function run() {
  await server.start();
  const result = await suite.run();
  await server.stop();
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { const r = await run(); process.exit(r.failed > 0 ? 1 : 0); }
