> **Read this before using either document.** This file and `LEGAL_PRIVACY_POLICY.md` are
> starting-point templates, not legal advice, and I'm not a lawyer — this is factual/structural
> drafting help, the same way I'd help draft any other document, not a substitute for review by a
> licensed attorney in your jurisdiction. Before you publish either document or rely on it with a
> real paying customer, have a lawyer review it, especially the governing-law, liability, and data
> protection sections — those vary a lot by where you and your customers are located, and getting
> them wrong can leave you genuinely exposed. Every `[bracketed placeholder]` below needs a real
> value before this is usable, and I've tried to write it to match what Breakwater's code actually
> does rather than generic boilerplate — if you change how the product works, the specific
> disclosures below (GitHub access, where code snippets get sent, what's stored) need to change
> with it, not just get left stale.

# Terms of Service

**Effective date:** [DATE]
**Last updated:** [DATE]

These Terms of Service ("Terms") govern access to and use of [PRODUCT NAME] (the "Service"),
provided by [LEGAL ENTITY NAME], a [ENTITY TYPE, e.g. "sole proprietorship" / "LLC"] based in
[COUNTRY/STATE] ("we," "us," "our"). By creating an account or using the Service, you agree to
these Terms. If you're using the Service on behalf of an organization, you're confirming you have
authority to bind that organization, and "you" below means that organization.

## 1. What the Service does

The Service watches software repositories you connect and monitors a set of third-party vendor
APIs (for example: Stripe, Twilio, OpenAI, Shopify, Slack, AWS, PayPal, Auth0, SendGrid) for
changes that could break code depending on them. It uses an AI model (via the Anthropic API) to
analyze relevant files in your connected repositories and produce findings, summaries, and
suggested fixes. **The Service is informational and best-effort.** AI-generated analysis can be
incomplete, outdated, or wrong — it is not a guarantee that your integrations are safe, and it is
not a substitute for your own testing, monitoring, and review before you rely on any vendor API in
production.

## 2. Accounts

You sign in via GitHub, and optionally Google or Microsoft. You're responsible for keeping your
account credentials and any API keys you provide secure, and for all activity under your account,
including activity by anyone you invite to your team. You must provide accurate information and
promptly update it if it changes.

## 3. GitHub access and repository data

Connecting the Service to GitHub grants it read access to the repositories you explicitly choose to
connect (the OAuth scope requested is repository read access — we do not request write or admin
access to your GitHub account). The Service reads file contents from a connected repository only
to look for patterns relevant to the vendors you're watching, and sends the relevant file contents
to the Anthropic API (using the Anthropic API key you provide — see Section 4) to generate an
analysis. Scan results, including short code excerpts the analysis cites as evidence for a finding,
are stored as part of your account's scan history until you delete the finding, disconnect the
repository, or delete your account. We do not sell, and do not use, your repository contents to
train any model.

## 4. Your API keys and other credentials

Running a scan requires your own Anthropic API key, which you provide and which is encrypted at
rest. You are solely responsible for the cost of API usage incurred by scans run on your account —
the Service shows a directional cost estimate per scan, but the Anthropic invoice to your own
account is the authoritative figure. If you configure alert destinations (a webhook URL, a Slack or
Microsoft Teams incoming webhook, a PagerDuty integration key), you're responsible for keeping
those credentials valid and for anything sent to them, since the Service delivers alerts to exactly
the destinations you configure.

## 5. Subscriptions and billing

[IF YOU CHARGE FOR THIS: describe your plan(s), price, billing cycle, and how Stripe processes
payment — Stripe handles your card details; we never see or store full card numbers. Explain what
happens on a failed payment (grace period, if any) and how to cancel. IF YOU DON'T CHARGE YET:
delete this section or replace it with "The Service is currently provided free of charge; we may
introduce paid plans in the future with advance notice."]

## 6. Acceptable use

You agree not to use the Service to: connect repositories you don't have the right to grant access
to; attempt to access another account's data or bypass access controls; use the Service's API in a
way designed to overwhelm or abuse it; or use the Service to build a directly competing product
based on scraping its output. We may suspend or terminate accounts that violate this section.

## 7. Intellectual property

We retain all rights in the Service itself (its code, design, and branding). You retain all rights
in your own repository contents and data. You grant us the limited right to process your repository
contents and account data solely to provide the Service to you.

## 8. Disclaimers

THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT
WARRANT THAT SCAN RESULTS ARE ACCURATE, COMPLETE, OR THAT USING THE SERVICE WILL PREVENT AN
INTEGRATION FROM BREAKING. [A lawyer should confirm this disclaimer language is enforceable in
your jurisdiction — some jurisdictions limit how broadly you can disclaim warranties to consumers.]

## 9. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, [LEGAL ENTITY NAME] WILL NOT BE LIABLE FOR ANY INDIRECT,
INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR
BUSINESS OPPORTUNITY, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM
ARISING FROM THE SERVICE WILL NOT EXCEED THE AMOUNT YOU PAID US IN THE [12 MONTHS] BEFORE THE CLAIM
AROSE[, OR $[AMOUNT] IF YOU HAVEN'T PAID US ANYTHING]. [This is a standard liability cap structure,
but the specific numbers, and whether a cap like this even holds up, are exactly the kind of thing
that needs a lawyer's eyes given your actual jurisdiction and customer base.]

## 10. Termination

You may stop using the Service and delete your account at any time. We may suspend or terminate
your access if you violate these Terms, or with [30 days'] notice for any other reason. On
termination, we will delete your account data within [TIMEFRAME], except as needed to comply with
legal obligations or resolve disputes.

## 11. Changes to these Terms

We may update these Terms from time to time. We'll notify you of material changes by [email /
in-app notice] before they take effect. Continued use of the Service after a change takes effect
means you accept the updated Terms.

## 12. Governing law

[This section needs a lawyer and a decision from you: which jurisdiction's law governs, and where
disputes get resolved (courts, or arbitration). This varies enormously by where you're
incorporated and where your customers are, and it's one of the sections most worth getting
professional input on rather than picking blind.]

## 13. Contact

Questions about these Terms: [CONTACT EMAIL].
