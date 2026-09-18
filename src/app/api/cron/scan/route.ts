import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { repos, vendorWatches, scans, findings, users } from "@/db/schema";
import { performScan } from "@/lib/scan-runner";
import { sendAlertEmail } from "@/lib/email";
import { fanOutAlert } from "@/lib/alerts";

export const maxDuration = 300; // this can run long with many repos — Vercel Pro extends this further if needed

/**
 * Scheduled entry point. Vercel Cron (see vercel.json) calls this daily and
 * automatically sends `Authorization: Bearer <CRON_SECRET>` when that env
 * var is set on the project — see README.
 *
 * Re-scans every enabled vendor watch, and emails the repo's owner only
 * when the scan surfaces something genuinely new — never on every run.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watches = await db
    .select({
      vendor: vendorWatches.vendor,
      repoId: repos.id,
      repoUserId: repos.userId,
      repoFullName: repos.fullName,
    })
    .from(vendorWatches)
    .innerJoin(repos, eq(vendorWatches.repoId, repos.id))
    .where(eq(vendorWatches.enabled, true));

  const results: { repo: string; vendor: string; status: string }[] = [];

  for (const watch of watches) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, watch.repoUserId));
      if (!user?.anthropicApiKeyEncrypted) {
        results.push({ repo: watch.repoFullName, vendor: watch.vendor, status: "skipped: no API key" });
        continue;
      }

      const [previousScan] = await db
        .select()
        .from(scans)
        .where(and(eq(scans.repoId, watch.repoId), eq(scans.vendor, watch.vendor)))
        .orderBy(desc(scans.createdAt))
        .limit(1);
      const previousFindings = previousScan
        ? await db.select().from(findings).where(eq(findings.scanId, previousScan.id))
        : [];
      const previousTitles = new Set(previousFindings.map((f) => f.title));

      const { report } = await performScan({
        userId: user.id,
        anthropicApiKeyEncrypted: user.anthropicApiKeyEncrypted,
        repoId: watch.repoId,
        repoFullName: watch.repoFullName,
        vendor: watch.vendor,
        triggeredBy: "cron",
      });

      const newFindings = report.findings.filter((f) => !previousTitles.has(f.title));
      const isFirstScan = !previousScan;
      const shouldAlert =
        (isFirstScan && report.overallRisk !== "low") || (!isFirstScan && newFindings.length > 0);

      if (shouldAlert) {
        const to = user.alertEmail || user.email;
        const dashboardUrl = `${process.env.NEXTAUTH_URL ?? ""}/dashboard/repositories/${watch.repoId}`;
        await fanOutAlert(
          { to: to ?? null, webhookUrl: user.webhookUrl, slackWebhookUrl: user.slackWebhookUrl },
          {
            repoName: watch.repoFullName,
            repoUrl: `https://github.com/${watch.repoFullName}`,
            vendor: watch.vendor,
            overallRisk: report.overallRisk,
            summary: report.summary,
            findingsCount: report.findings.length,
            dashboardUrl,
          },
          (toAddr, payload) =>
            sendAlertEmail({
              to: toAddr,
              repoName: payload.repoName,
              vendor: payload.vendor,
              overallRisk: payload.overallRisk,
              summary: payload.summary,
              findingsCount: payload.findingsCount,
              dashboardUrl: payload.dashboardUrl,
            })
        );
        // fanOutAlert never throws per-channel — failures there shouldn't
        // fail the whole cron run, so we don't need a try/catch here beyond
        // the outer one already wrapping this watch.
      }

      results.push({
        repo: watch.repoFullName,
        vendor: watch.vendor,
        status: shouldAlert ? "scanned, alerted" : "scanned, no new risk",
      });
    } catch (err) {
      results.push({
        repo: watch.repoFullName,
        vendor: watch.vendor,
        status: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}
