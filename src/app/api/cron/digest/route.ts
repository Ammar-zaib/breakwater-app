import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { repos, users } from "@/db/schema";
import { buildAccountDigest } from "@/lib/digest";
import { sendDigestEmail } from "@/lib/email";

export const maxDuration = 300;

/**
 * Scheduled entry point for the weekly risk-posture digest — separate from
 * /api/cron/scan (which re-scans repos) since this only reads back what's
 * already in the database and summarizes it. Meant to run weekly (see
 * DEPLOY_COOLIFY.md), not daily.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Every account that owns at least one repo, deduplicated — an account
  // with 3 repos should get one digest, not three.
  const ownerRows = await db.selectDistinct({ userId: repos.userId }).from(repos);
  const ownerIds = ownerRows.map((r) => r.userId);
  if (ownerIds.length === 0) {
    return NextResponse.json({ ranAt: new Date().toISOString(), results: [] });
  }

  const owners = await db.select().from(users).where(inArray(users.id, ownerIds));
  const ownerById = new Map(owners.map((u) => [u.id, u]));

  const results: { owner: string; status: string }[] = [];
  const dashboardUrl = `${process.env.NEXTAUTH_URL ?? ""}/dashboard`;
  const settingsUrl = `${process.env.NEXTAUTH_URL ?? ""}/dashboard/settings`;

  for (const ownerId of ownerIds) {
    const owner = ownerById.get(ownerId);
    if (!owner) continue;
    if (!owner.weeklyDigestEnabled) {
      results.push({ owner: owner.email ?? ownerId, status: "skipped: digest disabled" });
      continue;
    }
    const to = owner.alertEmail || owner.email;
    if (!to) {
      results.push({ owner: ownerId, status: "skipped: no email" });
      continue;
    }

    try {
      const digest = await buildAccountDigest(ownerId);
      if (!digest) {
        results.push({ owner: to, status: "skipped: no repos" });
        continue;
      }
      await sendDigestEmail({
        to,
        highCount: digest.highCount,
        mediumCount: digest.mediumCount,
        lowCount: digest.lowCount,
        newFindingsThisWeek: digest.newFindingsThisWeek,
        repos: digest.repos,
        dashboardUrl,
        settingsUrl,
      });
      results.push({ owner: to, status: "sent" });
    } catch (err) {
      results.push({ owner: to, status: `error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}
