import { VENDOR_LABELS } from "@/lib/vendors";
import type { Vendor } from "@/db/schema";

/**
 * Generic webhook + Slack incoming-webhook delivery, alongside email
 * (email.ts). Both are best-effort: a failure here should never block or
 * fail the scan that triggered it, so callers should catch/ignore errors
 * from these the same way they already do for email.
 */

export type AlertPayload = {
  repoName: string;
  repoUrl: string;
  vendor: Vendor;
  overallRisk: "high" | "medium" | "low";
  summary: string;
  findingsCount: number;
  dashboardUrl: string;
};

/** POSTs the alert as plain JSON to an arbitrary webhook URL the user configured. */
export async function sendWebhookAlert(url: string, payload: AlertPayload): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "breakwater",
      repo: payload.repoName,
      vendor: payload.vendor,
      vendorLabel: VENDOR_LABELS[payload.vendor],
      overallRisk: payload.overallRisk,
      summary: payload.summary,
      findingsCount: payload.findingsCount,
      dashboardUrl: payload.dashboardUrl,
      sentAt: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Webhook delivery failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
}

const RISK_EMOJI: Record<AlertPayload["overallRisk"], string> = {
  high: "🔴",
  medium: "🟠",
  low: "🟢",
};

/** POSTs a formatted message to a Slack "incoming webhook" URL. */
export async function sendSlackAlert(url: string, payload: AlertPayload): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `${RISK_EMOJI[payload.overallRisk]} *${payload.overallRisk.toUpperCase()} risk* found in \`${payload.repoName}\` (${VENDOR_LABELS[payload.vendor]})\n${payload.summary}\n${payload.findingsCount} finding${payload.findingsCount === 1 ? "" : "s"} — <${payload.dashboardUrl}|view details>`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Slack delivery failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
}

const RISK_COLOR: Record<AlertPayload["overallRisk"], string> = {
  high: "D64545",
  medium: "D08A2B",
  low: "3C9D5C",
};

/**
 * POSTs a Microsoft Teams "incoming webhook" using the classic MessageCard
 * format. Microsoft has been pushing Teams webhooks toward a newer
 * Workflows/Adaptive-Card model and has published deprecation timelines for
 * the old Office 365 connector-based webhooks at various points — this is
 * the widely-supported format as of writing, but if delivery starts
 * failing for a previously-working URL, that migration is the most likely
 * cause, and the fix is regenerating the webhook via Teams' Workflows app.
 */
export async function sendTeamsAlert(url: string, payload: AlertPayload): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      themeColor: RISK_COLOR[payload.overallRisk],
      summary: `${payload.overallRisk.toUpperCase()} risk found in ${payload.repoName}`,
      title: `${payload.overallRisk.toUpperCase()} risk — ${VENDOR_LABELS[payload.vendor]} in ${payload.repoName}`,
      text: `${payload.summary}\n\n${payload.findingsCount} finding${payload.findingsCount === 1 ? "" : "s"}.`,
      potentialAction: [
        {
          "@type": "OpenUri",
          name: "View details",
          targets: [{ os: "default", uri: payload.dashboardUrl }],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Teams delivery failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
}

const PAGERDUTY_SEVERITY: Record<AlertPayload["overallRisk"], "critical" | "warning" | "info"> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

/**
 * Triggers a PagerDuty incident via the Events API v2. Callers should only
 * invoke this for high-risk scans — PagerDuty is for pages that justify
 * waking someone up, not every finding, so gating happens at the call site
 * (fanOutAlert below) rather than here, to keep that decision visible.
 */
export async function sendPagerDutyAlert(integrationKey: string, payload: AlertPayload): Promise<void> {
  const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      routing_key: integrationKey,
      event_action: "trigger",
      // Groups repeat alerts for the same repo+vendor into one ongoing
      // incident instead of opening a new one every scan.
      dedup_key: `breakwater:${payload.repoName}:${payload.vendor}`,
      payload: {
        summary: `${payload.overallRisk.toUpperCase()} risk — ${VENDOR_LABELS[payload.vendor]} in ${payload.repoName}: ${payload.summary}`,
        source: payload.repoName,
        severity: PAGERDUTY_SEVERITY[payload.overallRisk],
        component: VENDOR_LABELS[payload.vendor],
        custom_details: {
          findingsCount: payload.findingsCount,
          dashboardUrl: payload.dashboardUrl,
        },
      },
      client: "Breakwater",
      client_url: payload.dashboardUrl,
    }),
  });
  if (!res.ok) {
    throw new Error(`PagerDuty delivery failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
}

/**
 * Fans out to every channel the user has configured. Each channel is
 * independent — one failing doesn't stop the others, and the caller gets
 * back which channels actually succeeded rather than a single boolean.
 */
export async function fanOutAlert(
  opts: {
    to: string | null;
    webhookUrl: string | null;
    slackWebhookUrl: string | null;
    teamsWebhookUrl?: string | null;
    pagerDutyIntegrationKey?: string | null;
  },
  payload: AlertPayload,
  sendEmail: (to: string, payload: AlertPayload) => Promise<void>
): Promise<{ channel: string; ok: boolean; error?: string }[]> {
  const attempts: Promise<{ channel: string; ok: boolean; error?: string }>[] = [];

  if (opts.to) {
    attempts.push(
      sendEmail(opts.to, payload)
        .then(() => ({ channel: "email", ok: true }))
        .catch((e) => ({ channel: "email", ok: false, error: e instanceof Error ? e.message : String(e) }))
    );
  }
  if (opts.webhookUrl) {
    attempts.push(
      sendWebhookAlert(opts.webhookUrl, payload)
        .then(() => ({ channel: "webhook", ok: true }))
        .catch((e) => ({ channel: "webhook", ok: false, error: e instanceof Error ? e.message : String(e) }))
    );
  }
  if (opts.slackWebhookUrl) {
    attempts.push(
      sendSlackAlert(opts.slackWebhookUrl, payload)
        .then(() => ({ channel: "slack", ok: true }))
        .catch((e) => ({ channel: "slack", ok: false, error: e instanceof Error ? e.message : String(e) }))
    );
  }
  if (opts.teamsWebhookUrl) {
    attempts.push(
      sendTeamsAlert(opts.teamsWebhookUrl, payload)
        .then(() => ({ channel: "teams", ok: true }))
        .catch((e) => ({ channel: "teams", ok: false, error: e instanceof Error ? e.message : String(e) }))
    );
  }
  // Deliberately gated to high risk only, even if a key is configured —
  // paging someone for a medium/low finding trains them to ignore pages.
  if (opts.pagerDutyIntegrationKey && payload.overallRisk === "high") {
    attempts.push(
      sendPagerDutyAlert(opts.pagerDutyIntegrationKey, payload)
        .then(() => ({ channel: "pagerduty", ok: true }))
        .catch((e) => ({ channel: "pagerduty", ok: false, error: e instanceof Error ? e.message : String(e) }))
    );
  }

  return Promise.all(attempts);
}
