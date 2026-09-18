# Breakwater

Connect a GitHub repo, tell it which vendor — Stripe, Twilio, OpenAI, Shopify, or Slack — that
repo depends on, and Breakwater watches it automatically. A daily background check cross-references
your actual code against how that vendor really versions and deprecates its API, and alerts you
only when something concrete is actually at risk.

This is the full product: sign-in, a real dashboard, a multi-vendor scan engine backed by Claude, a
scheduled job that runs without anyone touching it, opt-in AI-generated fix PRs, lightweight team
collaboration, a programmatic API, and webhook/Slack alert delivery alongside email. It is not
deployed anywhere yet — that's the one part that needs your own (free) accounts, listed below in
order.

## What's in the product

- **Multi-vendor scanning.** Stripe, Twilio, OpenAI, Shopify, and Slack each get their own
  researched briefing (`src/lib/vendors/`) covering how that vendor actually versions,
  deprecates, and breaks things — not a generic "check for updates."
- **Opt-in fix PRs.** Click "Open fix PR" on any finding and Breakwater asks Claude to write the
  corrected file and opens a real GitHub pull request for you to review. Nothing is ever written
  to your repo automatically — every scan only reads; a PR only ever happens when you click the
  button on that specific finding.
- **Team collaboration.** Invite teammates by email from **Team** and assign them a role —
  Viewer (read-only), Editor (can scan and open fix PRs), or Admin (can also disconnect repos and
  manage the team). They see your watched repos the moment they sign in with the invited email;
  your GitHub and Claude credentials are never shared with them.
- **Programmatic API access.** Generate an API key in **Settings** and call
  `GET /api/v1/repos` with `Authorization: Bearer <key>` to pull your repos and latest scans into
  CI, a script, or another dashboard. Read-only.
- **Webhook + Slack alerts.** Add a webhook URL and/or a Slack incoming-webhook URL in
  **Settings** and every alert that would've emailed you also gets POSTed as JSON / dropped into
  Slack — configurable independently, and testable with one click.

## What you're setting up, and why

| Piece | What it's for | Cost to start |
|---|---|---|
| A place to host it | Runs the app itself | Free (Vercel, or Netlify — see below) |
| A Postgres database | Stores users, connected repos, scan history | Free (Supabase or Neon) |
| A GitHub OAuth App | Lets users sign in and grants read access to the repos they choose | Free |
| Resend | Sends the alert emails | Free (100 emails/day) |
| Anthropic API key | Runs the actual AI scan | Pay-as-you-go, per user's own key |

Nothing here needs a credit card to start except Vercel/Supabase if you outgrow the free tier, and
Anthropic (a scan costs a fraction of a cent — a few thousand tokens).

## 1. Create a Postgres database

Pick one (both have generous free tiers and work identically here):

- **Supabase** — supabase.com → New project → Settings → Database → copy the **Connection
  string** (URI, "Transaction" mode).
- **Neon** — neon.tech → New project → copy the connection string from the dashboard.

Save it — this is your `DATABASE_URL`.

## 2. Create a GitHub OAuth App

1. Go to github.com/settings/developers → **New OAuth App**.
2. Application name: `Breakwater` (or anything).
3. Homepage URL: your future domain, e.g. `https://breakwater.yourdomain.com` (a placeholder is
   fine for now — you can edit this later).
4. **Authorization callback URL**: `https://<your-vercel-domain>/api/auth/callback/github`
   (you'll get the exact domain in step 5 — you can come back and fill this in after).
5. Save. Copy the **Client ID**, then generate and copy a **Client secret**.

These become `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`.

## 3. Create a Resend account (for alert emails)

1. resend.com → sign up → API Keys → create one. This is `RESEND_API_KEY`.
2. Under Domains, add and verify a domain you own (or, to test immediately without owning a
   domain, use Resend's `onboarding@resend.dev` sender for early testing — replace
   `ALERT_FROM_EMAIL` with that until your domain is verified).

## 4. Generate your three secrets

Run these locally (or in any terminal) and save the output:

```bash
openssl rand -base64 32   # -> AUTH_SECRET
openssl rand -base64 32   # -> ENCRYPTION_SECRET (encrypts stored Anthropic keys at rest)
openssl rand -base64 32   # -> CRON_SECRET
```

## 5. Deploy to Vercel

```bash
npm install -g vercel   # if you don't have it
vercel                  # from inside this project folder, follow the prompts
```

Then in the Vercel dashboard for this project, go to **Settings → Environment Variables** and add
everything from `.env.example` with your real values:

```
DATABASE_URL
AUTH_SECRET
NEXTAUTH_URL          <- your real Vercel URL, e.g. https://breakwater.vercel.app
AUTH_GITHUB_ID
AUTH_GITHUB_SECRET
ENCRYPTION_SECRET
RESEND_API_KEY
ALERT_FROM_EMAIL
CRON_SECRET
```

Redeploy after saving the variables (Vercel does this automatically on save, or run `vercel
--prod`). Once you have the real Vercel URL, go back to your GitHub OAuth App (step 2) and set the
callback URL to `https://<your-real-domain>/api/auth/callback/github`.

**The daily scan is already configured** — `vercel.json` tells Vercel to call `/api/cron/scan`
once a day, and Vercel automatically sends the `CRON_SECRET` you set as a Bearer token, which the
route checks before doing anything.

## Deploying to Netlify instead of Vercel

Everything above still applies for steps 1–4 (Supabase/Neon, GitHub OAuth App, Resend, the three
secrets) — Netlify only changes step 5. Two things are already set up in this repo for it:

- `netlify.toml` — tells Netlify where the custom function below lives. Netlify auto-detects
  Next.js 13.5+ and builds it with no other config.
- `netlify/functions/scheduled-scan.ts` — Netlify has no equivalent of `vercel.json`'s cron
  entry, so this is a small scheduled function that calls `/api/cron/scan` once a day instead
  (same route, same `CRON_SECRET` check — nothing about the scan logic changes).

1. Push this repo to GitHub if it isn't already there — Netlify deploys from a Git repo, not a
   local folder.
2. app.netlify.com → **Add new site → Import an existing project** → pick your GitHub repo.
   Netlify detects Next.js automatically; leave the build command as `npm run build`.
3. Before the first deploy, go to **Site configuration → Environment variables** and add the
   same variables as the Vercel list above:

   ```
   DATABASE_URL
   AUTH_SECRET
   NEXTAUTH_URL          <- your Netlify URL, e.g. https://your-site.netlify.app
   AUTH_GITHUB_ID
   AUTH_GITHUB_SECRET
   ENCRYPTION_SECRET
   RESEND_API_KEY
   ALERT_FROM_EMAIL
   CRON_SECRET
   ```

4. Deploy. Once you have the real `.netlify.app` URL (or a custom domain), go back to your
   GitHub OAuth App and set the callback URL to
   `https://<your-real-domain>/api/auth/callback/github`, and update `NEXTAUTH_URL` to match.
5. Confirm the scheduled function is registered: **Site configuration → Functions →
   scheduled-scan** should show a daily schedule. You can hit "Run now" there to test it instead
   of waiting a day.

Two honest caveats specific to Netlify: a single Netlify Function has a **60-second execution
limit** (not configurable on the free tier), so if you connect enough repositories that one daily
scan run can't finish inside that window, some will get cut off — fine for a handful of repos,
worth watching if you connect a lot. And `scheduled-scan.ts` itself has a shorter budget than
that, so it deliberately doesn't wait for the whole scan to finish — it just kicks off the
request and logs whether `/api/cron/scan` accepted it; check that function's logs (not the
scheduled function's) to see how each day's scan actually went.

## 6. Push the database schema

With `DATABASE_URL` set locally (copy it into a local `.env` file, not committed):

```bash
npm install
npm run db:push
```

This creates every table Breakwater needs. Re-run it any time `src/db/schema.ts` changes.

## 7. Try it

1. Visit your deployed URL, sign in with GitHub.
2. Go to **Settings**, paste in an Anthropic API key (console.anthropic.com/settings/keys) — this
   is what actually pays for and runs your scans. Each signed-in user has their own; nothing is
   shared.
3. Go to **Repositories → Connect repository**, pick one, pick a vendor (Stripe, Twilio, OpenAI,
   Shopify, or Slack). It scans immediately.
4. Come back tomorrow (or trigger `/api/cron/scan` manually with the right Authorization header)
   and, if something changed, check your inbox.

## Local development

```bash
cp .env.example .env
# fill in DATABASE_URL at minimum to run locally
npm install
npm run db:push
npm run dev
```

## What's intentionally out of scope for v1

- **Billing** isn't built — every signed-in user currently has full access. Add it when you're
  ready to charge (Stripe, appropriately enough, is the natural choice).
- **Public repos are easiest to search.** GitHub's code search API — which locates the relevant
  files in a repo — indexes private repos too, but can occasionally lag on very large or very new
  private repos. If a scan comes back with zero files found on a private repo, that's usually why.
- **Team invites are silent.** Inviting a teammate doesn't send them an email yet — it just
  becomes active the moment they sign in to Breakwater with that email address. Let them know
  directly for now.
- **Fix PRs are single-file.** `generateFix` rewrites the one file a finding points at; it won't
  span a change across multiple files in one PR.
- **Adding another vendor** is still the same pattern: a new file in `src/lib/vendors/` (a real,
  sourced briefing — never fabricated facts) plus an entry in `src/db/schema.ts`'s `VENDORS` array
  and `src/lib/vendors/index.ts`'s aggregator.
