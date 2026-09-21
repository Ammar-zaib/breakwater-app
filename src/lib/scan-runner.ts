import { eq } from "drizzle-orm";
import { db } from "@/db";
import { scans, findings, ignoreRules, type Vendor } from "@/db/schema";
import { getGitHubToken } from "@/lib/current-user";
import { fetchVendorRelevantFiles, fetchPullRequestFiles, fetchFileContent } from "@/lib/github";
import { runScan, type ScanReport, type ScanUsage } from "@/lib/scan";
import { VENDOR_SEARCH_TERMS } from "@/lib/vendors";
import { decryptSecret } from "@/lib/crypto";
import { estimateCostUsd } from "@/lib/cost";

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
  const { report, usage } = await runScan(apiKey, params.vendor, files);

  const { scanId } = await persistScan(params.repoId, params.vendor, params.triggeredBy, files, report, usage);
  return { scanId, report };
}

async function persistScan(
  repoId: string,
  vendor: Vendor,
  triggeredBy: string,
  files: { path: string; content: string }[],
  report: ScanReport,
  usage: ScanUsage
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
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd: estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens),
    })
    .returning();

  if (report.findings.length > 0) {
    const rules = await db.select().from(ignoreRules).where(eq(ignoreRules.repoId, repoId));
    await db.insert(findings).values(
      report.findings.map((f) => {
        const matchedRule = matchIgnoreRule(rules, vendor, f.title, f.filePath ?? null);
        return {
          scanId: scan.id,
          severity: f.severity,
          title: f.title,
          explanation: f.explanation,
          evidence: f.evidence,
          filePath: f.filePath ?? null,
          recommendation: f.recommendation,
          status: matchedRule ? "suppressed" : "open",
          suppressedByRuleId: matchedRule?.id ?? null,
        };
      })
    );
  }

  return { scanId: scan.id };
}

type IgnoreRule = typeof ignoreRules.$inferSelect;

/** A rule matches when every condition it sets is satisfied — a rule with no
 *  conditions set (shouldn't normally happen) matches nothing, not everything. */
function matchIgnoreRule(
  rules: IgnoreRule[],
  vendor: Vendor,
  title: string,
  filePath: string | null
): IgnoreRule | null {
  for (const rule of rules) {
    if (rule.vendor && rule.vendor !== vendor) continue;
    if (!rule.titleContains && !rule.filePathContains) continue;
    if (rule.titleContains && !title.toLowerCase().includes(rule.titleContains.toLowerCase())) continue;
    if (rule.filePathContains && !(filePath ?? "").toLowerCase().includes(rule.filePathContains.toLowerCase())) continue;
    return rule;
  }
  return null;
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
  const { report, usage } = await runScan(apiKey, params.vendor, files);
  const { scanId } = await persistScan(params.repoId, params.vendor, "pr", files, report, usage);

  return { scanId, report, matchedFiles: files.map((f) => f.path) };
}

/**
 * Branch-scoped scan (see performBranchScan callers) — same content-match
 * approach as performPrScan, but walking an entire branch's tree instead of
 * a PR diff, for watching a long-lived branch beyond the repo's default one.
 */
export async function performBranchScan(params: {
  userId: string;
  anthropicApiKeyEncrypted: string;
  repoId: string;
  repoFullName: string;
  vendor: Vendor;
  branch: string;
  candidatePaths: string[];
  maxFiles?: number;
  maxBytesPerFile?: number;
}): Promise<{ scanId: string; report: ScanReport }> {
  const token = await getGitHubToken(params.userId);
  if (!token) throw new Error("No GitHub token on file — try signing in again.");

  const maxFiles = params.maxFiles ?? 6;
  const maxBytesPerFile = params.maxBytesPerFile ?? 6000;
  const searchTerms = VENDOR_SEARCH_TERMS[params.vendor];

  const files: { path: string; content: string }[] = [];
  for (const path of params.candidatePaths) {
    if (files.length >= maxFiles) break;
    const content = await fetchFileContent(token, params.repoFullName, path, params.branch);
    if (!content) continue;
    if (searchTerms.some((term) => content.includes(term))) {
      files.push({ path, content: content.slice(0, maxBytesPerFile) });
    }
  }

  const apiKey = decryptSecret(params.anthropicApiKeyEncrypted);
  const { report, usage } = await runScan(apiKey, params.vendor, files);
  const { scanId } = await persistScan(params.repoId, params.vendor, "branch", files, report, usage);

  return { scanId, report };
}
