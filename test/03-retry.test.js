/**
 * Test: Retry — exponential backoff with jitter, statusCodes, Retry-After, limit
 */

import { createServer, assert, TestSuite } from "./_server.js";
import request from "../dist/index.js";

const suite = new TestSuite("Retry & Exponential Backoff");

suite.test("retries on 503 and succeeds on 3rd attempt", async () => {
  let attempts = 0;
  const { baseUrl, close } = await createServer({
    "GET /flaky": (req, res) => {
      attempts++;
      if (attempts < 3) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unavailable" }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      }
    },
  });
  try {
    const data = await request
      .get(`${baseUrl}/flaky`, {
        retry: { limit: 3, statusCodes: [503], delay: () => 10 },
      })
      .json();
    assert.equal(data.ok, true);
    assert.equal(attempts, 3);
  } finally {
    await close();
  }
});

suite.test("throws after exceeding retry limit", async () => {
  let attempts = 0;
  const { baseUrl, close } = await createServer({
    "GET /fail": (req, res) => {
      attempts++;
      res.writeHead(500);
      res.end("error");
    },
  });
  try {
    await assert.rejects(
      () =>
        request.get(`${baseUrl}/fail`, {
          retry: { limit: 2, statusCodes: [500], delay: () => 5 },
        }),
      "Expected to throw after retry limit"
    );
    // 1 initial + 2 retries = 3 total
    assert.equal(attempts, 3);
  } finally {
    await close();
  }
});

suite.test("does not retry on 4xx errors outside statusCodes", async () => {
  let attempts = 0;
  const { baseUrl, close } = await createServer({
    "GET /notfound": (req, res) => {
      attempts++;
      res.writeHead(404);
      res.end("not found");
    },
  });
  try {
    await assert.rejects(() =>
      request.get(`${baseUrl}/notfound`, {
        retry: { limit: 3, statusCodes: [500, 503], delay: () => 5 },
      })
    );
    assert.equal(attempts, 1, "Should not retry on 404");
  } finally {
    await close();
  }
});

suite.test("respects Retry-After header (seconds)", async () => {
  let attempts = 0;
  const start = Date.now();
  const { baseUrl, close } = await createServer({
    "GET /ratelimit": (req, res) => {
      attempts++;
      if (attempts === 1) {
        res.writeHead(429, { "Retry-After": "0", "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "rate limited" }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      }
    },
  });
  try {
    const data = await request
      .get(`${baseUrl}/ratelimit`, {
        retry: { limit: 2, statusCodes: [429], afterStatusCodes: [429], delay: () => 5 },
      })
      .json();
    assert.equal(data.ok, true);
    assert.equal(attempts, 2);
  } finally {
    await close();
  }
});

suite.test("beforeRetry hook is called with correct retryCount", async () => {
  let hookCalls = [];
  let attempts = 0;
  const { baseUrl, close } = await createServer({
    "GET /hook-retry": (req, res) => {
      attempts++;
      if (attempts < 3) {
        res.writeHead(503);
        res.end();
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ done: true }));
      }
    },
  });
  try {
    await request
      .get(`${baseUrl}/hook-retry`, {
        retry: { limit: 3, statusCodes: [503], delay: () => 5 },
        hooks: {
          beforeRetry: [({ retryCount }) => { hookCalls.push(retryCount); }],
        },
      })
      .json();
    assert.deepEqual(hookCalls, [1, 2]);
  } finally {
    await close();
  }
});

suite.test("retry with shouldRetry callback — abort early", async () => {
  let attempts = 0;
  const { baseUrl, close } = await createServer({
    "GET /custom-retry": (req, res) => {
      attempts++;
      res.writeHead(503);
      res.end();
    },
  });
  try {
    await assert.rejects(() =>
      request.get(`${baseUrl}/custom-retry`, {
        retry: {
          limit: 5,
          statusCodes: [503],
          delay: () => 5,
          shouldRetry: ({ retryCount }) => retryCount < 2,
        },
      })
    );
    // retryCount=1 -> shouldRetry(1<2)=true -> retry attempt 2
    // retryCount=2 -> shouldRetry(2<2)=false -> throw
    // Total = 1 initial + 1 retry = 2
    assert.equal(attempts, 2, "Initial + 1 allowed retry");
  } finally {
    await close();
  }
});

suite.test("does not retry on POST by default", async () => {
  let attempts = 0;
  const { baseUrl, close } = await createServer({
    "POST /post-fail": (req, res) => {
      attempts++;
      res.writeHead(503);
      res.end();
    },
  });
  try {
    await assert.rejects(() =>
      request.post(`${baseUrl}/post-fail`, {
        json: {},
        retry: { limit: 3, statusCodes: [503], delay: () => 5 },
      })
    );
    assert.equal(attempts, 1, "POST should not be retried by default");
  } finally {
    await close();
  }
});

export default suite;
