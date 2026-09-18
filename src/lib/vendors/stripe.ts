/**
 * Everything here is sourced from Stripe's own published documentation
 * (docs.stripe.com/sdks/versioning, docs.stripe.com/changelog) as of this
 * writing. Keep this file the single source of truth for what the scan
 * prompt is allowed to claim about Stripe — never let the model invent
 * facts about a vendor beyond what's written here.
 */
export const STRIPE_BRIEFING = `
Reference briefing on how Stripe versions its API (treat as ground truth; do not contradict it):
- Stripe ships new API versions monthly. Monthly releases add things only — they never break existing integrations.
- Twice a year Stripe issues a named major release (alphabetical botanical names, e.g. ...acacia, basil, ... dahlia) that CAN include breaking changes. The current version is 2026-08-26.dahlia.
- An integration that does not pin an explicit dated API version (e.g. passes null, omits the Stripe-Version header, or relies on the account's default) automatically receives the next major release's behavior with no code change and no deploy — this is the single most common way Stripe integrations break silently.
- Commonly documented deprecation patterns across past Stripe major versions: fields get renamed or restructured with a multi-month deprecation window and then removed (examples developers have hit: SubscriptionItem.quantity superseded by quantities[], PaymentIntent.charges superseded by latest_charge, Customer.sources superseded by payment_methods). Treat these as illustrative examples of Stripe's deprecation STYLE, not as claims that a specific new deprecation is happening right now.
- Webhook handlers that hard-fail (throw, 500, or otherwise error the endpoint) on event types outside a hardcoded allow-list are fragile: Stripe periodically introduces new event types, and Stripe will disable a webhook endpoint after enough consecutive failures.
`.trim();

export const STRIPE_SEARCH_TERMS = ["stripe.webhooks.constructEvent", "new Stripe(", "apiVersion"];
