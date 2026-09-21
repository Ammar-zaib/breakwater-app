# Deploying Breakwater on your own Ubuntu server (Coolify) — start to finish

This is the self-hosted path: no Netlify, no Supabase. The app and the database both run on
your own Ubuntu box under Coolify, on `breakwater.syncxnet.com`. Nothing here needs a credit
card — the only ongoing cost is the server you already have.

Your server's already been checked: Coolify 4.0.0, Docker 29.4.2, no Postgres running yet,
~2.6GB of memory available. That's enough to run this, with one caveat noted in step 6.

## 0. Get the code into a Git repo (Coolify deploys by pulling from Git, not by upload)

Your project folder has a local git repo but it's never been pushed anywhere. Fix that first —
GitHub is the simplest option and lets you reuse the GitHub OAuth App you'll set up in step 7.

1. Go to github.com → **New repository**. Name it `breakwater-app`. Leave it empty (no README,
   no .gitignore — you already have both locally). Public or private both work; private just
   means one extra click in step 5.
2. Back in your terminal, inside the project folder:

   ```bash
   git add -A
   git commit -m "Full Breakwater app"
   git remote add origin https://github.com/<your-github-username>/breakwater-app.git
   git branch -M main
   git push -u origin main
   ```

   (Your `.gitignore` already excludes `.env*` and `node_modules`, so nothing secret gets
   pushed.)

From here on, every time you want to deploy a change, it's just `git add -A && git commit -m
"..." && git push` — Coolify picks it up.

## 1. Point a subdomain at your server

In your DNS provider (wherever `syncxnet.com` is managed), add an **A record**:

```
breakwater.syncxnet.com  →  <your server's public IP>
```

If you're not sure of the server's public IP, run `curl -4 ifconfig.me` on it. DNS can take a
few minutes to propagate — you can move on to the next steps while it does.

## 2. Create the Postgres database in Coolify

1. In Coolify, open the same **Project** you'll put the app in (or create one called
   "Breakwater").
2. **+ New Resource → Databases → PostgreSQL**. Accept the defaults, deploy it.
3. Once it's running, open it and copy the **internal connection string** shown there
   (something like `postgres://postgres:<password>@<service-name>:5432/postgres`). Save this —
   it becomes `DATABASE_URL` in step 5, and only works for containers on the same Coolify
   network (i.e. your app), not from your laptop.

## 3. Push the database schema

The schema needs to be pushed from a machine that can reach the database — your laptop can't
reach the internal connection string, so briefly expose it:

1. On the Postgres resource in Coolify, find **Public Access / Make it publicly available** and
   turn it on. Coolify will show you an **external connection string** (same credentials, but
   with your server's IP/port instead of the internal hostname).
2. On your own laptop, inside the project folder:

   ```bash
   echo 'DATABASE_URL=<the external connection string>' > .env
   npm install
   npm run db:push
   ```

   This creates every table Breakwater needs.
3. Go back to Coolify and **turn Public Access back off** — the app itself will talk to the
   database over the internal Docker network, so it doesn't need to be exposed to the internet.

## 4. Create the application in Coolify

1. **+ New Resource → Application → Public Repository** (use this even for a private repo — a
   private one will just ask you to connect via the GitHub App instead; either way, paste your
   repo).
2. Repository URL: `https://github.com/<your-github-username>/breakwater-app`
3. Branch: `main`
4. Build Pack: **Nixpacks** (should be auto-detected once it sees `package.json`).
5. Don't deploy yet — set the domain and environment variables first (next two steps).

## 5. Set the domain

In the application's **Domains** tab, set it to `https://breakwater.syncxnet.com`. Coolify
(via Traefik) will issue the SSL certificate automatically once DNS resolves — that's why step 1
happened first.

## 6. Environment variables

In the application's **Environment Variables** tab, add:

```
DATABASE_URL          <- the INTERNAL connection string from step 2 (not the public one)
AUTH_SECRET            <- output of: openssl rand -base64 32
NEXTAUTH_URL           https://breakwater.syncxnet.com
AUTH_GITHUB_ID         <- from step 7 below
AUTH_GITHUB_SECRET     <- from step 7 below
ENCRYPTION_SECRET      <- output of: openssl rand -base64 32
RESEND_API_KEY         <- from resend.com (see below)
ALERT_FROM_EMAIL       <- e.g. onboarding@resend.dev to start, or your verified domain
CRON_SECRET            <- output of: openssl rand -base64 32
```

For `RESEND_API_KEY`: resend.com → sign up → API Keys → create one. Free tier is 100
emails/day, no card required.

**Memory caveat:** with ~2.6GB available and a few other apps already running, the Next.js
build might be tight. If the build fails or gets OOM-killed, tell me and I'll add
`output: "standalone"` to `next.config.ts`, which meaningfully shrinks the build's memory
footprint — I haven't made that change yet since it's only worth doing if you actually hit it.

## 7. Create the GitHub OAuth App

1. github.com/settings/developers → **New OAuth App**.
2. Application name: `Breakwater`.
3. Homepage URL: `https://breakwater.syncxnet.com`
4. Authorization callback URL: `https://breakwater.syncxnet.com/api/auth/callback/github`
5. Save, copy the **Client ID**, generate and copy a **Client secret** — these are
   `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` from step 6.

(GitHub OAuth Apps now support up to 10 callback URLs on one app, so if you ever stand up a
second environment later you can add its callback URL here too instead of making a new app.)

## 8. Deploy

Back in the application in Coolify, click **Deploy**. Watch the build logs. Once it's live,
visiting `https://breakwater.syncxnet.com` should show the landing page with a valid SSL cert.

## 9. Set up the daily scan (Coolify Scheduled Tasks)

Vercel and Netlify both needed a workaround for cron; Coolify doesn't — **Scheduled Tasks** run
a shell command directly inside your app's own running container, so it already has every env
var and can just hit itself on `localhost`.

1. On the application, go to **Scheduled Tasks → + Add**.
2. Command:

   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/scan
   ```

3. Frequency: `0 13 * * *` (once a day, 13:00 UTC — adjust if you want a different time).
4. Save. You can also hit **Run now** there to test it immediately instead of waiting a day.

5. Repeat with a second Scheduled Task for the weekly risk digest email:

   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/digest
   ```

   Frequency: `0 14 * * 1` (once a week, Monday 14:00 UTC). This one summarizes existing scan
   results rather than re-scanning, so it's cheap to run and safe to trigger with **Run now**
   any time. Each user can turn their own digest off in Settings without affecting anyone else's.

## 9.5 Back up the database

Do this before you have real customer data in there, not after something goes wrong. Coolify has
automated backups built into every database resource it manages — you almost certainly don't need
a custom script.

1. In Coolify, open the **Postgres** database resource (not the application) you created in step 2.
2. Go to its **Backups** tab.
3. **Add a new scheduled backup.** Set a frequency — daily is reasonable for an app this size.
4. **Destination**: Coolify can save backups locally on the server, or to an S3-compatible bucket
   (AWS S3, Cloudflare R2, Backblaze B2, etc.) if you add one as a "S3 Storage" destination first,
   under the server's storage settings. Local-only backups protect you from a bad migration or a
   fat-fingered `DELETE`; they do **not** protect you if the server itself is lost, so an
   off-site (S3-compatible) destination is worth the ~5 minutes it takes to set up once you have
   real customers depending on this data.
5. Coolify shows past backup runs and lets you restore from one directly in the UI — worth doing a
   test restore once (to a throwaway database, not your live one) so you know the process works
   before you ever need it under pressure.

If your Coolify version doesn't expose a Backups tab on the database resource, the manual fallback
is the same SSH-tunnel approach you already use for `db:push`: from the tunnel, run
`pg_dump "$DATABASE_URL" | gzip > backup-$(date +%F).sql.gz` instead of `npm run db:push`, and keep
the resulting file somewhere other than the server itself.

## 10. Try it

1. Visit `https://breakwater.syncxnet.com`, sign in with GitHub.
2. **Settings** → paste in an Anthropic API key (console.anthropic.com/settings/keys) — this
   pays for and runs your scans; each signed-in user has their own.
3. **Repositories → Connect repository** → pick one → pick a vendor (Stripe, Twilio, OpenAI,
   Shopify, Slack, AWS, PayPal, Auth0, or SendGrid). It scans immediately.
4. Use "Run now" on the Scheduled Task (step 9) to confirm the daily path works end to end
   without waiting until tomorrow.

## Cleaning up leftover Netlify files (optional)

Since you're not using Netlify, `netlify.toml` and the `netlify/` folder are dead weight —
Nixpacks just ignores them, so nothing breaks if you leave them, but if you want a clean repo
say the word and I'll remove them (and `vercel.json` too, if you want).

## Deploying the enterprise update (audit log, accept/dismiss, PR scanning, dashboard trend chart, CSV export, AWS + PayPal)

This update adds one new table and a few new columns, plus one new env var. Steps:

1. **Push the code.** From the project folder: `git add -A && git commit -m "Add enterprise features" && git push`. Coolify redeploys on push same as always.

2. **Push the schema changes.** The new `audit_log` table and the new columns on `finding`
   (`status`, `accepted_by`, `accepted_at`, `accepted_reason`) and `repo`
   (`pr_scan_enabled`, `github_webhook_id`) need `npm run db:push` run against the database —
   same SSH-tunnel-to-the-Postgres-container approach you used the first time (tunnel to the
   container's internal Docker IP, point `DATABASE_URL` at `localhost:<tunnel-port>` with
   `sslmode=disable`, then run `npm run db:push` from your machine). Just ask if you want the
   exact commands again — same shape as last time.

3. **Add one new environment variable**, in the application's Environment Variables tab:

   ```
   GITHUB_WEBHOOK_SECRET   <- output of: openssl rand -base64 32
   ```

   This signs the webhook GitHub sends when a PR-triggered scan fires, so
   `/api/webhooks/github` can verify a payload actually came from GitHub. `NEXTAUTH_URL`
   (already set) is reused to build the webhook's own callback URL — nothing else to add.

4. **Redeploy** so the new env var takes effect.

## Deploying the second enterprise update (Google/Microsoft sign-in, workspaces, suppression rules, finding assignment, branch scanning, scan cost tracking, Auth0 + SendGrid vendors, Teams + PagerDuty alerts, weekly digest email, PDF risk report)

Same shape as the previous update — new columns/tables need a `db:push`, a few features need new
env vars (all optional; each feature no-ops cleanly if its env vars are missing), and there's a
second Scheduled Task to add.

1. **Push the code.** `git add -A && git commit -m "Add second round of enterprise features" && git push`.

2. **Push the schema changes.** New table `ignore_rule`; new columns on `user`
   (`teams_webhook_url`, `pagerduty_integration_key`, `weekly_digest_enabled`), `repo`
   (`extra_branch`), `scan` (`input_tokens`, `output_tokens`, `estimated_cost_usd`), and `finding`
   (`assigned_to`, `assigned_at`, `suppressed_by_rule_id`). Same SSH-tunnel `npm run db:push`
   approach as before.

3. **New dependency.** The PDF risk report (`pdfkit`) is a plain `npm install` — Coolify's build
   picks it up automatically from `package.json` on the next deploy, nothing to configure. One
   thing worth knowing: `next.config.ts` now lists `pdfkit`/`fontkit` under
   `serverExternalPackages` — that's required for the production build to succeed (pdfkit's font
   library isn't compatible with being bundled by Next's compiler), so don't remove it.

4. **Optional environment variables** — add whichever of these you want; everything else keeps
   working if you skip all of them:

   ```
   # Google sign-in (in addition to the mandatory GitHub sign-in)
   AUTH_GOOGLE_ID
   AUTH_GOOGLE_SECRET

   # Microsoft sign-in (any Microsoft account — personal, school, or work, any org)
   AUTH_MICROSOFT_ENTRA_ID_ID
   AUTH_MICROSOFT_ENTRA_ID_SECRET
   ```

   Get Google credentials from the Google Cloud Console (OAuth client ID, "Web application",
   authorized redirect URI `https://breakwater.syncxnet.com/api/auth/callback/google`) and
   Microsoft credentials from the Azure Portal (App registrations → "Accounts in any
   organizational directory and personal Microsoft accounts", redirect URI
   `https://breakwater.syncxnet.com/api/auth/callback/microsoft-entra-id`). Neither is required —
   GitHub sign-in alone still works exactly as before, these just add alternative "sign in with
   your work identity" buttons on the login page. A user who signs in with Google or Microsoft
   still has to separately connect GitHub afterward (a banner in the dashboard prompts for it),
   since that's the grant that actually gives Breakwater repo access.

   Teams and PagerDuty alerts need no server-side env vars at all — each user pastes their own
   Teams incoming-webhook URL and/or PagerDuty Events API v2 integration key into
   **Settings → Webhook, Slack, Teams & PagerDuty alerts**, same as the existing webhook/Slack
   fields.

5. **Add a second Scheduled Task**, for the weekly digest email — see step 9 above (now
   documents both the daily scan and the weekly digest).

6. **Redeploy**, then spot-check: the workspace switcher shows up in the sidebar for any account
   with a team, `/dashboard/repositories/<id>` has "Set extra branch" and suppression rules,
   Settings has the new Teams/PagerDuty fields and the weekly digest toggle, and the Overview
   page's "Download PDF report" link produces a PDF.

5. **No manual GitHub webhook setup needed.** PR-triggered scanning is opt-in per repository:
   an admin flips the "PR scanning: off/on" toggle on that repo's page, and Breakwater
   registers (or removes) the GitHub webhook automatically via the API using the existing
   GitHub OAuth token. Nothing to configure by hand in GitHub's UI.

6. **New vendors (AWS SDK v2, PayPal)** show up automatically in the vendor picker when
   connecting a repo — no extra setup.

7. **New audit log page** appears in the sidebar automatically — it's populated going forward
   from actions taken after this deploy; nothing is backfilled for past activity.

## Deploying the third round (tests, security hardening, Stripe billing, legal pages)

1. **Push the code.** `git add -A && git commit -m "Add tests, security hardening, billing, legal pages" && git push`.

2. **Push the schema changes.** New columns on `user`: `stripe_customer_id`,
   `stripe_subscription_id`, `subscription_status`, `subscription_current_period_end`. Same
   SSH-tunnel `npm run db:push` approach as every time before.

3. **New dependencies** (`stripe`, `marked`, plus `vitest` and friends as dev-only dependencies)
   install automatically on the next Coolify build — nothing to configure for those on their own.

4. **Optional: turn on billing.** Skip this section entirely if you're not charging yet — the
   Billing card in Settings only appears when all three of these are set, so leaving them unset
   keeps billing fully invisible:

   ```
   STRIPE_SECRET_KEY       <- from the Stripe Dashboard (Developers → API keys)
   STRIPE_PRICE_ID         <- the Price ID of the plan you want to sell (Products → your product → pricing)
   STRIPE_WEBHOOK_SECRET   <- see below
   ```

   To get the webhook secret: in the Stripe Dashboard, go to **Developers → Webhooks → Add
   endpoint**, set the URL to `https://breakwater.syncxnet.com/api/webhooks/stripe`, and select
   these events: `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Stripe shows you the signing secret (`whsec_...`) once the
   endpoint is created — that's `STRIPE_WEBHOOK_SECRET`. Use Stripe **test mode** keys first and
   run a test subscription end to end before switching to live keys.

   Important: billing is wired up (subscribe, manage, cancel, status tracking) but **nothing in
   the app is gated on subscription status** — a lapsed or canceled subscription doesn't currently
   block scanning or anything else. That's deliberate; turning on enforcement is a product decision
   (trial length, grace period, what happens to existing data) worth making explicitly rather than
   inheriting from a column existing. See the comment on `subscriptionStatus` in `src/db/schema.ts`.

5. **Before you actually charge anyone or call this customer-ready**, open
   `LEGAL_TERMS_OF_SERVICE.md` and `LEGAL_PRIVACY_POLICY.md` at the repo root and fill in every
   `[bracketed placeholder]` — company name, jurisdiction, contact email, dates, and (with a
   lawyer's input) the governing-law and liability sections. Once filled in, redeploy — the live
   pages at `/terms` and `/privacy` (linked from the landing page footer) render those files
   directly, so there's nothing else to update in the app itself. Until you fill them in, those
   pages will show the placeholder brackets to anyone who visits them.

6. **Run the test suite** any time you're changing scan logic, alert routing, or access control —
   `npm test` (or `npm run test:watch` while iterating). It's not wired into the Coolify build yet
   (a build failure there would block every deploy on a still-small suite), so run it yourself
   before pushing changes to those areas. `SECURITY_REVIEW.md` at the repo root has the fuller
   writeup of what was checked and fixed in this pass, and what's explicitly still open.

7. **Redeploy**, then spot-check: `/terms` and `/privacy` load, Settings shows (or correctly hides)
   the Billing card depending on whether you set the Stripe env vars, and — if you did — a test
   subscription in Stripe test mode actually updates the status shown in Settings after the
   webhook fires.
