import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { repos, vendorWatches, scans, findings, users } from "@/db/schema";
import { performScan, performBranchScan } from "@/lib/scan-runner";
import { fetchBranchFilePaths } from "@/lib/github";
import { getGitHubToken } from "@/lib/current-user";
import { sendAlertEmail } from "@/lib/email";
import { fanOutAlert } from "@/lib/alerts";
import type { ScanReport } from "@/lib/scan";
import { timingSafeEqualString } from "@/lib/security";

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
  if (!expected || !authHeader || !timingSafeEqualString(authHeader, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watches = await db
    .select({
      vendor: vendorWatches.vendor,
      repoId: repos.id,
      repoUserId: repos.userId,
      repoFullName: repos.fullName,
      extraBranch: repos.extraBranch,
    })
    .from(vendorWatches)
    .innerJoin(repos, eq(vendorWatches.repoId, repos.id))
    .where(eq(vendorWatches.enabled, true));

  const results: { repo: string; vendor: string; status: string }[] = [];

  async function alertIfNew(
    userId: string,
    repoId: string,
    repoFullName: string,
    vendor: (typeof watches)[number]["vendor"],
    report: ScanReport,
    /** Restrict the "what changed" comparison to scans of this trigger type
     *  only — used for the branch-scan line, which has its own separate
     *  history and shouldn't be diffed against default-branch scans. Omit
     *  for the default-branch cron scan, which compares against the most
     *  recent scan of any trigger type, same as before this existed. */
    restrictTriggeredBy?: string
  ): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return false;

    // [0] is the scan we just persisted this run, [1] (if any) is the one to diff against.
    const scopeCondition = restrictTriggeredBy
      ? and(eq(scans.repoId, repoId), eq(scans.vendor, vendor), eq(scans.triggeredBy, restrictTriggeredBy))
      : and(eq(scans.repoId, repoId), eq(scans.vendor, vendor));
    const recentScans = await db
      .select()
      .from(scans)
      .where(scopeCondition)
      .orderBy(desc(scans.createdAt))
      .limit(2);
    const priorScan = recentScans[1];
    const priorFindings = priorScan
      ? await db.select().from(findings).where(eq(findings.scanId, priorScan.id))
      : [];
    const priorTitles = new Set(priorFindings.map((f) => f.title));

    const newFindings = report.findings.filter((f) => !priorTitles.has(f.title));
    const isFirstScan = !priorScan;
    const shouldAlert = (isFirstScan && report.overallRisk !== "low") || (!isFirstScan && newFindings.length > 0);
    if (!shouldAlert) return false;

    const to = user.alertEmail || user.email;
    const dashboardUrl = `${process.env.NEXTAUTH_URL ?? ""}/dashboard/repositories/${repoId}`;
    await fanOutAlert(
      {
        to: to ?? null,
        webhookUrl: user.webhookUrl,
        slackWebhookUrl: user.slackWebhookUrl,
        teamsWebhookUrl: user.teamsWebhookUrl,
        pagerDutyIntegrationKey: user.pagerDutyIntegrationKey,
      },
      {
        repoName: repoFullName,
        repoUrl: `https://github.com/${repoFullName}`,
        vendor,
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
    return true;
  }

  for (const watch of watches) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, watch.repoUserId));
      if (!user?.anthropicApiKeyEncrypted) {
        results.push({ repo: watch.repoFullName, vendor: watch.vendor, status: "skipped: no API key" });
        continue;
      }

      const { report } = await performScan({
        userId: user.id,
        anthropicApiKeyEncrypted: user.anthropicApiKeyEncrypted,
        repoId: watch.repoId,
        repoFullName: watch.repoFullName,
        vendor: watch.vendor,
        triggeredBy: "cron",
      });
      const alerted = await alertIfNew(user.id, watch.repoId, watch.repoFullName, watch.vendor, report);

      results.push({
        repo: watch.repoFullName,
        vendor: watch.vendor,
        status: alerted ? "scanned, alerted" : "scanned, no new risk",
      });

      if (watch.extraBranch) {
        try {
          const token = await getGitHubToken(user.id);
          if (!token) throw new Error("no GitHub token");
          const candidatePaths = await fetchBranchFilePaths(token, watch.repoFullName, watch.extraBranch);
          const { report: branchReport } = await performBranchScan({
            userId: user.id,
            anthropicApiKeyEncrypted: user.anthropicApiKeyEncrypted,
            repoId: watch.repoId,
            repoFullName: watch.repoFullName,
            vendor: watch.vendor,
            branch: watch.extraBranch,
            candidatePaths,
          });
          const branchAlerted = await alertIfNew(
            user.id,
            watch.repoId,
            watch.repoFullName,
            watch.vendor,
            branchReport,
            "branch"
          );
          results.push({
            repo: `${watch.repoFullName}@${watch.extraBranch}`,
            vendor: watch.vendor,
            status: branchAlerted ? "scanned, alerted" : "scanned, no new risk",
          });
        } catch (err) {
          results.push({
            repo: `${watch.repoFullName}@${watch.extraBranch}`,
            vendor: watch.vendor,
            status: `error: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
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
