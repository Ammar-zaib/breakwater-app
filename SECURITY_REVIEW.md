# Security self-review

A code-level self-review of Breakwater, done before opening it up to paying customers. This is
**not** a substitute for a real third-party penetration test or audit — it's me (Claude) reading
the codebase systematically and fixing what's cheap and clear to fix. Treat "reviewed" below as
"reviewed by the same author who wrote the code," which is a real check but not an independent
one. If you're taking on enterprise customers who'll ask about this, budget for an actual external
audit before you tell them "yes, this has been security-reviewed."

## What was checked

Every server action in `src/app/actions.ts` (32 of them) and every API route handler in
`src/app/api/**/route.ts`, specifically for: who's allowed to call it, whether it checks that
correctly, whether it operates on the right account's data, and whether secrets are handled safely
along the way.

## Findings and what was done about them

### Fixed

**Non-constant-time comparison on `CRON_SECRET`.** Both cron routes (`/api/cron/scan`,
`/api/cron/digest`) compared the `Authorization` header with plain `!==`, which leaks how many
leading bytes matched via response timing — the webhook handler and the API-key check already did
this correctly with `crypto.timingSafeEqual`. Added `src/lib/security.ts` (`timingSafeEqualString`)
and switched both cron routes to it. In practice this is a low-value target (a long secret sent
over HTTPS to a single self-hosted instance, not a widely-distributed API), but it costs nothing
to get right everywhere a secret is compared, and now it's consistent across the app.

**No rate limiting on `GET /api/v1/repos`.** This is the one endpoint reachable by anyone on the
internet with no session — just a bearer API key. Added `src/lib/rate-limit.ts`, a small in-memory
limiter (per-process, resets on deploy — Breakwater runs as a single Node process, so this
genuinely limits something rather than faking it), applied as a per-IP throttle (120 req/min) and
a per-key-hash throttle (60 req/min). The real protection here is that a Breakwater API key has
192 bits of random entropy (`generateApiKey` in `src/lib/api-keys.ts`) — brute-forcing one isn't
computationally feasible regardless of rate limiting. This is defense-in-depth, not the load-bearing
control.

**No baseline security response headers.** Added `X-Content-Type-Options: nosniff`,
`X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, a conservative
`Permissions-Policy`, and `Strict-Transport-Security` in `next.config.ts`, applied to every route.

### Reviewed, no issue found

**Access control on every server action.** Every action that reads or writes repo/finding/team/
API-key/billing data goes through `requireRepoAccess()` (checks role against the *repo owner's*
account, not just "is signed in") or an equivalent explicit `getRoleForOwner` + `roleAtLeast` check.
Destructive actions (`disconnectRepo`, `togglePrScan`, `setExtraBranch`) require `admin`, not just
`editor`. Team-scoped queries (`updateTeamMemberRole`, `removeTeamMember`) are scoped with
`eq(teamMembers.ownerId, user.id)` in the `WHERE` clause itself, not just checked-then-trusted, so
there's no window for a stale/forged ID to touch another account's row. `listAuditLog` requires
`admin` on the target account, not just membership. `setActiveWorkspace` validates the requested
`ownerId` is actually one of the caller's accessible accounts before trusting it, closing off using
the workspace cookie to view arbitrary accounts' data.

**GitHub webhook signature verification.** HMAC-SHA256 over the raw body, compared with
`timingSafeEqual`, matched against the length first to avoid a `timingSafeEqual` length-mismatch
throw. Correct.

**Open redirect via `callbackUrl` on login.** The login page passes a user-supplied `callbackUrl`
straight into `signIn(..., { redirectTo: callbackUrl })`. This is safe because `auth.ts` doesn't
override Auth.js's default `redirect` callback, and that default only allows same-origin URLs
(relative paths, or absolute URLs matching the app's own origin) — anything else falls back to the
app's own base URL. No code change needed; flagging it here because it's the kind of thing that
*would* be a real open-redirect if someone added a custom `redirect` callback later without
re-checking this.

**CSRF on Server Actions.** Next.js Server Actions already verify the request's `Origin` header
against the deployment's own host before running, which is why `NEXTAUTH_URL` being set correctly
matters beyond just OAuth callbacks. No additional CSRF token layer was added — it would be
redundant.

**SQL injection.** Every query goes through Drizzle's query builder with parameterized values;
there's no raw string-concatenated SQL anywhere in the codebase.

**`connectRepo` trusting client-submitted repo metadata.** It writes whatever `fullName`/
`githubRepoId`/`defaultBranch` the client sends, without re-verifying against the user's actual
GitHub repo list server-side first. This sounds like it could let someone connect a repo they don't
own, but it can't go anywhere: every scan against that repo uses the *connecting user's own* GitHub
token to read files, and GitHub itself enforces whether that token can see that repo. Worst case is
a row in the `repo` table that never successfully scans. Not fixed, because there's nothing to fix
— GitHub is the actual authority here, not Breakwater.

### Known, accepted, not fixed here

**GitHub OAuth tokens stored in plaintext** in the `account` table (standard `@auth/drizzle-adapter`
behavior). This is normal for NextAuth-based apps — the protection is your database itself being
properly access-controlled (network-isolated, credentialed, backed up securely — see
`DEPLOY_COOLIFY.md`), not application-level encryption of every OAuth token. Anthropic API keys
*are* encrypted at rest (`src/lib/crypto.ts`, AES-256-GCM) specifically because those are a
secondary secret the user typed in, not something the OAuth flow already scoped down to
minimal-necessary access.

**`ENCRYPTION_SECRET`'s key derivation uses a static salt** (`scryptSync(secret, "breakwater-static-salt", 32)`
in `src/lib/crypto.ts`). A random-per-installation salt would be marginally better cryptographic
hygiene, but since `ENCRYPTION_SECRET` itself is a per-deployment secret (not a password reused
across many installs being compared against a public rainbow table), this doesn't meaningfully
weaken anything in practice. Low priority; would take a migration to change now that real data may
be encrypted with it.

**No Content-Security-Policy.** A CSP strict enough to be worth shipping needs to account for
Next's inline hydration scripts, Tailwind, and every third-party resource (Google Fonts, etc.),
and getting it wrong silently breaks the app rather than failing loudly. Worth doing, but
deliberately scoped out of this pass rather than shipping something copy-pasted and untested.

**No structured input-length limits (zod or similar) on most server actions.** The webhook handler
validates its payload shape with zod; most other actions (`updateAlertEmail`, `inviteTeamMember`,
etc.) do light manual validation (trim, `.includes("@")`) but don't enforce max lengths. Not a
security hole on its own (Drizzle/Postgres handle arbitrary-length text fine, no injection risk),
but worth tightening before letting untrusted users submit freely.

**No external monitoring for the rate limiter or auth failures.** If someone hammers `/api/v1/repos`
right now, you won't get an alert about it — you'd have to go looking at logs. That's really part of
the broader "no observability" gap (see the "what's still missing" conversation), not something
scoped into this pass.

## Bottom line

Nothing found here rose to "actively exploitable right now" — the access-control layer that
matters most (who can see/touch which account's data) was already built correctly and consistently
throughout. What got fixed were hardening items: closing a timing side-channel, adding rate limiting
to the one open-internet endpoint, and adding baseline security headers. What's explicitly *not*
done — a real third-party audit, a tuned CSP, encrypted-at-rest OAuth tokens, structured input
validation everywhere — is listed above so it doesn't quietly get assumed as "handled."
