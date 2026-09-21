import { db } from "@/db";
import { scans, findings, type Vendor } from "@/db/schema";
import { getGitHubToken } from "@/lib/current-user";
import { fetchVendorRelevantFiles, fetchPullRequestFiles, fetchFileContent } from "@/lib/github";
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

  const { scanId } = await persistScan(params.repoId, params.vendor, params.triggeredBy, files, report);
  return { scanId, report };
}

async function persistScan(
  repoId: string,
  vendor: Vendor,
  triggeredBy: string,
  files: { path: string; content: string }[],
  report: ScanReport
): Promise<{ scanId: string }> {
  const [scan] = await db
    .insert(scans)
    .values({
      repoId,
      vendor,
      overallRisk: report.overallRisk,
      summary: report.summary,
      filesScanned: files.map((f) => f.path),
      triggeredBy,
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

  return { scanId: scan.id };
}

/**
 * PR-scoped scan, run from the GitHub webhook handler when a repo has
 * PR-triggered scanning enabled. Instead of GitHub code search (which has
 * indexing lag unsuitable for "scan on every push"), it reads the PR's own
 * changed-files list at the PR's head commit and checks each one's content
 * directly against the vendor's search terms — immediate, and scoped to
 * exactly what the PR touched.
 */
export async function performPrScan(params: {
  userId: string;
  anthropicApiKeyEncrypted: string;
  repoId: string;
  repoFullName: string;
  vendor: Vendor;
  prNumber: number;
  headSha: string;
  maxFiles?: number;
  maxBytesPerFile?: number;
}): Promise<{ scanId: string; report: ScanReport; matchedFiles: string[] }> {
  const token = await getGitHubToken(params.userId);
  if (!token) throw new Error("No GitHub token on file — try signing in again.");

  const maxFiles = params.maxFiles ?? 6;
  const maxBytesPerFile = params.maxBytesPerFile ?? 6000;
  const searchTerms = VENDOR_SEARCH_TERMS[params.vendor];

  const prFiles = await fetchPullRequestFiles(token, params.repoFullName, params.prNumber);
  const candidates = prFiles.filter((f) => f.status !== "removed");

  const files: { path: string; content: string }[] = [];
  for (const candidate of candidates) {
    if (files.length >= maxFiles) break;
    const content = await fetchFileContent(token, params.repoFullName, candidate.filename, params.headSha);
    if (!content) continue;
    if (searchTerms.some((term) => content.includes(term))) {
      files.push({ path: candidate.filename, content: content.slice(0, maxBytesPerFile) });
    }
  }

  const apiKey = decryptSecret(params.anthropicApiKeyEncrypted);
  const report = await runScan(apiKey, params.vendor, files);
  const { scanId } = await persistScan(params.repoId, params.vendor, "pr", files, report);

  return { scanId, report, matchedFiles: files.map((f) => f.path) };
}
