// node --test (see package.json "test"); TypeScript sources are loaded with type stripping
import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIpSource, clientKey, createLeadLimiter, createRateLimiter } from "../lib/rate-limit.ts";

const clock = (start = 1_000_000) => {
  const c = { t: start, now: () => c.t };
  return c;
};

test("6th request within a minute is blocked, allowed again after the window", () => {
  const c = clock();
  const rl = createRateLimiter({ now: c.now, timer: false });
  for (let i = 0; i < 5; i++) assert.equal(rl.limited("a"), false);
  assert.equal(rl.limited("a"), true);
  c.t += 60_000;
  assert.equal(rl.limited("a"), false);
});

test("TTL: an idle IP is forgotten within the window (timer sweep)", () => {
  const c = clock();
  const rl = createRateLimiter({ now: c.now, timer: false });
  rl.limited("a");
  rl.limited("b");
  assert.equal(rl.size(), 2);
  c.t += 59_999;
  rl.sweep();
  assert.equal(rl.size(), 2, "still inside the window");
  c.t += 1;
  rl.sweep();
  assert.equal(rl.size(), 0, "forgotten exactly at the window");
});

test("TTL: lazy sweep on any request also drops idle IPs", () => {
  const c = clock();
  const rl = createRateLimiter({ now: c.now, timer: false });
  rl.limited("idle");
  c.t += 61_000;
  rl.limited("other");
  assert.equal(rl.size(), 1);
});

test("timer sweep runs on its own and does not keep the process alive", async () => {
  const rl = createRateLimiter({ windowMs: 20 });
  rl.limited("a");
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(rl.size(), 0);
});

test("memory: key cap evicts the least recently seen, others keep their counters", () => {
  const c = clock();
  const rl = createRateLimiter({ now: c.now, timer: false, maxKeys: 3 });
  rl.limited("d"); // d: 1
  rl.limited("e");
  rl.limited("f");
  rl.limited("d"); // d: 2, now most recent
  rl.limited("g"); // over cap → e (least recent) evicted
  assert.equal(rl.size(), 3);
  assert.equal(rl.stamps("e"), 0);
  for (let i = 0; i < 3; i++) rl.limited("d");
  assert.equal(rl.limited("d"), true, "d's counter survived eviction of others");
});

test("memory: a flooding IP keeps at most max + 1 timestamps and stays blocked", () => {
  const c = clock();
  const rl = createRateLimiter({ now: c.now, timer: false });
  for (let i = 0; i < 10_000; i++) {
    rl.limited("flood");
    c.t += 1;
  }
  assert.equal(rl.stamps("flood"), 6);
  assert.equal(rl.limited("flood"), true);
  c.t += 60_000;
  assert.equal(rl.limited("flood"), false, "released one window after the flood stops");
});

test("memory: 100 000 distinct IPs never exceed maxKeys", () => {
  const c = clock();
  const rl = createRateLimiter({ now: c.now, timer: false });
  for (let i = 0; i < 100_000; i++) rl.limited("10." + (i >> 16) + "." + ((i >> 8) & 255) + "." + (i & 255));
  assert.equal(rl.size(), 5000);
});

const h = (o) => new Headers(o);

test("source: no header is trusted unless RATE_LIMIT_CLIENT_IP says so", () => {
  assert.equal(clientIpSource(undefined), "none");
  assert.equal(clientIpSource(""), "none");
  assert.equal(clientIpSource("yes"), "none");
  assert.equal(clientIpSource(" X-Real-IP "), "x-real-ip");
  assert.equal(clientIpSource("x-forwarded-for"), "x-forwarded-for");
  assert.equal(clientKey(h({ "x-real-ip": "203.0.113.9" }), "none"), null, "untrusted → no per-client key");
});

test("x-real-ip source: the header as set by the edge; X-Forwarded-For is ignored", () => {
  assert.equal(clientKey(h({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1" }), "x-real-ip"), "203.0.113.9");
  assert.equal(clientKey(h({ "x-forwarded-for": "198.51.100.1" }), "x-real-ip"), "missing");
  assert.equal(clientKey(h({ "x-real-ip": "2001:db8::1" }), "x-real-ip"), "2001:db8::1");
});

test("x-forwarded-for source: only the rightmost entry; client-sent prefixes are ignored", () => {
  assert.equal(clientKey(h({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }), "x-forwarded-for"), "203.0.113.9");
  const a = clientKey(h({ "x-forwarded-for": "9.9.9.1, 203.0.113.9" }), "x-forwarded-for");
  const b = clientKey(h({ "x-forwarded-for": "9.9.9.2, 203.0.113.9" }), "x-forwarded-for");
  assert.equal(a, b);
  assert.equal(clientKey(h({ "x-real-ip": "1.2.3.4" }), "x-forwarded-for"), "missing", "X-Real-IP not consulted");
});

test("garbage or missing values share one key instead of minting new counters", () => {
  assert.equal(clientKey(h({ "x-real-ip": "random-" + Math.random() }), "x-real-ip"), "invalid");
  assert.equal(clientKey(h({ "x-forwarded-for": "1.1.1.1, not-an-ip" }), "x-forwarded-for"), "invalid");
  assert.equal(clientKey(h({}), "x-real-ip"), "missing");
});

const run = (limit, headersList) => headersList.map((x) => limit(h(x)));

test("fallback (no trusted source): rotating spoofed headers hit the global ceiling of 10", () => {
  const c = clock();
  const limit = createLeadLimiter({ source: "none", now: c.now, timer: false });
  const spoofed = Array.from({ length: 12 }, (_, i) => ({ "x-real-ip": "198.51.100." + i, "x-forwarded-for": "10.0.0." + i }));
  assert.deepEqual(run(limit, spoofed), [...Array(10).fill(false), true, true]);
  c.t += 60_000;
  assert.equal(limit(h({})), false, "released after the window");
});

test("trusted x-real-ip but a spoofable edge: spoofing is still capped by the global limit", () => {
  // worst case — the header turns out to be client-controlled
  const c = clock();
  const limit = createLeadLimiter({ source: "x-real-ip", now: c.now, timer: false });
  const spoofed = Array.from({ length: 15 }, (_, i) => ({ "x-real-ip": "198.51.100." + i }));
  assert.equal(run(limit, spoofed).filter((x) => !x).length, 10);
});

test("trusted source: one client gets 5, and its excess does not exhaust the shared allowance", () => {
  const c = clock();
  const limit = createLeadLimiter({ source: "x-real-ip", now: c.now, timer: false });
  const flood = run(limit, Array(50).fill({ "x-real-ip": "203.0.113.1" }));
  assert.deepEqual(flood.slice(0, 7), [false, false, false, false, false, true, true]);
  assert.equal(flood.filter((x) => !x).length, 5);
  // other visitors still get through: 10 − 5 = 5 shared slots left
  assert.deepEqual(run(limit, [{ "x-real-ip": "203.0.113.2" }, { "x-real-ip": "203.0.113.3" }]), [false, false]);
});

test("x-forwarded-for source: spoofed prefixes behind a proxy do not bypass the per-client limit", () => {
  const c = clock();
  const limit = createLeadLimiter({ source: "x-forwarded-for", now: c.now, timer: false });
  const r = run(limit, Array.from({ length: 7 }, (_, i) => ({ "x-forwarded-for": "10.0.0." + i + ", 203.0.113.9" })));
  assert.deepEqual(r, [false, false, false, false, false, true, true]);
});
