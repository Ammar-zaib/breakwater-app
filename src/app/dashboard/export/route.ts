import { NextRequest, NextResponse } from "next/server";
import { eq, inArray, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { repos, scans, findings } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { getOwnerIds, getRoleForOwner } from "@/lib/access";

/**
 * CSV export of scan history — GET /dashboard/export, or
 * /dashboard/export?repoId=... to scope it to one repository. Same access
 * rule as everything else: viewer+ on the repo's owner account. A route
 * handler doesn't inherit the dashboard layout's auth redirect, so it
 * checks the session itself.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const repoId = req.nextUrl.searchParams.get("repoId");

  let scopeRepoIds: string[];
  let filenameHint = "all-repos";
  if (repoId) {
    const [repo] = await db.select().from(repos).where(eq(repos.id, repoId));
    if (!repo) return NextResponse.json({ error: "Repository not found." }, { status: 404 });
    const role = await getRoleForOwner(user.id, repo.userId);
    if (!role) return NextResponse.json({ error: "Repository not found." }, { status: 404 });
    scopeRepoIds = [repo.id];
    filenameHint = repo.fullName.replace(/[^a-zA-Z0-9_-]+/g, "-");
  } else {
    const ownerIds = await getOwnerIds(user.id);
    const userRepos = await db.select({ id: repos.id }).from(repos).where(inArray(repos.userId, ownerIds));
    scopeRepoIds = userRepos.map((r) => r.id);
  }

  if (scopeRepoIds.length === 0) {
    return csvResponse("repository,vendor,scanned_at,triggered_by,overall_risk,findings_count,summary\n", filenameHint);
  }

  const rows = await db
    .select({
      repoFullName: repos.fullName,
      vendor: scans.vendor,
      overallRisk: scans.overallRisk,
      triggeredBy: scans.triggeredBy,
      summary: scans.summary,
      createdAt: scans.createdAt,
      findingsCount: count(findings.id),
    })
    .from(scans)
    .innerJoin(repos, eq(scans.repoId, repos.id))
    .leftJoin(findings, eq(findings.scanId, scans.id))
    .where(inArray(scans.repoId, scopeRepoIds))
    .groupBy(scans.id, repos.id)
    .orderBy(desc(scans.createdAt));

  const header = "repository,vendor,scanned_at,triggered_by,overall_risk,findings_count,summary";
  const lines = rows.map((r) =>
    [
      r.repoFullName,
      r.vendor,
      new Date(r.createdAt).toISOString(),
      r.triggeredBy,
      r.overallRisk,
      String(r.findingsCount),
      r.summary,
    ]
      .map(csvEscape)
      .join(",")
  );

  return csvResponse([header, ...lines].join("\n") + "\n", filenameHint);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvResponse(csv: string, filenameHint: string): NextResponse {
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="breakwater-scans-${filenameHint}-${date}.csv"`,
    },
  });
}
