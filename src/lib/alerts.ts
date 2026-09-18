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

  return Promise.all(attempts);
}
