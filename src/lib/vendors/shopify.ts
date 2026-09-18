/**
 * Sourced from Shopify's own documentation
 * (shopify.dev/docs/api/usage/versioning, shopify.dev/changelog,
 * shopify.dev/docs/api/admin-rest/usage/versioning) as of this writing.
 * Keep this file the single source of truth for what the scan prompt is
 * allowed to claim about Shopify — never let the model invent facts beyond
 * what's written here.
 */
export const SHOPIFY_BRIEFING = `
Reference briefing on how Shopify versions its API (treat as ground truth; do not contradict it):
- Shopify's Admin and Storefront APIs use calendar-based versions (e.g. 2024-01, 2024-04, 2024-07, 2024-10), releasing a new stable version quarterly. Each stable version gets a minimum of 12 months of support, with at least 9 months of overlap between consecutive versions.
- When a pinned version becomes unsupported, Shopify does not hard-error by default — it "falls forward" and silently serves requests using the oldest still-accessible stable version instead. This means an app that never updates its pinned version doesn't crash; it just quietly drifts onto older, eventually-unsupported behavior, which is a real and easy-to-miss risk pattern distinct from a hard failure.
- Apps that keep calling unsupported or deprecated resources past the deadline risk being delisted from the Shopify App Store, and can be blocked from new installs for a minimum of 7 days.
- The REST Admin API has been officially "legacy" since October 1, 2024, and as of April 2025 new public App Store submissions must use the GraphQL Admin API instead. Code still built on the REST Admin API is on a path Shopify is actively steering away from, even though no fixed REST shutdown date has been announced.
- A confirmed real example: Protected Customer Data access restrictions introduced in API version 2022-10 caused contact email, shipping address, and billing address fields to disappear from Orders API responses and webhooks for apps that hadn't been granted the specific data-access approval — present in 2022-07, silently missing from 2022-10 onward for affected apps.
- A confirmed real example: Checkout API mutations were marked deprecated in version 2024-04 and fully removed in version 2025-04 — a one-year window, after which calling them fails outright.
- Deprecated fields and resources surface via the X-Shopify-API-Deprecated-Reason response header and Shopify's official changelog before removal — code that ignores that header is missing Shopify's own early-warning signal.
`.trim();

export const SHOPIFY_SEARCH_TERMS = [
  "shopify-api",
  "@shopify/shopify-api",
  "X-Shopify-Access-Token",
  "admin/api/20",
  "SHOPIFY_API_KEY",
];
