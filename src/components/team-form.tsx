"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteTeamMember, updateTeamMemberRole, removeTeamMember } from "@/app/actions";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_HELP: Record<string, string> = {
  admin: "Everything but transferring or deleting the account — can disconnect repos, manage the team.",
  editor: "Can trigger scans and open fix PRs, but can't disconnect repos or manage the team.",
  viewer: "Can see repos, scans, and findings, but can't change anything.",
};

export function InviteTeamMemberForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        <input
          type="email"
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-[200px] border border-line rounded-lg px-3 py-2 text-sm bg-bg"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-bg"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                await inviteTeamMember(email, role);
                setEmail("");
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Couldn't send that invite.");
              }
            })
          }
          disabled={isPending || !email}
          className="text-sm font-semibold bg-accent text-accent-ink rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {isPending ? "Inviting…" : "Invite"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-ink-dim">{ROLE_HELP[role]}</p>
      {error ? <p className="mt-2 text-xs text-high">{error}</p> : null}
      <p className="mt-2 text-[11px] text-ink-dim">
        They&apos;ll get access the moment they sign in to Breakwater with GitHub using this email — no separate
        invite email is sent yet, so let them know directly.
      </p>
    </div>
  );
}

type Member = {
  id: string;
  memberEmail: string;
  role: string;
  acceptedAt: Date | null;
};

export function TeamMemberRow({ member }: { member: Member }) {
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState(member.role);
  const [removed, setRemoved] = useState(false);
  const router = useRouter();

  if (removed) return null;

  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <p className="text-sm font-mono truncate">{member.memberEmail}</p>
        <p className="text-[11px] text-ink-dim mt-0.5">
          {member.acceptedAt ? "Active" : "Invited — waiting for first sign-in"}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={role}
          disabled={isPending}
          onChange={(e) => {
            const next = e.target.value;
            setRole(next);
            startTransition(async () => {
              await updateTeamMemberRole(member.id, next);
              router.refresh();
            });
          }}
          className="border border-line rounded-lg px-2 py-1.5 text-xs bg-bg"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button
          onClick={() => {
            if (!confirm(`Remove ${member.memberEmail} from your team?`)) return;
            startTransition(async () => {
              await removeTeamMember(member.id);
              setRemoved(true);
              router.refresh();
            });
          }}
          disabled={isPending}
          className="text-xs font-medium text-high hover:underline disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export { ROLE_LABELS };
