"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { listConnectableRepos, connectRepo } from "@/app/actions";
import { VENDOR_LABELS } from "@/lib/vendors";
import type { Vendor } from "@/db/schema";

type ConnectableRepo = {
  id: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
};

export function AddRepoDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableRepos, setAvailableRepos] = useState<ConnectableRepo[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [vendor, setVendor] = useState<Vendor>("stripe");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function openDialog() {
    setOpen(true);
    setError(null);
    setLoading(true);
    try {
      const repos = await listConnectableRepos();
      setAvailableRepos(repos);
      setSelectedId(repos[0]?.id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your GitHub repositories.");
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    const repo = availableRepos?.find((r) => r.id === selectedId);
    if (!repo) return;
    startTransition(async () => {
      try {
        await connectRepo(repo.id, repo.fullName, repo.defaultBranch, repo.private, vendor);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't connect that repository.");
      }
    });
  }

  return (
    <>
      <button
        onClick={openDialog}
        className="text-sm font-semibold bg-accent text-accent-ink rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
      >
        Connect repository
      </button>

      {open ? (
        <div className="fixed inset-0 bg-abyss/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-line rounded-2xl shadow-[0_22px_44px_-30px_rgba(0,0,0,0.65)] w-full max-w-md">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h2 className="text-sm font-semibold">Connect a repository</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-dim hover:text-ink text-sm"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              {loading ? (
                <p className="text-sm text-ink-dim">Loading your repositories…</p>
              ) : error ? (
                <p className="text-sm text-high">{error}</p>
              ) : availableRepos && availableRepos.length === 0 ? (
                <p className="text-sm text-ink-dim">
                  Every repository in your GitHub account is already connected.
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-ink-dim mb-1.5">
                      Repository
                    </label>
                    <select
                      value={selectedId}
                      onChange={(e) => setSelectedId(e.target.value)}
                      className="w-full border border-line rounded-lg px-3 py-2 text-sm bg-bg font-mono"
                    >
                      {availableRepos?.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-dim mb-1.5">
                      Vendor to watch
                    </label>
                    <select
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value as Vendor)}
                      className="w-full border border-line rounded-lg px-3 py-2 text-sm bg-bg"
                    >
                      {Object.entries(VENDOR_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="px-5 py-4 border-t border-line flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-ink-dim px-3 py-2 hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleConnect}
                disabled={!selectedId || isPending || loading}
                className="text-sm font-semibold bg-accent text-accent-ink rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? "Connecting…" : "Connect"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
