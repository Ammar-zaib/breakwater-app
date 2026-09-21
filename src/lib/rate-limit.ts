/**
 * Minimal in-memory sliding-window-ish rate limiter. Deliberately not
 * Redis-backed — Breakwater deploys as a single Node process (see
 * DEPLOY_COOLIFY.md), so an in-process limiter actually limits something,
 * rather than giving a false sense of security in a setup this app doesn't
 * have (multiple instances behind a load balancer). It resets on every
 * deploy/restart, which is fine for its purpose here: blunting basic
 * scripted abuse against public endpoints, not airtight enforcement.
 *
 * This is defense-in-depth, not the primary protection. For
 * /api/v1/repos specifically, the real protection is that a Breakwater API
 * key has 192 bits of random entropy — brute-forcing one isn't
 * computationally feasible regardless of rate limiting.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, opts: { limit: number; windowMs: number }): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (bucket.count >= opts.limit) {
    return { ok: false, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

// Periodic sweep so `buckets` doesn't grow without bound over a long-running
// process. `unref()` so this timer never keeps the process alive by itself.
const sweepInterval = setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  },
  5 * 60 * 1000
);
sweepInterval.unref?.();

/** Best-effort client identifier from proxy headers (Coolify's Traefik sets
 *  x-forwarded-for) — imperfect behind shared NAT/proxies, but good enough
 *  for a coarse abuse-slowing bucket, not for anything access-control-critical. */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
