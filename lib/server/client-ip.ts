// The visitor's IP address for rate limits (email codes, sign-in), from sources the infrastructure guarantees.
//
// Measured on Railway (stage 1.5): the Railway edge OVERWRITES X-Real-IP and X-Forwarded-For with the address that
// opened the connection — values sent by a visitor never reach the service. Headers such as CF-Connecting-IP are
// passed through unchanged, so a visitor can put anything there.
//
// mironovich.pro is proxied by Cloudflare, so in production the connecting address (X-Real-IP) is a Cloudflare edge.
// Only then is CF-Connecting-IP (set by Cloudflare, overwriting the visitor's own) trusted. A request that reaches
// Railway directly, bypassing Cloudflare, has its own address in X-Real-IP and its CF-Connecting-IP is ignored.
// X-Forwarded-For is never read: its first entry is the first one a client could have written.
import { BlockList, isIP } from "node:net";

// https://www.cloudflare.com/ips/ (unchanged since 2023). Re-check before each production launch.
export const CLOUDFLARE_IPV4 = ["173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
  "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22"];
export const CLOUDFLARE_IPV6 = ["2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32"];

const cloudflare = new BlockList();
for (const c of CLOUDFLARE_IPV4) { const [a, n] = c.split("/"); cloudflare.addSubnet(a, Number(n), "ipv4"); }
for (const c of CLOUDFLARE_IPV6) { const [a, n] = c.split("/"); cloudflare.addSubnet(a, Number(n), "ipv6"); }

/** A single well-formed IP address (IPv4-mapped IPv6 unwrapped), or null. */
export function parseIp(v: string | null | undefined): string | null {
  let s = (v ?? "").trim();
  if (!s || s.length > 45) return null;
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(s)) s = s.slice(7);
  return isIP(s) ? s.toLowerCase() : null;
}

export function isCloudflareIp(ip: string): boolean {
  const v = isIP(ip);
  return v === 4 ? cloudflare.check(ip, "ipv4") : v === 6 ? cloudflare.check(ip, "ipv6") : false;
}

/** The visitor's address; "unknown" when the edge gave none (such requests share one strict bucket). */
export function trustedClientIp(h: Headers): string {
  const edge = parseIp(h.get("x-real-ip"));
  if (!edge) return "unknown";
  if (isCloudflareIp(edge)) return parseIp(h.get("cf-connecting-ip")) ?? edge;
  return edge;
}
