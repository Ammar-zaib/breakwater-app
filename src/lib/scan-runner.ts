import { db } from "@/db";
import { scans, findings, type Vendor } from "@/db/schema";
import { getGitHubToken } from "@/lib/current-user";
import { fetchVendorRelevantFiles } from "@/lib/github";
import { runScan, type ScanReport } from "@/lib/scan";
import { VENDOR_SEARCH_TERMS } from "@/lib/vendors";
import { decryptSecret } from "@/lib/crypto";

/**
 * The one place that actually runs a scan and persists it — used by the
 * manual "Scan now" action, the auto-scan right after connecting a repo,
 * and the daily cron job, so all three stay in sync.
 */
export async function performScan(params: {
  userId: string;
  anthropicApiKeyEncrypted: string;
  repoId: string;
  repoFullName: string;
  vendor: Vendor;
  triggeredBy: "manual" | "cron";
}): Promise<{ scanId: string; report: ScanReport }> {
  const token = await getGitHubToken(params.userId);
  if (!token) throw new Error("No GitHub token on file — try signing in again.");

  const files = await fetchVendorRelevantFiles(
    token,
    params.repoFullName,
    VENDOR_SEARCH_TERMS[params.vendor]
  );
  const apiKey = decryptSecret(params.anthropicApiKeyEncrypted);
  const report = await runScan(apiKey, params.vendor, files);

  const [scan] = await db
    .insert(scans)
    .values({
      repoId: params.repoId,
      vendor: params.vendor,
      overallRisk: report.overallRisk,
      summary: report.summary,
      filesScanned: files.map((f) => f.path),
      triggeredBy: params.triggeredBy,
    })
    .returning();

  if (report.findings.length > 0) {
    await db.insert(findings).values(
      report.findings.map((f) => ({
        scanId: scan.id,
        severity: f.severity,
        title: f.title,
        explanation: f.explanation,
        evidence: f.evidence,
        filePath: f.filePath ?? null,
        recommendation: f.recommendation,
      }))
    );
  }

  return { scanId: scan.id, report };
}
