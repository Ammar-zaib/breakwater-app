import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { repos, vendorWatches, scans, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { getRoleForOwner, roleAtLeast } from "@/lib/access";
import { listAssignableUsers, listIgnoreRules } from "@/app/actions";
import { PageHeader, Card } from "@/components/ui";
import { ScanNowButton, DisconnectButton, ScanHistory, PrScanToggle, SuppressionRulesList, ExtraBranchControl } from "@/components/scan-controls";
import { VENDOR_LABELS } from "@/lib/vendors";

export default async function RepositoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const [repo] = await db.select().from(repos).where(eq(repos.id, id));
  if (!repo) notFound();

  const role = await getRoleForOwner(user.id, repo.userId);
  if (!role) notFound();
  const canEdit = roleAtLeast(role, "editor");
  const canManage = roleAtLeast(role, "admin");

  const [owner] = repo.userId === user.id ? [user] : await db.select().from(users).where(eq(users.id, repo.userId));

  const [watch] = await db.select().from(vendorWatches).where(eq(vendorWatches.repoId, repo.id));
  const scanRows = await db
    .select()
    .from(scans)
    .where(eq(scans.repoId, repo.id))
    .orderBy(desc(scans.createdAt))
    .limit(20);
  const assignableUsers = canEdit ? await listAssignableUsers(repo.id) : [];
  const ignoreRuleRows = await listIgnoreRules(repo.id);

  return (
    <div>
      <PageHeader
        title={repo.fullName}
        description={`Watching ${watch ? VENDOR_LABELS[watch.vendor] : "no vendor yet"} · scans run automatically every day, or on demand.${
          repo.userId !== user.id ? ` · shared by ${owner?.email ?? owner?.name ?? "the owner"}` : ""
        }`}
        action={
          <div className="flex items-center gap-4">
            <a
              href={`/dashboard/export?repoId=${repo.id}`}
              className="text-sm font-medium text-ink-dim hover:text-ink transition-colors"
            >
              Export CSV
            </a>
            {watch && canEdit ? <ScanNowButton repoId={repo.id} vendor={watch.vendor} /> : null}
          </div>
        }
      />
      <div className="p-8 space-y-6">
        <Card className="p-5">
          {scanRows.length === 0 ? (
            <p className="text-sm text-ink-dim py-6 text-center">
              {canEdit
                ? 'No scans yet. Click "Scan now" to run the first one.'
                : "No scans yet."}
            </p>
          ) : (
            <ScanHistory scans={scanRows} canEdit={canEdit} assignableUsers={assignableUsers} />
          )}
          <SuppressionRulesList rules={ignoreRuleRows} canEdit={canEdit} />
        </Card>

        {watch && (canManage || repo.extraBranch) ? (
          <Card className="p-4">
            <ExtraBranchControl
              repoId={repo.id}
              vendor={watch.vendor}
              initialBranch={repo.extraBranch}
              canManage={canManage}
              canEdit={canEdit}
            />
          </Card>
        ) : null}

        {canManage ? (
          <div className="flex items-center justify-between">
            <PrScanToggle repoId={repo.id} enabled={repo.prScanEnabled} />
            <DisconnectButton repoId={repo.id} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
