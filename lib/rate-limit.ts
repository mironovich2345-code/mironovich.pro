import { isIP } from "node:net";

/**
 * Fixed-window rate limiter kept in process memory.
 *
 * - Every IP is forgotten at most `windowMs` after its last request: a sweep runs
 *   on a timer and on each call, so addresses never linger until a restart.
 * - Memory is bounded: at most `maxKeys` addresses (least recently seen evicted
 *   first, not everyone at once) and at most `max + 1` timestamps per address,
 *   however hard one address floods.
 *
 * Limits of an in-memory limiter (see docs/release/rate-limit.md): counters live
 * in one process, so each replica counts on its own (N replicas ≈ N × max) and a
 * restart or deploy resets them. Enough to stop casual spam; abuse at scale
 * belongs at the edge (proxy / WAF) or in a shared store.
 */
export function createRateLimiter({
  windowMs = 60_000,
  max = 5,
  maxKeys = 5000,
  now = () => Date.now(),
  timer = true,
}: { windowMs?: number; max?: number; maxKeys?: number; now?: () => number; timer?: boolean } = {}) {
  // insertion order = recency: an IP is re-inserted on every request
  const hits = new Map<string, number[]>();
  let lastSweep = 0;

  const sweep = (t = now()) => {
    for (const [ip, times] of hits) {
      if (t - times[times.length - 1] >= windowMs) hits.delete(ip);
    }
    lastSweep = t;
  };

  if (timer) {
    const id = setInterval(() => sweep(), windowMs);
    // never keep the process alive just for this
    (id as { unref?: () => void }).unref?.();
  }

  const limited = (ip: string): boolean => {
    const t = now();
    if (t - lastSweep >= windowMs) sweep(t);
    const recent = (hits.get(ip) ?? []).filter((x) => t - x < windowMs);
    recent.push(t);
    // only "more than max" matters — keep the newest max + 1 stamps
    if (recent.length > max + 1) recent.splice(0, recent.length - (max + 1));
    hits.delete(ip);
    hits.set(ip, recent);
    while (hits.size > maxKeys) hits.delete(hits.keys().next().value as string);
    return recent.length > max;
  };

  return { limited, sweep, size: () => hits.size, stamps: (ip: string) => hits.get(ip)?.length ?? 0 };
}

/**
 * Client address for rate limiting.
 *
 * Railway's edge overwrites X-Real-IP and X-Forwarded-For on every request it
 * forwards, so X-Real-IP is the client address for public traffic. Without it,
 * only the RIGHTMOST X-Forwarded-For entry is used — the one appended by the
 * nearest proxy; leftmost entries are whatever the client sent. Anything that is
 * not a valid IP (or no header at all) falls into one shared bucket, so made-up
 * header values cannot mint fresh counters.
 *
 * Assumes the app is reachable only through the edge. A request that reaches the
 * port directly (private network, TCP proxy, local `next start`) can set these
 * headers itself — see docs/release/rate-limit.md.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return isIP(real) ? real : "invalid";
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").pop()?.trim() ?? "";
    return isIP(last) ? last : "invalid";
  }
  return "unknown";
}
