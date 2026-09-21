import Link from "next/link";
import { eq, inArray, desc, and, gte } from "drizzle-orm";
import { db } from "@/db";
import { repos, scans, vendorWatches, findings } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { getActiveWorkspace } from "@/lib/workspace";
import { PageHeader, Card, RiskPill, EmptyState } from "@/components/ui";
import { VENDOR_LABELS } from "@/lib/vendors";
import { RiskTrendChart, type TrendDay } from "@/components/risk-trend-chart";

const TREND_DAYS = 14;

export default async function OverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const workspace = await getActiveWorkspace(user.id);
  const userRepos = await db.select().from(repos).where(eq(repos.userId, workspace.ownerId));
  const repoIds = userRepos.map((r) => r.id);

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

      // "Effective" risk excludes findings that have since been reviewed and
      // accepted — a repo whose only open finding was accepted shouldn't
      // still count toward "high risk right now".
      let effectiveRisk: string | null = null;
      if (latestScan) {
        const openFindings = await db
          .select({ severity: findings.severity })
          .from(findings)
          .where(and(eq(findings.scanId, latestScan.id), eq(findings.status, "open")));
        effectiveRisk = openFindings.some((f) => f.severity === "high")
          ? "high"
          : openFindings.some((f) => f.severity === "medium")
            ? "medium"
            : "low";
      }

      return { repo, vendor: watch?.vendor, latestScan, effectiveRisk };
    })
  );

  const withRisk = repoLatest.filter((r) => r.latestScan);
  const highCount = withRisk.filter((r) => r.effectiveRisk === "high").length;
  const mediumCount = withRisk.filter((r) => r.effectiveRisk === "medium").length;

  // Recent open findings across every watched repo, newest scan first.
  const recentFindings =
    repoIds.length > 0
      ? await db
          .select({
            finding: findings,
            scanCreatedAt: scans.createdAt,
            repoId: repos.id,
            repoFullName: repos.fullName,
            vendor: scans.vendor,
          })
          .from(findings)
          .innerJoin(scans, eq(findings.scanId, scans.id))
          .innerJoin(repos, eq(scans.repoId, repos.id))
          .where(and(inArray(repos.id, repoIds), eq(findings.status, "open")))
          .orderBy(desc(scans.createdAt))
          .limit(8)
      : [];

  // Scan volume by risk level, last 14 days, for the trend chart.
  const since = new Date();
  since.setDate(since.getDate() - (TREND_DAYS - 1));
  since.setHours(0, 0, 0, 0);
  const recentScans =
    repoIds.length > 0
      ? await db
          .select({ overallRisk: scans.overallRisk, createdAt: scans.createdAt })
          .from(scans)
          .where(and(inArray(scans.repoId, repoIds), gte(scans.createdAt, since)))
      : [];
  const trendDays = buildTrendDays(recentScans, TREND_DAYS);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Everything Breakwater is watching, at a glance."
        action={
          <div className="flex items-center gap-4">
            <a
              href="/dashboard/export"
              className="text-sm font-medium text-ink-dim hover:text-ink transition-colors"
            >
              Export CSV
            </a>
            <a
              href="/api/reports/risk"
              className="text-sm font-medium text-ink-dim hover:text-ink transition-colors"
            >
              Download PDF report
            </a>
            <Link
              href="/dashboard/repositories"
              className="text-sm font-semibold bg-accent text-accent-ink rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Manage repositories
            </Link>
          </div>
        }
      />

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Repositories watched" value={String(userRepos.length)} />
          <Stat label="High risk right now" value={String(highCount)} tone={highCount > 0 ? "high" : undefined} />
          <Stat label="Medium risk right now" value={String(mediumCount)} tone={mediumCount > 0 ? "medium" : undefined} />
        </div>

        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3">Scan activity, last {TREND_DAYS} days</h2>
          <RiskTrendChart days={trendDays} />
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
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
                {repoLatest.map(({ repo, vendor, latestScan, effectiveRisk }) => (
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
                      {latestScan && effectiveRisk ? <RiskPill risk={effectiveRisk} /> : (
                        <span className="text-xs text-ink-dim">Pending</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="px-5 py-4 border-b border-line">
              <h2 className="text-sm font-semibold">Recent findings across all repos</h2>
            </div>
            {recentFindings.length === 0 ? (
              <EmptyState title="Nothing open" body="No open findings across any watched repository right now." />
            ) : (
              <ul className="divide-y divide-line">
                {recentFindings.map((row) => (
                  <li key={row.finding.id}>
                    <Link
                      href={`/dashboard/repositories/${row.repoId}`}
                      className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm truncate">{row.finding.title}</p>
                        <p className="text-xs text-ink-dim mt-0.5 truncate">
                          {row.repoFullName} · {VENDOR_LABELS[row.vendor]} · {timeAgo(row.scanCreatedAt)}
                        </p>
                      </div>
                      <RiskPill risk={row.finding.severity} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function buildTrendDays(
  rows: { overallRisk: string; createdAt: Date }[],
  numDays: number
): TrendDay[] {
  const buckets = new Map<string, TrendDay>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), high: 0, medium: 0, low: 0 });
  }

  for (const row of rows) {
    const key = new Date(row.createdAt).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (row.overallRisk === "high") bucket.high += 1;
    else if (row.overallRisk === "medium") bucket.medium += 1;
    else bucket.low += 1;
  }

  return Array.from(buckets.values());
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
