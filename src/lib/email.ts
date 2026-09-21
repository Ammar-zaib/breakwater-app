import { Resend } from "resend";
import { VENDOR_LABELS } from "@/lib/vendors";
import type { Vendor } from "@/db/schema";

export type DigestRepoLine = {
  fullName: string;
  vendor: Vendor | null;
  effectiveRisk: "high" | "medium" | "low" | null;
  openFindingsCount: number;
};

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set.");
  return new Resend(key);
}

export async function sendAlertEmail(opts: {
  to: string;
  repoName: string;
  vendor: Vendor;
  overallRisk: "high" | "medium" | "low";
  summary: string;
  findingsCount: number;
  dashboardUrl: string;
}) {
  const resend = getResend();
  const riskColor = { high: "#B3261E", medium: "#93650A", low: "#1F7A45" }[opts.overallRisk];
  const vendorLabel = VENDOR_LABELS[opts.vendor];

  await resend.emails.send({
    from: process.env.ALERT_FROM_EMAIL || "Breakwater <alerts@yourdomain.com>",
    to: opts.to,
    subject: `[Breakwater] ${opts.overallRisk.toUpperCase()} risk found in ${opts.repoName} (${vendorLabel})`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #0F2027;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #51707A; margin-bottom: 4px;">Breakwater · ${vendorLabel} watch</p>
        <h1 style="font-size: 20px; margin: 0 0 16px;">
          <span style="color: ${riskColor};">${opts.overallRisk.toUpperCase()} risk</span> found in ${opts.repoName}
        </h1>
        <p style="font-size: 14px; line-height: 1.6; color: #2B3F46;">${opts.summary}</p>
        <p style="font-size: 14px; color: #51707A;">${opts.findingsCount} finding${opts.findingsCount === 1 ? "" : "s"} in this scan.</p>
        <a href="${opts.dashboardUrl}" style="display: inline-block; margin-top: 16px; background: #0B7285; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          View details
        </a>
        <p style="font-size: 12px; color: #8FA9B2; margin-top: 32px;">You're getting this because ${opts.repoName} is on your watch list in Breakwater. Manage this in Settings.</p>
      </div>
    `,
  });
}

/** Weekly summary of an account's current risk posture — one email covering
 *  every watched repo, rather than the per-scan alerts above. Sent by
 *  /api/cron/digest, independent of and in addition to real-time alerts. */
export async function sendDigestEmail(opts: {
  to: string;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  newFindingsThisWeek: number;
  repos: DigestRepoLine[];
  dashboardUrl: string;
  settingsUrl: string;
}) {
  const resend = getResend();
  const riskColor = { high: "#B3261E", medium: "#93650A", low: "#1F7A45" };
  const headline =
    opts.highCount > 0
      ? `${opts.highCount} repo${opts.highCount === 1 ? "" : "s"} at high risk`
      : opts.mediumCount > 0
        ? `${opts.mediumCount} repo${opts.mediumCount === 1 ? "" : "s"} at medium risk`
        : "Everything's quiet";

  const repoRows = opts.repos
    .slice()
    .sort((a, b) => rank(b.effectiveRisk) - rank(a.effectiveRisk))
    .map(
      (r) => `
        <tr>
          <td style="padding: 8px 0; font-family: monospace; font-size: 13px; color: #0F2027;">${r.fullName}</td>
          <td style="padding: 8px 0; font-size: 12px; color: #51707A;">${r.vendor ? VENDOR_LABELS[r.vendor] : "—"}</td>
          <td style="padding: 8px 0; text-align: right; font-size: 12px;">
            ${
              r.effectiveRisk
                ? `<span style="color: ${riskColor[r.effectiveRisk]}; font-weight: 600;">${r.effectiveRisk.toUpperCase()}</span> · ${r.openFindingsCount} open`
                : `<span style="color: #8FA9B2;">not scanned</span>`
            }
          </td>
        </tr>`
    )
    .join("");

  await resend.emails.send({
    from: process.env.ALERT_FROM_EMAIL || "Breakwater <alerts@yourdomain.com>",
    to: opts.to,
    subject: `[Breakwater] Weekly digest — ${headline}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #0F2027;">
        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #51707A; margin-bottom: 4px;">Breakwater · weekly digest</p>
        <h1 style="font-size: 20px; margin: 0 0 16px;">${headline}</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #2B3F46;">
          ${opts.highCount} high · ${opts.mediumCount} medium · ${opts.lowCount} low risk repo(s) right now, across ${opts.repos.length} watched.
          ${opts.newFindingsThisWeek > 0 ? `${opts.newFindingsThisWeek} new finding${opts.newFindingsThisWeek === 1 ? "" : "s"} surfaced this week.` : "No new findings this week."}
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <thead>
            <tr>
              <th style="text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #8FA9B2; border-bottom: 1px solid #E3ECEE; padding-bottom: 6px;">Repo</th>
              <th style="text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #8FA9B2; border-bottom: 1px solid #E3ECEE; padding-bottom: 6px;">Vendor</th>
              <th style="text-align: right; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #8FA9B2; border-bottom: 1px solid #E3ECEE; padding-bottom: 6px;">Risk</th>
            </tr>
          </thead>
          <tbody>${repoRows}</tbody>
        </table>
        <a href="${opts.dashboardUrl}" style="display: inline-block; margin-top: 20px; background: #0B7285; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Open dashboard
        </a>
        <p style="font-size: 12px; color: #8FA9B2; margin-top: 32px;">You're getting this because weekly digests are on for your account. <a href="${opts.settingsUrl}" style="color: #8FA9B2;">Turn them off in Settings.</a></p>
      </div>
    `,
  });
}

function rank(risk: "high" | "medium" | "low" | null): number {
  return risk === "high" ? 3 : risk === "medium" ? 2 : risk === "low" ? 1 : 0;
}
