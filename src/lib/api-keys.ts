import { randomBytes, createHash, timingSafeEqual } from "crypto";

/**
 * Programmatic API keys for Breakwater's own /api/v1/* endpoints — separate
 * from the user's Anthropic key (crypto.ts), which must be decrypted to be
 * used. A Breakwater key only ever needs to be *verified*, so it's stored
 * as a one-way SHA-256 hash and the raw value is shown to the user exactly
 * once, at creation time.
 */

const PREFIX = "bwk_";

/** A fresh key: the raw value (shown once), its hash (stored), and a short
 *  prefix (stored separately, purely so the UI can show "bwk_a1b2c3…"). */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = PREFIX + randomBytes(24).toString("base64url");
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, 12) };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Constant-time-ish comparison for verifying a presented key's hash against a stored one. */
export function apiKeyHashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
