import { listAuditLog } from "@/app/actions";
import { PageHeader, Card, EmptyState } from "@/components/ui";

const ACTION_LABELS: Record<string, string> = {
  "repo.connect": "Connected repository",
  "repo.disconnect": "Disconnected repository",
  "scan.trigger": "Ran a scan",
  "settings.anthropic_key_update": "Updated Anthropic API key",
  "settings.alert_email_update": "Updated alert email",
  "settings.webhook_update": "Updated webhook settings",
  "finding.pr_open": "Opened a fix PR",
  "finding.pr_open_failed": "Fix PR failed to open",
  "finding.accept": "Accepted a finding",
  "finding.reopen": "Reopened a finding",
  "repo.prscan_enable": "Enabled PR-triggered scanning",
  "repo.prscan_disable": "Disabled PR-triggered scanning",
  "team.invite": "Invited a team member",
  "team.role_change": "Changed a team member's role",
  "team.remove": "Removed a team member",
  "apikey.create": "Created an API key",
  "apikey.revoke": "Revoked an API key",
};

const ACTION_TONE: Record<string, string> = {
  "repo.disconnect": "text-high",
  "finding.pr_open_failed": "text-high",
  "team.remove": "text-high",
  "apikey.revoke": "text-high",
  "repo.prscan_disable": "text-high",
};

function describeMetadata(action: string, metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  switch (action) {
    case "repo.connect":
    case "repo.disconnect":
      return typeof m.fullName === "string" ? m.fullName : null;
    case "scan.trigger":
      return [m.fullName, m.vendor, m.overallRisk ? `${m.overallRisk} risk` : null, typeof m.findingsCount === "number" ? `${m.findingsCount} finding(s)` : null]
        .filter(Boolean)
        .join(" · ");
    case "finding.pr_open":
    case "finding.pr_open_failed":
      return typeof m.filePath === "string" ? m.filePath : null;
    case "team.invite":
      return [m.email, m.role].filter(Boolean).join(" · ");
    case "team.role_change":
      return [m.email, m.fromRole && m.toRole ? `${m.fromRole} → ${m.toRole}` : null].filter(Boolean).join(" · ");
    case "team.remove":
      return typeof m.email === "string" ? m.email : null;
    case "apikey.create":
    case "apikey.revoke":
      return typeof m.label === "string" ? m.label : null;
    case "repo.prscan_enable":
    case "repo.prscan_disable":
      return typeof m.fullName === "string" ? m.fullName : null;
    default:
      return null;
  }
}

export default async function AuditLogPage() {
  let entries: Awaited<ReturnType<typeof listAuditLog>> = [];
  let error: string | null = null;
  try {
    entries = await listAuditLog();
  } catch (e) {
    error = e instanceof Error ? e.message : "Couldn't load the audit log.";
  }

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every account-changing action taken on your account — repository connections, scans, settings, team membership, and API keys — with who did it and when."
      />
      <div className="p-8">
        <Card>
          {error ? (
            <EmptyState title="Can't show this" body={error} />
          ) : entries.length === 0 ? (
            <EmptyState
              title="Nothing logged yet"
              body="Actions like connecting a repository, running a scan, or changing team roles will show up here."
            />
          ) : (
            <ul className="divide-y divide-line">
              {entries.map((entry) => {
                const detail = describeMetadata(entry.action, entry.metadata);
                return (
                  <li key={entry.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${ACTION_TONE[entry.action] ?? "text-ink"}`}>
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-dim truncate">
                        {entry.actorEmail ?? "Unknown user"}
                        {detail ? ` · ${detail}` : ""}
                      </p>
                    </div>
                    <span className="text-[11px] text-ink-dim shrink-0 font-mono">{timeAgo(entry.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
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
