import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { repos, scans, vendorWatches, findings, type Vendor } from "@/db/schema";

export type RepoReportSection = {
  repoFullName: string;
  vendor: Vendor | null;
  effectiveRisk: "high" | "medium" | "low" | null;
  latestScanAt: Date | null;
  latestScanSummary: string | null;
  openFindings: { severity: string; title: string; explanation: string; filePath: string | null }[];
};

export type AccountReportData = {
  ownerLabel: string;
  generatedAt: Date;
  repos: RepoReportSection[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
};

/**
 * Shared aggregation behind the PDF risk report (src/lib/pdf-report.ts) —
 * same "effective risk" definition as the Overview dashboard and the
 * weekly digest (src/lib/digest.ts), but with the actual open findings
 * included per repo rather than just counts, since a PDF report is meant
 * to be read stand-alone, without clicking through to the dashboard.
 */
export async function buildAccountReportData(ownerId: string, ownerLabel: string): Promise<AccountReportData> {
  const ownerRepos = await db.select().from(repos).where(eq(repos.userId, ownerId));

  const sections: RepoReportSection[] = await Promise.all(
    ownerRepos.map(async (repo) => {
      const [watch] = await db.select().from(vendorWatches).where(eq(vendorWatches.repoId, repo.id));
      const [latestScan] = await db
        .select()
        .from(scans)
        .where(eq(scans.repoId, repo.id))
        .orderBy(desc(scans.createdAt))
        .limit(1);

      if (!latestScan) {
        return {
          repoFullName: repo.fullName,
          vendor: watch?.vendor ?? null,
          effectiveRisk: null,
          latestScanAt: null,
          latestScanSummary: null,
          openFindings: [],
        };
      }

      const openFindings = await db
        .select()
        .from(findings)
        .where(and(eq(findings.scanId, latestScan.id), eq(findings.status, "open")));
      const effectiveRisk: "high" | "medium" | "low" = openFindings.some((f) => f.severity === "high")
        ? "high"
        : openFindings.some((f) => f.severity === "medium")
          ? "medium"
          : "low";

      return {
        repoFullName: repo.fullName,
        vendor: watch?.vendor ?? null,
        effectiveRisk,
        latestScanAt: latestScan.createdAt,
        latestScanSummary: latestScan.summary,
        openFindings: openFindings.map((f) => ({
          severity: f.severity,
          title: f.title,
          explanation: f.explanation,
          filePath: f.filePath,
        })),
      };
    })
  );

  return {
    ownerLabel,
    generatedAt: new Date(),
    repos: sections,
    highCount: sections.filter((s) => s.effectiveRisk === "high").length,
    mediumCount: sections.filter((s) => s.effectiveRisk === "medium").length,
    lowCount: sections.filter((s) => s.effectiveRisk === "low").length,
  };
}
