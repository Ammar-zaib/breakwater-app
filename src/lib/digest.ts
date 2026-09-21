import { eq, and, inArray, gte, desc } from "drizzle-orm";
import { db } from "@/db";
import { repos, scans, vendorWatches, findings } from "@/db/schema";
import type { DigestRepoLine } from "@/lib/email";

export type AccountDigest = {
  repos: DigestRepoLine[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  newFindingsThisWeek: number;
};

/**
 * Aggregates one account's current risk posture for the weekly digest email
 * — same "effective risk" definition used on the Overview dashboard (open
 * findings only, accepted/suppressed excluded), plus a week-over-week count
 * of findings that are new since 7 days ago.
 */
export async function buildAccountDigest(ownerId: string): Promise<AccountDigest | null> {
  const ownerRepos = await db.select().from(repos).where(eq(repos.userId, ownerId));
  if (ownerRepos.length === 0) return null;
  const repoIds = ownerRepos.map((r) => r.id);

  const lines: DigestRepoLine[] = await Promise.all(
    ownerRepos.map(async (repo) => {
      const [watch] = await db.select().from(vendorWatches).where(eq(vendorWatches.repoId, repo.id));
      const [latestScan] = await db
        .select()
        .from(scans)
        .where(eq(scans.repoId, repo.id))
        .orderBy(desc(scans.createdAt))
        .limit(1);

      if (!latestScan) {
        return { fullName: repo.fullName, vendor: watch?.vendor ?? null, effectiveRisk: null, openFindingsCount: 0 };
      }

      const openFindings = await db
        .select({ severity: findings.severity })
        .from(findings)
        .where(and(eq(findings.scanId, latestScan.id), eq(findings.status, "open")));
      const effectiveRisk: "high" | "medium" | "low" = openFindings.some((f) => f.severity === "high")
        ? "high"
        : openFindings.some((f) => f.severity === "medium")
          ? "medium"
          : "low";

      return {
        fullName: repo.fullName,
        vendor: watch?.vendor ?? null,
        effectiveRisk,
        openFindingsCount: openFindings.length,
      };
    })
  );

  const highCount = lines.filter((l) => l.effectiveRisk === "high").length;
  const mediumCount = lines.filter((l) => l.effectiveRisk === "medium").length;
  const lowCount = lines.filter((l) => l.effectiveRisk === "low").length;

  const since = new Date();
  since.setDate(since.getDate() - 7);
  const newFindings = await db
    .select({ id: findings.id })
    .from(findings)
    .innerJoin(scans, eq(findings.scanId, scans.id))
    .where(and(inArray(scans.repoId, repoIds), gte(scans.createdAt, since), eq(findings.status, "open")));

  return { repos: lines, highCount, mediumCount, lowCount, newFindingsThisWeek: newFindings.length };
}
