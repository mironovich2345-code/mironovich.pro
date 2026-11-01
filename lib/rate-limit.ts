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

/** Where the client address comes from. Set only after it was verified on staging. */
export type ClientIpSource = "x-real-ip" | "x-forwarded-for" | "none";

/** Reads RATE_LIMIT_CLIENT_IP. Anything else — including unset — means "none": no header is trusted. */
export function clientIpSource(value: string | undefined): ClientIpSource {
  const v = (value ?? "").trim().toLowerCase();
  return v === "x-real-ip" || v === "x-forwarded-for" ? v : "none";
}

/**
 * Client key for the per-client limit, or null when the address cannot be trusted.
 *
 * Request headers are client-controlled unless a proxy in front overwrites them,
 * so none is trusted by default (`none` → null → only the global limit applies).
 * After a staging test confirms that Railway's edge overwrites the header
 * (docs/release/rate-limit.md), set RATE_LIMIT_CLIENT_IP:
 * - `x-real-ip` — the header as set by the edge;
 * - `x-forwarded-for` — its RIGHTMOST entry (appended by the nearest proxy;
 *   leftmost entries are whatever the client sent).
 * A value that is not an IP address, or a missing header, yields one shared
 * key, so made-up values cannot mint fresh counters.
 */
export function clientKey(headers: Headers, source: ClientIpSource): string | null {
  if (source === "none") return null;
  const raw =
    source === "x-real-ip"
      ? headers.get("x-real-ip")?.trim()
      : headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  if (!raw) return "missing";
  return isIP(raw) ? raw : "invalid";
}

/**
 * The form's two-level limit:
 * 1. per client — `perClient` a window, only when the client address is trusted;
 * 2. for everyone together — `overall` accepted attempts a window, whatever the
 *    headers say: the hard ceiling when per-client keys are spoofed or unavailable.
 * A client already over its own limit does not use up the shared allowance.
 */
export function createLeadLimiter({
  source,
  perClient = 5,
  overall = 10,
  windowMs = 60_000,
  now,
  timer = true,
}: { source: ClientIpSource; perClient?: number; overall?: number; windowMs?: number; now?: () => number; timer?: boolean }) {
  const clients = createRateLimiter({ windowMs, max: perClient, maxKeys: 5000, now, timer });
  const everyone = createRateLimiter({ windowMs, max: overall, maxKeys: 1, now, timer });
  return (headers: Headers): boolean => {
    const key = clientKey(headers, source);
    if (key !== null && clients.limited(key)) return true;
    return everyone.limited("*");
  };
}
