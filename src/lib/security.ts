import { timingSafeEqual } from "crypto";

/**
 * Constant-time comparison for bearer-token-style secrets (CRON_SECRET,
 * etc.) — a plain `===` leaks how many leading characters matched through
 * response timing. The webhook (github/route.ts) and API key
 * (api-keys.ts) checks already did this; the two cron routes used a plain
 * string comparison, which this closes. In practice a shared secret sent
 * over HTTPS to a single self-hosted instance is a low-value timing target,
 * but it costs nothing to do this correctly everywhere secrets are compared.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
