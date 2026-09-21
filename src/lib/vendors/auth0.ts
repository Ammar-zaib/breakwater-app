/**
 * Sourced from Auth0's own documentation, blog, and support properties
 * (auth0.com/blog, auth0.com/docs/troubleshoot/product-lifecycle,
 * github.com/auth0/auth0-spa-js) as of this writing. Keep this file the
 * single source of truth for what the scan prompt is allowed to claim
 * about Auth0 — never let the model invent facts about a vendor beyond
 * what's written here.
 */
export const AUTH0_BRIEFING = `
Reference briefing on Auth0 versioning and deprecations (treat as ground truth; do not contradict it):
- Auth0 Rules and Hooks (the old way to run custom code during login — token enrichment, MFA logic, user provisioning) stopped being available to new tenants on October 16, 2023, and were fully removed from EVERY tenant on November 18, 2024. Unmigrated custom code in Rules/Hooks was deleted outright, not just deprecated — any login-flow logic that was never migrated to Actions simply stopped running.
- The Node.js "extensibility runtimes" that Actions, Rules, Hooks, Custom Database scripts, and Custom Social connection code run on were deprecated February 10, 2025 and reached end-of-life August 15, 2025. All of that custom code is now forced onto Node 22 — code relying on Node 12/16-only APIs, or on npm dependencies incompatible with Node 22, can silently fail or throw where it used to work.
- auth0-spa-js v2.0 (released November 10, 2022) is a breaking major version: the constructor option "client_id" was renamed to "clientId"; extra authorize/token params moved into a new nested "authorizationParams" object instead of being passed at the top level; "ignoreCache" was renamed to "cacheMode"; "buildAuthorizeUrl" and "buildLogoutUrl" were removed entirely; the "localOnly" logout parameter was removed; the default request Content-Type changed from JSON to "application/x-www-form-urlencoded"; and default scopes no longer automatically include "profile email". Code still written against the v1 shape (e.g. passing "client_id" instead of "clientId", or calling "buildAuthorizeUrl") will not compile or will silently misbehave against v2.
- In auth0-spa-js v2, "checkSession()" no longer throws on failure — it silently resolves instead. Code written for v1 that relied on a thrown error to detect a failed silent-auth check will no longer see that failure.
- The Resource Owner Password Grant endpoint ("POST /oauth/ro") is explicitly documented by Auth0 as deprecated, in favor of the OIDC-conformant "POST /oauth/token" with "grant_type=password". Code still calling "/oauth/ro" directly is on a deprecated legacy endpoint.
- Legacy Auth0.js (pre-v9) and Lock (pre-v11) patterns — relying on the ID token or "/userinfo" for a full profile instead of a proper access token, or calling "refreshToken()" instead of Silent Authentication plus "checkSession()" — are documented by Auth0 as deprecated migration targets, though Auth0 has not published a specific removal date for these older flows.
`.trim();

export const AUTH0_SEARCH_TERMS = [
  "@auth0/auth0-spa-js",
  "auth0-js",
  "new auth0.WebAuth(",
  ".checkSession(",
  ".buildAuthorizeUrl(",
  ".buildLogoutUrl(",
  "/oauth/ro",
];
