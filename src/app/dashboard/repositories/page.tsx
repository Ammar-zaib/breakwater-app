import Link from "next/link";
import { eq, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { repos, vendorWatches, scans } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { getOwnerIds } from "@/lib/access";
import { PageHeader, Card, RiskPill, EmptyState } from "@/components/ui";
import { AddRepoDialog } from "@/components/add-repo-dialog";
import { VENDOR_LABELS } from "@/lib/vendors";

export default async function RepositoriesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const ownerIds = await getOwnerIds(user.id);
  const userRepos = await db
    .select()
    .from(repos)
    .where(inArray(repos.userId, ownerIds))
    .orderBy(desc(repos.connectedAt));

  const rows = await Promise.all(
    userRepos.map(async (repo) => {
      const [watch] = await db.select().from(vendorWatches).where(eq(vendorWatches.repoId, repo.id));
      const [latestScan] = await db
        .select()
        .from(scans)
        .where(eq(scans.repoId, repo.id))
        .orderBy(desc(scans.createdAt))
        .limit(1);
      return { repo, vendor: watch?.vendor, latestScan };
    })
  );

  return (
    <div>
      <PageHeader
        title="Repositories"
        description="Every repo Breakwater watches, and what it's watching for."
        action={<AddRepoDialog />}
      />
      <div className="p-8">
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              title="No repositories connected"
              body="Connect one to start watching it automatically — Breakwater runs a first scan the moment it's added."
            />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map(({ repo, vendor, latestScan }) => (
                <li key={repo.id}>
                  <Link
                    href={`/dashboard/repositories/${repo.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm truncate">{repo.fullName}</p>
                      <p className="text-xs text-ink-dim mt-0.5">
                        {vendor ? VENDOR_LABELS[vendor] : "No vendor"} · {repo.private ? "private" : "public"}
                      </p>
                    </div>
                    {latestScan ? <RiskPill risk={latestScan.overallRisk} /> : (
                      <span className="text-xs text-ink-dim shrink-0">Not scanned yet</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
