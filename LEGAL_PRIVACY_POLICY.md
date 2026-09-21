> **Same caveat as the Terms of Service file:** this is a starting-point template, not legal
> advice, and I'm not a lawyer. Privacy law varies significantly by where your customers are
> located (GDPR if you have EU/UK users, CCPA/CPRA if you have California users, and so on), and
> which of those regimes actually apply to you is a legal question, not something I can determine
> for you. Have a lawyer review this — particularly the data-subject-rights and international
> transfer sections — before you publish it or rely on it. Every `[bracketed placeholder]` needs a
> real value, and the "what we collect" section below is written to match what Breakwater's code
> actually stores today — if the product changes what it collects, this needs to be updated to
> match, not left as a stale description of an earlier version.

# Privacy Policy

**Effective date:** [DATE]
**Last updated:** [DATE]

This Privacy Policy explains what [LEGAL ENTITY NAME] ("we," "us," "our") collects through
[PRODUCT NAME] (the "Service"), why, and what you can do about it.

## 1. What we collect

**Account information.** When you sign in via GitHub, and optionally Google or Microsoft, we
receive your name, email address, and profile image from that provider. If you sign in with
GitHub, we also receive and store a GitHub access token scoped to repository read access, so the
Service can read the repositories you choose to connect.

**Repository data.** For each repository you connect, we store its name and default branch, and a
record of every scan we run against it — including which files were scanned, an AI-generated
summary and risk level, and, for each finding, a short code excerpt the analysis cites as evidence.
We do not store full copies of your repositories; we store what a given scan actually looked at and
found.

**Your API key.** Running a scan requires your own Anthropic API key, which you provide. It's
encrypted at rest and used only to run scans on your own account.

**Alert destinations.** If you configure a webhook URL, Slack or Microsoft Teams incoming webhook,
or a PagerDuty integration key, we store that value so we can deliver alerts there. Treat these as
credentials — anyone with that value could receive alerts meant for you.

**Billing information.** [IF USING STRIPE: If you subscribe to a paid plan, our payment processor
(Stripe) collects and stores your payment details directly — we never see or store your full card
number. We store your Stripe customer ID and subscription status so we know what plan you're on.
IF NOT YET CHARGING: delete this paragraph.]

**Usage and log data.** Like most web services, our hosting infrastructure logs standard request
data (IP address, timestamps, requested paths) for operational and security purposes (see also
`SECURITY_REVIEW.md` for how this is used defensively, e.g. rate limiting).

## 2. How we use it

To provide the Service: running scans, sending alerts and the weekly digest, showing your
dashboard, and processing billing. To maintain and secure the Service: detecting abuse, debugging
issues, and enforcing our Terms of Service. We do not sell your data, and we do not use your
repository contents to train any AI model.

## 3. Who we share it with

**GitHub.** We connect to GitHub's API using the access token you grant, to read repositories you
connect and, if you enable PR-triggered scanning, to post scan results as PR comments.

**Anthropic.** File contents from your connected repositories are sent to the Anthropic API — using
your own API key, not a shared one — to generate scan analysis. Anthropic's own privacy policy and
terms govern their handling of that data; see their documentation for current details.

**Resend.** Alert and digest emails are sent through Resend, our transactional email provider.

**Stripe.** [IF APPLICABLE] Billing is processed through Stripe; see Stripe's own privacy policy for
how they handle payment data.

**Destinations you configure yourself.** If you set up a Slack, Microsoft Teams, or PagerDuty
integration, alert summaries (repository name, vendor, risk level, and a short text summary — not
full code) are sent to that destination when you or the Service triggers an alert. That's a
transmission you configured; we're not responsible for how that third-party destination handles it
once delivered.

We do not share your data with anyone else except as required by law, or with your explicit
consent.

## 4. Data retention

We retain your account data and scan history for as long as your account is active. If you
disconnect a repository, we stop scanning it but retain its historical scan data as part of your
account's history unless you request deletion. If you delete your account, we delete your data
within [TIMEFRAME], except where we're required to retain it for legal, tax, or dispute-resolution
purposes.

## 5. Data security

Your Anthropic API key is encrypted at rest (AES-256-GCM). GitHub access tokens are stored the way
standard OAuth integrations store them, protected by our database's own access controls rather than
additional application-level encryption — see `SECURITY_REVIEW.md` for the fuller technical
picture, including what's been reviewed and what hasn't. All traffic to the Service is encrypted in
transit (HTTPS/TLS).

## 6. Your rights

Depending on where you live, you may have the right to access, correct, export, or delete your
personal data, and to object to or restrict certain processing. You can access and update most of
your account data directly in Settings, disconnect repositories yourself, and delete your account
data by [CONTACTING US / a self-service delete-account option, if you build one]. To exercise any
other rights, contact us at [CONTACT EMAIL].

[If you have or expect EU/UK/California users specifically, a lawyer should help you fill in the
specific legal bases for processing (GDPR Article 6), your data protection contact if one is
required, and any CCPA-specific disclosures — those have particular required language this template
doesn't attempt to supply.]

## 7. Children's privacy

The Service is not directed at children, and we do not knowingly collect personal data from anyone
under [13 / 16, depending on jurisdiction]. If you believe a child has provided us data, contact us
and we'll delete it.

## 8. International data transfers

[If you or your infrastructure are in a different country than your customers, this section needs
to describe how data moves across that border and what safeguards apply (e.g. Standard Contractual
Clauses, for EU data transferred elsewhere) — this is jurisdiction-specific and needs a lawyer's
input, not a template.]

## 9. Changes to this policy

We may update this policy from time to time. We'll notify you of material changes by [email /
in-app notice] before they take effect.

## 10. Contact

Questions about this policy, or to exercise your data rights: [CONTACT EMAIL].
