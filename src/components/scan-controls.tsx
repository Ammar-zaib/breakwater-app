"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { triggerScan, disconnectRepo, getScanDetail, togglePrScan, deleteIgnoreRule, setExtraBranch, triggerBranchScan } from "@/app/actions";
import { RiskPill, FindingCard } from "@/components/ui";
import type { Vendor } from "@/db/schema";

export function ScanNowButton({ repoId, vendor }: { repoId: string; vendor: Vendor }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <button
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await triggerScan(repoId, vendor);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Scan failed.");
            }
          })
        }
        disabled={isPending}
        className="text-sm font-semibold bg-accent text-accent-ink rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isPending ? "Scanning… (10–30s)" : "Scan now"}
      </button>
      {error ? <p className="mt-2 text-xs text-high max-w-xs text-right">{error}</p> : null}
    </div>
  );
}

export function DisconnectButton({ repoId }: { repoId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (!confirm("Stop watching this repository? Past scan history is deleted too.")) return;
        startTransition(async () => {
          await disconnectRepo(repoId);
          router.push("/dashboard/repositories");
        });
      }}
      disabled={isPending}
      className="text-xs font-medium text-high hover:underline disabled:opacity-50"
    >
      {isPending ? "Disconnecting…" : "Disconnect repository"}
    </button>
  );
}

export function PrScanToggle({ repoId, enabled }: { repoId: string; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleToggle() {
    const next = !isEnabled;
    if (next && !confirm("Scan every pull request against this repo automatically and post the results as a PR comment?")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await togglePrScan(repoId, next);
        setIsEnabled(next);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't update PR scanning.");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`text-xs font-semibold rounded-lg px-3 py-1.5 border transition-colors disabled:opacity-50 ${
          isEnabled
            ? "border-low/30 bg-low-bg text-low"
            : "border-line text-ink-dim hover:text-ink hover:bg-surface-2"
        }`}
      >
        {isPending ? "Updating…" : isEnabled ? "PR scanning: on" : "PR scanning: off"}
      </button>
      {error ? <span className="text-[11px] text-high">{error}</span> : null}
    </div>
  );
}

export function ExtraBranchControl({
  repoId,
  vendor,
  initialBranch,
  canManage,
  canEdit,
}: {
  repoId: string;
  vendor: Vendor;
  initialBranch: string | null;
  canManage: boolean;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [branch, setBranch] = useState(initialBranch ?? "");
  const [savedBranch, setSavedBranch] = useState(initialBranch);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const router = useRouter();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await setExtraBranch(repoId, branch);
        setSavedBranch(branch.trim() || null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't update the watched branch.");
      }
    });
  }

  function handleScan() {
    setScanError(null);
    startTransition(async () => {
      try {
        await triggerBranchScan(repoId, vendor);
        router.refresh();
      } catch (e) {
        setScanError(e instanceof Error ? e.message : "Branch scan failed.");
      }
    });
  }

  if (!canManage && !savedBranch) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-[11px] text-ink-dim shrink-0" htmlFor="extra-branch-input">
        Also watch branch:
      </label>
      {canManage ? (
        <>
          <input
            id="extra-branch-input"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="e.g. release"
            className="text-[12px] bg-surface-2 border border-line rounded-md px-2 py-1 text-ink w-32"
          />
          <button
            onClick={handleSave}
            disabled={isPending || branch === (savedBranch ?? "")}
            className="text-[11px] font-semibold text-ink-dim hover:text-ink disabled:opacity-50"
          >
            Save
          </button>
        </>
      ) : (
        <span className="text-[12px] font-mono">{savedBranch}</span>
      )}
      {savedBranch && canEdit ? (
        <button
          onClick={handleScan}
          disabled={isPending}
          className="text-[11px] font-semibold text-accent hover:underline disabled:opacity-50"
        >
          {isPending ? "Scanning…" : "Scan branch now"}
        </button>
      ) : null}
      {error ? <span className="text-[11px] text-high">{error}</span> : null}
      {scanError ? <span className="text-[11px] text-high">{scanError}</span> : null}
    </div>
  );
}

type IgnoreRuleRow = {
  id: string;
  vendor: string | null;
  titleContains: string | null;
  filePathContains: string | null;
  reason: string | null;
  createdAt: Date;
};

export function SuppressionRulesList({ rules: initial, canEdit }: { rules: IgnoreRuleRow[]; canEdit: boolean }) {
  const [rules, setRules] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (rules.length === 0) return null;

  function handleDelete(id: string) {
    if (!confirm("Remove this suppression rule? Future scans will start flagging matching findings again.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteIgnoreRule(id);
        setRules((prev) => prev.filter((r) => r.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove that rule.");
      }
    });
  }

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-ink-dim uppercase tracking-wide mb-2">Suppression rules</h3>
      <ul className="space-y-1.5">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className="flex items-center justify-between gap-3 text-[12px] border border-line rounded-lg px-3 py-2"
          >
            <span className="min-w-0 truncate text-ink-dim">
              {rule.titleContains ? `"${rule.titleContains}"` : "any title"}
              {rule.filePathContains ? ` in ${rule.filePathContains}` : ""}
              {rule.reason ? ` — ${rule.reason}` : ""}
            </span>
            {canEdit ? (
              <button
                onClick={() => handleDelete(rule.id)}
                disabled={isPending}
                className="text-[11px] font-medium text-high hover:underline disabled:opacity-50 shrink-0"
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? <p className="mt-1.5 text-[11px] text-high">{error}</p> : null}
    </div>
  );
}

type ScanRow = {
  id: string;
  overallRisk: string;
  summary: string;
  triggeredBy: string;
  createdAt: Date;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
};

type FindingRow = {
  id: string;
  severity: string;
  title: string;
  explanation: string;
  evidence: string;
  filePath: string | null;
  recommendation: string;
  prStatus?: string | null;
  prUrl?: string | null;
  prError?: string | null;
  status?: string | null;
  acceptedReason?: string | null;
  assignedTo?: string | null;
  assigneeEmail?: string | null;
};

export function ScanHistory({
  scans,
  canEdit = true,
  assignableUsers = [],
}: {
  scans: ScanRow[];
  canEdit?: boolean;
  assignableUsers?: { id: string; email: string | null }[];
}) {
  const [selected, setSelected] = useState<ScanRow | null>(scans[0] ?? null);
  // Cache of findings per scan id, so switching back to an already-viewed
  // scan doesn't refetch. `loading` is derived, not stored — the effect
  // below only ever sets state from inside its async callback.
  const [findingsByScan, setFindingsByScan] = useState<Record<string, FindingRow[]>>({});

  useEffect(() => {
    if (!selected || findingsByScan[selected.id]) return;
    let cancelled = false;
    getScanDetail(selected.id).then(({ findings }) => {
      if (!cancelled) {
        setFindingsByScan((prev) => ({ ...prev, [selected.id]: findings }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selected, findingsByScan]);

  const findings = selected ? (findingsByScan[selected.id] ?? null) : null;
  const loading = !!selected && !findings;

  if (scans.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-[220px_1fr] gap-5">
      <ul className="space-y-1.5">
        {scans.map((scan) => (
          <li key={scan.id}>
            <button
              onClick={() => setSelected(scan)}
              className={`w-full text-left rounded-lg px-3 py-2.5 border transition-colors ${
                selected?.id === scan.id
                  ? "border-accent bg-surface-2"
                  : "border-line hover:bg-surface-2"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <RiskPill risk={scan.overallRisk} />
                <span className="text-[10px] text-ink-dim uppercase tracking-wide">
                  {scan.triggeredBy}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-ink-dim">{timeAgo(scan.createdAt)}</p>
            </button>
          </li>
        ))}
      </ul>
      <div>
        {selected ? (
          <div>
            <p className="text-sm text-ink-dim mb-4">{selected.summary}</p>
            {typeof selected.estimatedCostUsd === "number" ? (
              <p className="text-[11px] text-ink-dim mb-4 -mt-2">
                ~${selected.estimatedCostUsd < 0.01 ? "<0.01" : selected.estimatedCostUsd.toFixed(2)} estimated
                {selected.inputTokens != null && selected.outputTokens != null
                  ? ` · ${(selected.inputTokens + selected.outputTokens).toLocaleString()} tokens`
                  : ""}
              </p>
            ) : null}
            {loading ? (
              <p className="text-sm text-ink-dim">Loading findings…</p>
            ) : findings && findings.length > 0 ? (
              <div className="space-y-3">
                {findings.map((f) => (
                  <FindingCard key={f.id} finding={f} canEdit={canEdit} assignableUsers={assignableUsers} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-low">No findings in this scan.</p>
            )}
          </div>
        ) : null}
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
