import { Resend } from "resend";
import { VENDOR_LABELS } from "@/lib/vendors";
import type { Vendor } from "@/db/schema";

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
