"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { triggerScan, disconnectRepo, getScanDetail } from "@/app/actions";
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

type ScanRow = {
  id: string;
  overallRisk: string;
  summary: string;
  triggeredBy: string;
  createdAt: Date;
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
};

export function ScanHistory({ scans, canEdit = true }: { scans: ScanRow[]; canEdit?: boolean }) {
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
            {loading ? (
              <p className="text-sm text-ink-dim">Loading findings…</p>
            ) : findings && findings.length > 0 ? (
              <div className="space-y-3">
                {findings.map((f) => (
                  <FindingCard key={f.id} finding={f} canEdit={canEdit} />
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
