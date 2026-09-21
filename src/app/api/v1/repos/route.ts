import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, repos, scans, vendorWatches } from "@/db/schema";
import { hashApiKey } from "@/lib/api-keys";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

/**
 * Read-only programmatic access: `GET /api/v1/repos` with
 * `Authorization: Bearer <your Breakwater API key>` (generated in
 * Settings) returns every repo on that account and its latest scan —
 * for CI, dashboards, or scripts. Nothing here can write anything.
 */
export async function GET(request: NextRequest) {
  // Coarse per-IP throttle before even looking at the key — this endpoint
  // is reachable by anyone on the internet with no session required.
  const ipLimit = rateLimit(`v1-repos:ip:${clientIpFromHeaders(request.headers)}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(ipLimit.retryAfterMs / 1000)) } }
    );
  }

  const authHeader = request.headers.get("authorization");
  const raw = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
  if (!raw) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <api key> header." },
      { status: 401 }
    );
  }

  // Per-key throttle too, keyed by hash (never the raw key) — legitimate CI
  // usage is well under this; it mainly protects against a single
  // misbehaving script hammering the endpoint.
  const keyHash = hashApiKey(raw);
  const keyLimit = rateLimit(`v1-repos:key:${keyHash}`, { limit: 60, windowMs: 60_000 });
  if (!keyLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(keyLimit.retryAfterMs / 1000)) } }
    );
  }

  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
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
