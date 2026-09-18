import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, repos, scans, vendorWatches } from "@/db/schema";
import { hashApiKey } from "@/lib/api-keys";

/**
 * Read-only programmatic access: `GET /api/v1/repos` with
 * `Authorization: Bearer <your Breakwater API key>` (generated in
 * Settings) returns every repo on that account and its latest scan —
 * for CI, dashboards, or scripts. Nothing here can write anything.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const raw = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
  if (!raw) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <api key> header." },
      { status: 401 }
    );
  }

  const [key] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hashApiKey(raw)));
  if (!key) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  try {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
  } catch {
    // Not fatal — the key still works even if we couldn't record last-used.
  }

  const userRepos = await db.select().from(repos).where(eq(repos.userId, key.userId));
  const data = await Promise.all(
    userRepos.map(async (repo) => {
      const [watch] = await db.select().from(vendorWatches).where(eq(vendorWatches.repoId, repo.id));
      const [latestScan] = await db
        .select()
        .from(scans)
        .where(eq(scans.repoId, repo.id))
        .orderBy(desc(scans.createdAt))
        .limit(1);
      return {
        id: repo.id,
        fullName: repo.fullName,
        private: repo.private,
        vendor: watch?.vendor ?? null,
        latestScan: latestScan
          ? {
              id: latestScan.id,
              overallRisk: latestScan.overallRisk,
              summary: latestScan.summary,
              createdAt: latestScan.createdAt,
            }
          : null,
      };
    })
  );

  return NextResponse.json({ repos: data });
}
