/**
 * Sourced from Twilio SendGrid's own changelog and the sendgrid-nodejs
 * repository's own migration guides and changelog (twilio.com/en-us/changelog,
 * github.com/sendgrid/sendgrid-nodejs) as of this writing. Keep this file the
 * single source of truth for what the scan prompt is allowed to claim about
 * SendGrid — never let the model invent facts about a vendor beyond what's
 * written here.
 */
export const SENDGRID_BRIEFING = `
Reference briefing on Twilio SendGrid versioning and deprecations (treat as ground truth; do not contradict it):
- The legacy v2 Mail Send endpoint's per-request recipient limit was cut from 10,000 down to 1,000, effective July 9, 2025 (announced June 2, 2025), to bring it in line with v3's limit. Code still calling the v2 Mail Send endpoint (not "@sendgrid/mail" / v3, but the older "api.sendgrid.com/api/mail.send.json" style integration) with large personalizations/recipient batches will start failing requests that used to succeed.
- SendGrid's free plan was retired starting May 27–28, 2025, with a 60-day grace window (through roughly late July 2025). After that window, sending pauses entirely on an unupgraded free account, Marketing Campaign features (templates, contact lists, automation) stop working, and contact lists over 100 contacts get deleted. Any integration assuming a free-tier SendGrid account keeps working indefinitely is now wrong.
- The "@sendgrid/mail" Node.js SDK's v6.0.0 release (April 1, 2020) was a breaking change: it dropped the "request" HTTP client in favor of "axios", changing the shape of "ClientRequest"/"ClientResponse" objects. This followed the "request" npm package itself being deprecated on February 11, 2020, which SendGrid's own migration guide cites as the reason for the switch.
- "@sendgrid/mail" v8.0.0 (released December 5, 2023) is another breaking major version (a further Node version bump and axios upgrade). Code still pinned to "@sendgrid/mail": "^6" or "^7" needs an explicit migration before it can safely move to v8 — response/error handling written against the older major can break silently on the new one.
- SendGrid's "Email Monitor" feature was retired on December 13, 2022 — a narrower, dated retirement, but a real one for any integration that was relying on it for sampling outbound mail.
- SendGrid supports a cryptographically signed Event Webhook (ECDSA signature in the "X-Twilio-Email-Event-Webhook-Signature" header) so a receiving endpoint can verify a webhook payload really came from SendGrid. SendGrid's docs do not give an enforced deadline for adopting this — flag unverified webhook handlers as a best-practice gap, not as something with an announced cutoff date.
`.trim();

export const SENDGRID_SEARCH_TERMS = [
  "@sendgrid/mail",
  "@sendgrid/client",
  "mail.send.json",
  "sgMail.setApiKey",
  "X-Twilio-Email-Event-Webhook-Signature",
];
