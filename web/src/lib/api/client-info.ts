import { isIP } from "node:net";

// Client IP for rate limiting and audit (values are hashed before storage).
//
// X-Forwarded-For is a list that each proxy APPENDS to, so everything left of the entries added by
// our own trusted proxies is client-controlled. Reading the first entry (or x-real-ip when no
// proxy is in front of us) lets any client invent a fresh identity per request and bypass the
// per-IP limit. We therefore count `hops` trusted proxies from the right and take the entry they
// recorded. With zero trusted proxies there is no reliable IP and null is returned: callers then
// skip the per-IP limit instead of trusting a forgeable value.
export function clientIp(request: Request, trustedProxyHops: number): string | null {
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1) return null;
  const header = request.headers.get("x-forwarded-for");
  if (!header) return null;
  const entries = header.split(",").map((entry) => entry.trim());
  if (entries.length < trustedProxyHops) return null;
  const candidate = entries[entries.length - trustedProxyHops];
  return isIP(candidate) ? candidate : null;
}

export function deviceLabel(request: Request): string {
  return (request.headers.get("user-agent") ?? "unknown").slice(0, 300);
}
