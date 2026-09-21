/**
 * Sourced from PayPal's own REST API migration guide
 * (developer.paypal.com/api/rest/integration/payments-api/v1-v2-migration)
 * as of this writing. Keep this file the single source of truth for what
 * the scan prompt is allowed to claim about PayPal — never let the model
 * invent facts about a vendor beyond what's written here. In particular:
 * PayPal has not published a sunset date for v1, so this briefing does not
 * state one — do not let the model infer or guess one either.
 */
export const PAYPAL_BRIEFING = `
Reference briefing on PayPal REST Payments API versioning (treat as ground truth; do not contradict it):
- PayPal's v1 Payments API ("/v1/payments/*", including "/v1/payments/payment") is deprecated. PayPal has not published a specific sunset/removal date for it — do not state or assume one, only that it is deprecated and integrators should not build new code against it.
- The replacement is split across two v2 APIs instead of one: Orders v2 ("/v2/checkout/orders/*") handles the checkout/approval flow, and Payments v2 ("/v2/payments/*") handles what happens after approval (captures, authorizations, refunds). Code written against v1's single unified payment object needs to be split across both.
- Intent values change casing and vocabulary going from v1 to v2: v1 used lowercase strings like "sale" and "authorize"; v2 uses uppercase enum values "CAPTURE" and "AUTHORIZE". A v1-style lowercase intent value sent to a v2 endpoint will not behave the same way.
- In v2, an authorization's "final_capture" field defaults to false. If code performing a capture doesn't explicitly set "final_capture": true when it should be the last capture against an authorization, the remaining authorized balance stays held instead of being released — a silent balance-hold bug rather than a hard failure, so it's easy to ship without noticing.
- Idempotency key retention drops sharply between versions: v1 honored a request's idempotency key (via "PayPal-Request-Id") for 30 days, while v2 only honors it for 6 hours. Code relying on v1's 30-day replay-safety window (e.g. retrying a stale queued request days later) is not safe to run unchanged against v2.
- There is no direct v2 replacement for "GET /v1/payments/payment" (fetching full historical payment details by ID). PayPal's guidance is to use the separate Transaction Search API instead. Code that calls this v1 endpoint to look up past payments has no like-for-like v2 endpoint to swap in.
- Packages/SDKs to watch for: "paypal-rest-sdk" (old, v1-oriented, unmaintained) and direct calls to "/v1/payments/" paths are the clearest signals of v1 usage; "@paypal/checkout-server-sdk" is the more current official SDK, though code using it can still call deprecated v1-style endpoints under the hood if not kept current.
`.trim();

export const PAYPAL_SEARCH_TERMS = [
  "@paypal/checkout-server-sdk",
  "/v1/payments/",
  "paypal-rest-sdk",
  "final_capture",
];
