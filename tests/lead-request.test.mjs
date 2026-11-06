import assert from "node:assert/strict";
import { test } from "node:test";
import { readLeadRequest } from "../lib/lead-request.ts";

const request = (body, headers = {}) => new Request("http://localhost/api/lead", {
  method: "POST", body, headers: { "Content-Type": "application/json", ...headers },
});
const bad = { ok: false, status: 400, error: "bad_request" };
const large = { ok: false, status: 413, error: "too_large" };

for (const body of ["null", "[]", '[{"name":"Test"}]', '"text"', "123", "true", "false", "", "{", '{"name":}']) {
  test(`rejects invalid JSON/shape: ${body || "empty"}`, async () => {
    assert.deepEqual(await readLeadRequest(request(body), 10000), bad);
  });
}

for (const field of ["name", "phone", "task", "company", "direction", "page", "website", "consent"]) {
  test(`rejects incorrect type of ${field}`, async () => {
    assert.deepEqual(await readLeadRequest(request(JSON.stringify({ [field]: [] })), 10000), bad);
  });
}

test("preserves valid input and optional attribution for subsequent validation", async () => {
  const body = { name: "Иван", phone: "@username", task: "Описание задачи", consent: true, website: "", attribution: { utm_source: "test" } };
  assert.deepEqual(await readLeadRequest(request(JSON.stringify(body)), 10000), { ok: true, body });
  assert.deepEqual(await readLeadRequest(request("{}"), 10000), { ok: true, body: {} });
});

test("rejects advertised oversized bodies before reading the stream", async () => {
  assert.deepEqual(await readLeadRequest(request("{}", { "Content-Length": "40001" }), 10000), large);
});

test("enforces character limit without Content-Length", async () => {
  assert.deepEqual(await readLeadRequest(request(JSON.stringify({ task: "x".repeat(10000) })), 10000), large);
});

test("does not trust an understated Content-Length", async () => {
  assert.deepEqual(await readLeadRequest(request('"' + "x".repeat(101) + '"', { "Content-Length": "2" }), 100), large);
});

test("rejects missing bodies and malformed Content-Length", async () => {
  assert.deepEqual(await readLeadRequest(request(undefined), 100), bad);
  assert.deepEqual(await readLeadRequest(request("{}", { "Content-Length": "invalid" }), 100), bad);
});

test("allows a JSON body exactly at the character limit", async () => {
  const raw = JSON.stringify({ task: "я".repeat(89) });
  assert.equal(raw.length, 100);
  assert.equal((await readLeadRequest(request(raw), 100)).ok, true);
});

test("cancels an oversized chunked body instead of buffering the remainder", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(401)); },
    cancel() { cancelled = true; },
  });
  const req = new Request("http://localhost/api/lead", { method: "POST", body: stream, duplex: "half" });
  assert.deepEqual(await readLeadRequest(req, 100), large);
  assert.equal(cancelled, true);
});

test("handles UTF-8 sequences split across chunks", async () => {
  const bytes = new TextEncoder().encode('{"name":"Иван"}');
  const stream = new ReadableStream({ start(c) {
    for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
    c.close();
  } });
  const req = new Request("http://localhost/api/lead", { method: "POST", body: stream, duplex: "half" });
  assert.deepEqual(await readLeadRequest(req, 100), { ok: true, body: { name: "Иван" } });
});

test("rejects invalid UTF-8 and broken streams with a controlled response", async () => {
  assert.deepEqual(await readLeadRequest(request(new Uint8Array([255])), 100), bad);
  const stream = new ReadableStream({ start(c) { c.error(new Error("disconnected")); } });
  assert.deepEqual(await readLeadRequest(new Request("http://localhost/api/lead", {
    method: "POST", body: stream, duplex: "half",
  }), 100), bad);
});
