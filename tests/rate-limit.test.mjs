// node --test (see package.json "test"); TypeScript sources are loaded with type stripping
import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, createRateLimiter } from "../lib/rate-limit.ts";

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

test("clientIp: X-Real-IP (set by Railway's edge) wins over X-Forwarded-For", () => {
  assert.equal(clientIp(h({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1" })), "203.0.113.9");
});

test("clientIp: only the rightmost X-Forwarded-For entry is used — client-sent entries are ignored", () => {
  // the client sends "1.1.1.1"; the proxy appends the real address
  assert.equal(clientIp(h({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" })), "203.0.113.9");
  // rotating spoofed prefixes map to the same bucket
  const a = clientIp(h({ "x-forwarded-for": "9.9.9.1, 203.0.113.9" }));
  const b = clientIp(h({ "x-forwarded-for": "9.9.9.2, 203.0.113.9" }));
  assert.equal(a, b);
});

test("clientIp: garbage values share one bucket instead of minting new counters", () => {
  assert.equal(clientIp(h({ "x-real-ip": "random-" + Math.random() })), "invalid");
  assert.equal(clientIp(h({ "x-forwarded-for": "1.1.1.1, not-an-ip" })), "invalid");
  assert.equal(clientIp(h({})), "unknown");
  assert.equal(clientIp(h({ "x-real-ip": "2001:db8::1" })), "2001:db8::1");
});

test("spoofed X-Forwarded-For behind a proxy does not bypass the limit", () => {
  const c = clock();
  const rl = createRateLimiter({ now: c.now, timer: false });
  const results = [];
  for (let i = 0; i < 7; i++) results.push(rl.limited(clientIp(h({ "x-forwarded-for": "10.0.0." + i + ", 203.0.113.9" }))));
  assert.deepEqual(results, [false, false, false, false, false, true, true]);
});
