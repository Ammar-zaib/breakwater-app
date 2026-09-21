# Deploying Breakwater — Netlify + Supabase, every command

This is the zero-to-live walkthrough: every click and every terminal command, in order, assuming
you're starting from the zip file with nothing installed yet. Total time is usually 30–45 minutes,
almost all of it waiting on web forms, not typing.

Two paths diverge partway through: a **quick local test** (steps 1–6) to confirm everything works
on your own machine before you put it online, and **going live** (steps 7 onward). You can skip
straight to step 7 if you'd rather just deploy and iterate there.

---

## 0. What you need installed first

Open a terminal and check what you already have:

```bash
node -v
npm -v
git --version
```

- **Node.js** — need 18 or newer. If `node -v` fails or shows something older, install from
  [nodejs.org](https://nodejs.org) (the LTS installer), or with a version manager:
  ```bash
  # macOS/Linux, via nvm
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  nvm install --lts
  ```
- **Git** — if `git --version` fails, install from [git-scm.com](https://git-scm.com/downloads)
  (macOS: `xcode-select --install` also gets you a working `git`).

You'll also want accounts (all free, no card needed for any of them at this scale):
[github.com](https://github.com), [supabase.com](https://supabase.com), [netlify.com](https://netlify.com),
[resend.com](https://resend.com), and an Anthropic API key from
[console.anthropic.com](https://console.anthropic.com/settings/keys) (this last one is pay-as-you-go,
but a scan costs a fraction of a cent).

---

## 1. Unzip the project and install dependencies

```bash
mkdir breakwater-app
cd breakwater-app
unzip ~/Downloads/breakwater-app.zip   # adjust the path if it downloaded somewhere else
npm install
```

You should see a `src/`, `package.json`, `netlify.toml`, and so on in the current folder — if
`unzip` created an extra nested folder instead, `cd` into that one first.

---

## 2. Create the Supabase database

No commands here — this part is entirely in the browser:

1. Go to [supabase.com](https://supabase.com) → sign up → **New project**.
2. Pick an organization (or create one), name the project (e.g. `breakwater`), set a database
   password — **save this password somewhere**, you'll need it in a moment — and pick a region
   close to you. Click **Create new project** and wait ~2 minutes for it to provision.
3. Once it's ready, click **Connect** (top of the project dashboard).
4. Under "Connection string", switch the method to **Transaction pooler**.
5. Copy the connection string shown. It looks like:
   ```
   postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-xx-xxxx-1.pooler.supabase.com:6543/postgres
   ```
6. Replace `[YOUR-PASSWORD]` with the real password from step 2. If your password contains
   special characters like `@`, `#`, `&`, or `?`, percent-encode them (e.g. `@` → `%40`) or the
   connection string won't parse correctly.

Save this final string somewhere — it's your `DATABASE_URL`.

---

## 3. Set up your local environment file

```bash
cp .env.example .env
```

Open `.env` in any text editor (`nano .env`, `code .env`, whatever you use) and paste in the
`DATABASE_URL` from step 2:

```
DATABASE_URL="postgresql://postgres.xxxxxxxxxxxx:yourpassword@aws-0-xx-xxxx-1.pooler.supabase.com:6543/postgres"
```

Leave the rest blank for now — you'll fill them in as you generate them below.

---

## 4. Push the database schema

This creates every table Breakwater needs, directly against your new Supabase database:

```bash
npm run db:push
```

`drizzle-kit` will print out the tables it's about to create and ask something like `Apply the
changes? › Yes / No` — pick **Yes**. If it succeeds you'll see a short list of created tables
(`user`, `repo`, `scan`, `finding`, `team_member`, `api_key`, and the rest).

If this fails with a connection error, double check the password in `DATABASE_URL` is
percent-encoded correctly and that you copied the **Transaction pooler** string, not "Direct
connection" (the direct one doesn't work well from serverless environments).

---

## 5. (Optional) Test it locally before going live

This needs a throwaway local-only GitHub OAuth App, since GitHub requires a real callback URL:

1. github.com/settings/developers → **New OAuth App**.
2. Application name: `Breakwater (local)`. Homepage URL: `http://localhost:3000`.
   Authorization callback URL: `http://localhost:3000/api/auth/callback/github`.
3. Save, copy the **Client ID**, generate and copy a **Client secret**.

Generate the two secrets it needs and add everything to `.env`:

```bash
openssl rand -base64 32   # copy this as AUTH_SECRET
openssl rand -base64 32   # copy this as ENCRYPTION_SECRET
```

```
AUTH_SECRET="paste-here"
NEXTAUTH_URL="http://localhost:3000"
AUTH_GITHUB_ID="paste-here"
AUTH_GITHUB_SECRET="paste-here"
ENCRYPTION_SECRET="paste-here"
```

Then run it:

```bash
npm run dev
```

Visit `http://localhost:3000`, sign in with GitHub, and confirm the dashboard loads. Stop the
server with `Ctrl+C` when you're done — this local OAuth App and its secrets are just for this
test; you'll make fresh production ones below (or you can reuse this same GitHub OAuth App and
just add a second callback URL to it later — GitHub OAuth Apps support multiple callback URLs).

---

## 6. Create the production GitHub OAuth App

If you made a local one in step 5, you can skip creating a new one — just come back to **this
same app** in step 10 to add the production callback URL. Otherwise:

1. github.com/settings/developers → **New OAuth App**.
2. Application name: `Breakwater`. Homepage URL: any placeholder for now (e.g.
   `https://example.com`) — you'll fix it in step 10.
3. Authorization callback URL: any placeholder for now, e.g. `https://example.com/api/auth/callback/github`
   — you'll fix this in step 10 too, once you know your real Netlify URL.
4. Save, copy the **Client ID**, generate and copy a **Client secret**.

---

## 7. Create a Resend account (for alert emails)

1. [resend.com](https://resend.com) → sign up → **API Keys** → **Create API Key**. Copy it.
2. Under **Domains**, you can add and verify a domain you own later. To get started immediately
   without one, just use `Breakwater <onboarding@resend.dev>` as your `ALERT_FROM_EMAIL` — Resend's
   shared testing sender works for low volume without domain verification.

---

## 8. Generate the remaining secrets

You already made `AUTH_SECRET` and `ENCRYPTION_SECRET` in step 5 if you did the local test — reuse
those same values in production. If you skipped step 5, generate them now:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # ENCRYPTION_SECRET
openssl rand -base64 32   # CRON_SECRET
```

`CRON_SECRET` is new either way — it's what the scheduled daily-scan function uses to
authenticate itself to your own app, so it only needs to exist in production.

By this point you should have all nine values collected somewhere (a scratch note, not committed
anywhere): `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` (you'll fill this in after step 9),
`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `ENCRYPTION_SECRET`, `RESEND_API_KEY`, `ALERT_FROM_EMAIL`,
`CRON_SECRET`.

---

## 9. Push the code to GitHub

Netlify deploys from a Git repository, not a local folder, so this has to exist on GitHub first.

```bash
git init
git add .
git commit -m "Initial commit"
```

Now create the empty repo on GitHub — easiest via the web:

1. Go to [github.com/new](https://github.com/new).
2. Name it `breakwater-app` (or anything), leave it **empty** (don't check "Add a README" —
   you already have one), set visibility to your preference, click **Create repository**.
3. GitHub will show you a page with commands — use the "push an existing repository" block, which
   looks like this (replace `<your-username>`):

```bash
git remote add origin https://github.com/<your-username>/breakwater-app.git
git branch -M main
git push -u origin main
```

If you have the [GitHub CLI](https://cli.github.com) installed, steps above can be one command
instead: `gh repo create breakwater-app --private --source=. --remote=origin --push`.

---

## 10. Deploy on Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → sign up / log in (signing in with your
   GitHub account is simplest — it also handles the repo access permission in one step).
2. **Add new site → Import an existing project → Deploy with GitHub**. Authorize Netlify to
   access your repos if prompted, then pick `breakwater-app`.
3. Netlify auto-detects Next.js. Leave the build command as `npm run build` and the base
   directory blank. **Don't click Deploy yet** — go to the environment variables section first
   (there's a link for it on this same screen, "Add environment variables", or you can add them
   after via Site configuration).
4. Add each of these (Site configuration → Environment variables → **Add a variable** → **Import
   from a .env file** is the fastest way — paste your collected values in that format — or add
   them one by one):

   ```
   DATABASE_URL
   AUTH_SECRET
   NEXTAUTH_URL
   AUTH_GITHUB_ID
   AUTH_GITHUB_SECRET
   ENCRYPTION_SECRET
   RESEND_API_KEY
   ALERT_FROM_EMAIL
   CRON_SECRET
   ```

   For `NEXTAUTH_URL`, use a guessed placeholder for now like `https://breakwater-app.netlify.app`
   — Netlify usually picks a site name close to your repo name, but confirm the real one after
   the first deploy and fix it if it's different (see step 11).

5. Click **Deploy breakwater-app**. First build takes a few minutes — watch it under **Deploys**.

---

## 11. Point the OAuth App at your real Netlify URL

Once the deploy finishes, Netlify shows you the live URL (something like
`https://breakwater-app-a1b2c3.netlify.app`, or the name you picked). Use the **real** one:

1. Go back to your GitHub OAuth App (github.com/settings/developers → your app).
2. Set **Homepage URL** to that real URL.
3. Set **Authorization callback URL** to `https://<your-real-url>/api/auth/callback/github`.
4. Save.
5. Back in Netlify: **Site configuration → Environment variables**, edit `NEXTAUTH_URL` to match
   the same real URL exactly (no trailing slash).
6. Netlify does **not** automatically rebuild when you edit environment variables — trigger it
   yourself: **Deploys → Trigger deploy → Deploy site**.

---

## 12. Confirm the daily scan is scheduled

Go to **Site configuration → Functions** in Netlify — you should see `scheduled-scan` listed with
a daily schedule. Click into it and use **Run now** to fire it immediately instead of waiting a
day, and check the function's logs to confirm it got a response back from `/api/cron/scan`.

---

## 13. Try the real thing

1. Visit your live URL, click **Sign in with GitHub**, authorize it.
2. Go to **Settings**, paste in your Anthropic API key from
   [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) — this is
   what pays for and runs your scans.
3. Go to **Repositories → Connect repository**, pick one, pick a vendor (Stripe, Twilio, OpenAI,
   Shopify, or Slack). It scans immediately.
4. Optional: in **Settings**, add a webhook URL and/or Slack incoming-webhook URL, and hit **Send
   test alert** to confirm delivery works on every channel you configured.

---

## Making a change later

Any time you edit code locally:

```bash
git add .
git commit -m "describe the change"
git push
```

Netlify redeploys automatically on every push to `main`. If you change `src/db/schema.ts`, also
re-run `npm run db:push` locally (with your production `DATABASE_URL` in `.env`) so the live
database picks up the new tables/columns.

---

## Troubleshooting

- **"Callback URL mismatch" on sign-in** — the callback URL in your GitHub OAuth App doesn't
  exactly match `https://<your-site>/api/auth/callback/github`. Check for a trailing slash or
  `http` vs `https` mismatch.
- **Sign-in redirects but the dashboard is blank / errors** — `NEXTAUTH_URL` in Netlify doesn't
  match the real site URL, or you forgot to trigger a redeploy after changing it (step 11.6).
- **`npm run db:push` can't connect** — you're likely using the "Direct connection" string
  instead of "Transaction pooler," or a special character in the password isn't percent-encoded.
- **Scans fail with an Anthropic error** — the key pasted into Settings is invalid/expired, or
  that Anthropic account has no billing set up (scans are pay-as-you-go on your own key).
- **Scheduled scan never runs** — check `CRON_SECRET` is set in both Netlify's environment
  variables and matches; check the `scheduled-scan` function's logs (not `/api/cron/scan`'s own
  logs) for the response status it got.
