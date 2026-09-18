import { getCurrentUser } from "@/lib/current-user";
import { listTeamMembers, listMyTeamMemberships } from "@/app/actions";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { InviteTeamMemberForm, TeamMemberRow, ROLE_LABELS } from "@/components/team-form";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [members, memberships] = await Promise.all([listTeamMembers(), listMyTeamMemberships()]);

  return (
    <div>
      <PageHeader
        title="Team"
        description="Invite teammates to see and act on the repositories you watch, without sharing your GitHub or Claude credentials."
      />
      <div className="p-8 space-y-6 max-w-2xl">
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-1">Invite a teammate</h2>
          <InviteTeamMemberForm />
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="text-sm font-semibold">Your team</h2>
          </div>
          {members.length === 0 ? (
            <EmptyState
              title="No teammates yet"
              body="Invite someone above and they'll show up here once they've signed in."
            />
          ) : (
            <ul className="divide-y divide-line">
              {members.map((m) => (
                <TeamMemberRow key={m.id} member={m} />
              ))}
            </ul>
          )}
        </Card>

        {memberships.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="text-sm font-semibold">Teams you&apos;re on</h2>
            </div>
            <ul className="divide-y divide-line">
              {memberships.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-sm font-mono">{m.ownerEmail}</span>
                  <span className="text-xs text-ink-dim">{ROLE_LABELS[m.role] ?? m.role}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
