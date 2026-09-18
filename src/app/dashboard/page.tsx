import Link from "next/link";
import { eq, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { repos, scans, vendorWatches } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { getOwnerIds } from "@/lib/access";
import { PageHeader, Card, RiskPill, EmptyState } from "@/components/ui";
import { VENDOR_LABELS } from "@/lib/vendors";

export default async function OverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const ownerIds = await getOwnerIds(user.id);
  const userRepos = await db.select().from(repos).where(inArray(repos.userId, ownerIds));

  const repoLatest = await Promise.all(
    userRepos.map(async (repo) => {
      const [watch] = await db
        .select()
        .from(vendorWatches)
        .where(eq(vendorWatches.repoId, repo.id));
      const [latestScan] = await db
        .select()
        .from(scans)
        .where(eq(scans.repoId, repo.id))
        .orderBy(desc(scans.createdAt))
        .limit(1);
      return { repo, vendor: watch?.vendor, latestScan };
    })
  );

  const withRisk = repoLatest.filter((r) => r.latestScan);
  const highCount = withRisk.filter((r) => r.latestScan?.overallRisk === "high").length;
  const mediumCount = withRisk.filter((r) => r.latestScan?.overallRisk === "medium").length;

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Everything Breakwater is watching, at a glance."
        action={
          <Link
            href="/dashboard/repositories"
            className="text-sm font-semibold bg-accent text-accent-ink rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
          >
            Manage repositories
          </Link>
        }
      />

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Repositories watched" value={String(userRepos.length)} />
          <Stat label="High risk right now" value={String(highCount)} tone={highCount > 0 ? "high" : undefined} />
          <Stat label="Medium risk right now" value={String(mediumCount)} tone={mediumCount > 0 ? "medium" : undefined} />
        </div>

        <Card>
          <div className="px-5 py-4 border-b border-line">
            <h2 className="text-sm font-semibold">Watched repositories</h2>
          </div>
          {repoLatest.length === 0 ? (
            <EmptyState
              title="Nothing connected yet"
              body="Connect a repository to start watching it — Breakwater will run its first scan automatically."
            />
          ) : (
            <ul className="divide-y divide-line">
              {repoLatest.map(({ repo, vendor, latestScan }) => (
                <li key={repo.id}>
                  <Link
                    href={`/dashboard/repositories/${repo.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm truncate">{repo.fullName}</p>
                      <p className="text-xs text-ink-dim mt-0.5">
                        {vendor ? VENDOR_LABELS[vendor] : "No vendor"}
                        {latestScan ? ` · scanned ${timeAgo(latestScan.createdAt)}` : " · not scanned yet"}
                      </p>
                    </div>
                    {latestScan ? <RiskPill risk={latestScan.overallRisk} /> : (
                      <span className="text-xs text-ink-dim">Pending</span>
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "high" | "medium" }) {
  const toneClass = tone === "high" ? "text-high" : tone === "medium" ? "text-medium" : "text-ink";
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-dim">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold font-mono ${toneClass}`}>{value}</p>
    </Card>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
