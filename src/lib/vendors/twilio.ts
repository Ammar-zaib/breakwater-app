/**
 * Sourced from Twilio's own documentation and changelog
 * (twilio.com/en-us/changelog, twilio.com/docs/conversations/versioning-and-support-lifecycle,
 * twilio.com/docs/global-infrastructure/api-domain-migration-guide) as of this writing.
 * Keep this file the single source of truth for what the scan prompt is
 * allowed to claim about Twilio — never let the model invent facts beyond
 * what's written here.
 */
export const TWILIO_BRIEFING = `
Reference briefing on how Twilio versions its API (treat as ground truth; do not contradict it):
- Twilio's core REST API is NOT versioned the way Stripe's is. The base path has stayed "2010-04-01" (e.g. api.twilio.com/2010-04-01/Accounts.json) since launch. Newer product APIs (Conversations, Sync, Voice, Messaging) instead use their own "/v1/", "/v2/" style namespaced versions with a documented lifecycle: Latest -> Support (12 months) -> Deprecated (further 12 months) -> End of Life. There is no single unified, dated-release program covering the whole platform — deprecations are announced per-product via Twilio's changelog, and real notice periods have ranged from about one day to about twelve months, not a guaranteed uniform window.
- A real, confirmed example: Twilio's region-specific API domains (api.ie1.twilio.com, api.au1.twilio.com, api.de1.twilio.com, api.jp1.twilio.com, api.sg1.twilio.com, api.us2.twilio.com, api.br1.twilio.com) stopped working April 28, 2026. Code that hardcodes one of these regional domains is a concrete, verifiable risk.
- Helper library major version bumps are a real, documented breaking-change vector: twilio-node's v4.x release (a TypeScript/OpenAPI-generated rewrite) was explicitly NOT backward compatible with Twilio Functions, per Twilio's own changelog. Pinning an old major version of a Twilio helper library without a plan to upgrade is a real risk pattern, not a hypothetical one.
- Non-HTTPS or CNAME-based access to voice recording media URLs was deprecated with very short real-world notice (about one day) in Feb 2024 — code assuming HTTP access or a custom recording-media hostname is fragile.
- Webhook signature validation (X-Twilio-Signature) that isn't actually checked, or that trusts a hardcoded/legacy auth token format, is a common real integration weakness independent of any specific version change.
`.trim();

export const TWILIO_SEARCH_TERMS = [
  "twilio(",
  "require('twilio')",
  "from 'twilio'",
  "TWILIO_ACCOUNT_SID",
  "twilio.validateRequest",
];
