/**
 * Sourced from Slack's own documentation and changelog
 * (docs.slack.dev/changelog, api.slack.com/changelog/2018-05-identifying-breaking-changes-in-the-slack-api)
 * as of this writing. Keep this file the single source of truth for what
 * the scan prompt is allowed to claim about Slack — never let the model
 * invent facts beyond what's written here.
 */
export const SLACK_BRIEFING = `
Reference briefing on how Slack versions its API (treat as ground truth; do not contradict it):
- Slack does not use dated or numbered API versions like Stripe (no Slack-Version header, no /v1/, /v2/ path scheme for the Web API). Changes are communicated per-method and per-feature through Slack's changelog rather than through a platform-wide versioned release. There is no published, guaranteed minimum notice window for a deprecation — real notice periods have varied widely (roughly 6 months to over a year in confirmed cases), so code should never assume a fixed grace period before a Slack change lands.
- A confirmed real deprecation: rtm.start was blocked for new apps starting November 30, 2021, and by September 2022 returned a stripped-down payload equivalent to rtm.connect. Slack's stated replacement is Socket Mode plus the Events API. Code still calling rtm.start, or relying on RTM instead of Socket Mode/Events API, is on a deprecated path.
- A confirmed real deprecation: legacy custom bots and classic Slack apps had their API calls rejected and tokens revoked starting March 31, 2025 (announced September 30, 2024). Code using a classic/legacy bot token is calling something Slack has already shut off.
- A confirmed real deprecation: files.upload was superseded by a newer external/async upload flow — new apps lost access to the old method, and existing apps needed to migrate by around March 2025. Code still calling files.upload directly is on a deprecated path.
- A related, real platform shift: Slack has moved from broad, implicit OAuth scopes toward granular, explicitly-requested OAuth scopes as part of the modern app platform. Code requesting old-style broad scopes, or relying on classic-app-only behavior, should be treated as fragile even though the "classic apps" deprecation itself was paused indefinitely in December 2025.
- General pattern: because Slack has no fixed versioning scheme, the most reliable signal that code is at risk is direct use of a method or token style Slack's own changelog has already marked as deprecated — treat any such match as a real finding, not a hypothetical one.
`.trim();

export const SLACK_SEARCH_TERMS = [
  "@slack/web-api",
  "@slack/bolt",
  "SLACK_BOT_TOKEN",
  "rtm.start",
  "files.upload",
];
