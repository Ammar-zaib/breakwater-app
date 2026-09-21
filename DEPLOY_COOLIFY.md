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

## 10. Try it

1. Visit `https://breakwater.syncxnet.com`, sign in with GitHub.
2. **Settings** → paste in an Anthropic API key (console.anthropic.com/settings/keys) — this
   pays for and runs your scans; each signed-in user has their own.
3. **Repositories → Connect repository** → pick one → pick a vendor (Stripe, Twilio, OpenAI,
   Shopify, or Slack). It scans immediately.
4. Use "Run now" on the Scheduled Task (step 9) to confirm the daily path works end to end
   without waiting until tomorrow.

## Cleaning up leftover Netlify files (optional)

Since you're not using Netlify, `netlify.toml` and the `netlify/` folder are dead weight —
Nixpacks just ignores them, so nothing breaks if you leave them, but if you want a clean repo
say the word and I'll remove them (and `vercel.json` too, if you want).
