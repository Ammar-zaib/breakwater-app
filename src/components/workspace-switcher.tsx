"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveWorkspace } from "@/app/actions";
import type { WorkspaceOption } from "@/lib/workspace";

/** Only rendered when the user has access to more than one account — the
 *  common single-account case shows nothing, no empty dropdown clutter. */
export function WorkspaceSwitcher({
  options,
  activeOwnerId,
}: {
  options: WorkspaceOption[];
  activeOwnerId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (options.length <= 1) return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const ownerId = e.target.value;
    startTransition(async () => {
      await setActiveWorkspace(ownerId);
      router.refresh();
    });
  }

  return (
    <div className="px-3 pb-3">
      <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim mb-1 px-1">
        Workspace
      </label>
      <select
        value={activeOwnerId}
        onChange={handleChange}
        disabled={isPending}
        className="w-full text-xs bg-surface-2 border border-line rounded-lg px-2 py-1.5 text-ink disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.ownerId} value={o.ownerId}>
            {o.label} {o.ownerId !== activeOwnerId ? `(${o.role})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
