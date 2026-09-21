"use client";

import { useState, useTransition } from "react";
import { openFixPR, acceptFinding, reopenFinding } from "@/app/actions";

type Risk = "high" | "medium" | "low";

const RISK_STYLES: Record<Risk, string> = {
  high: "text-high bg-high-bg border border-high/30",
  medium: "text-medium bg-medium-bg border border-medium/30",
  low: "text-low bg-low-bg border border-low/30",
};

export function RiskPill({ risk }: { risk: string }) {
  const r = (["high", "medium", "low"].includes(risk) ? risk : "low") as Risk;
  return (
    <span
      className={`inline-block font-mono text-[10.5px] font-semibold uppercase tracking-wide rounded-full px-2.5 py-1 whitespace-nowrap ${RISK_STYLES[r]}`}
    >
      {r} risk
    </span>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-8 pt-8 pb-6 border-b border-line">
      <div>
        <h1 className="font-display font-medium text-[23px] tracking-tight">{title}</h1>
        {description ? <p className="mt-2 text-sm text-ink-dim max-w-2xl">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-surface border border-line rounded-2xl shadow-[0_22px_44px_-30px_rgba(0,0,0,0.65)] ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center py-16 px-6 text-ink-dim">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm max-w-sm mx-auto">{body}</p>
    </div>
  );
}

const SEV_STRIPE: Record<Risk, string> = {
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
};
const SEV_TEXT: Record<Risk, string> = {
  high: "text-high",
  medium: "text-medium",
  low: "text-low",
};

export function FindingCard({
  finding,
  canEdit = true,
}: {
  finding: {
    id: string;
    severity: string;
    title: string;
    explanation: string;
    evidence: string;
    filePath?: string | null;
    recommendation: string;
    prStatus?: string | null;
    prUrl?: string | null;
    prError?: string | null;
    status?: string | null;
    acceptedReason?: string | null;
  };
  /** Viewers can see PR status but not trigger a new fix PR. */
  canEdit?: boolean;
}) {
  const sev = (["high", "medium", "low"].includes(finding.severity) ? finding.severity : "low") as Risk;
  const [isPending, startTransition] = useTransition();
  const [prStatus, setPrStatus] = useState(finding.prStatus ?? "none");
  const [prUrl, setPrUrl] = useState(finding.prUrl ?? null);
  const [prError, setPrError] = useState(finding.prError ?? null);
  const [status, setStatus] = useState(finding.status ?? "open");
  const [acceptedReason, setAcceptedReason] = useState(finding.acceptedReason ?? null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  function handleOpenFixPR() {
    setPrStatus("generating");
    setPrError(null);
    startTransition(async () => {
      try {
        const result = await openFixPR(finding.id);
        setPrStatus("open");
        setPrUrl(result.prUrl);
      } catch (e) {
        setPrStatus("error");
        setPrError(e instanceof Error ? e.message : "Couldn't open the fix PR.");
      }
    });
  }

  function handleAccept() {
    const reason = window.prompt(
      "Optional note on why this risk is being accepted (shown in the audit log):",
      ""
    );
    if (reason === null) return; // cancelled
    setAcceptError(null);
    startTransition(async () => {
      try {
        await acceptFinding(finding.id, reason);
        setStatus("accepted");
        setAcceptedReason(reason.trim() || null);
      } catch (e) {
        setAcceptError(e instanceof Error ? e.message : "Couldn't accept this finding.");
      }
    });
  }

  function handleReopen() {
    setAcceptError(null);
    startTransition(async () => {
      try {
        await reopenFinding(finding.id);
        setStatus("open");
        setAcceptedReason(null);
      } catch (e) {
        setAcceptError(e instanceof Error ? e.message : "Couldn't reopen this finding.");
      }
    });
  }

  return (
    <div
      className={`grid grid-cols-[4px_1fr] gap-3.5 border border-line rounded-xl overflow-hidden bg-surface ${
        status === "accepted" ? "opacity-70" : ""
      }`}
    >
      <div className={status === "accepted" ? "bg-ink-dim" : SEV_STRIPE[sev]} />
      <div className="py-3 pr-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium text-sm">{finding.title}</span>
          <span className="flex items-center gap-1.5 shrink-0">
            {status === "accepted" ? (
              <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-ink-dim">
                accepted risk
              </span>
            ) : null}
            <span className={`font-mono text-[10px] font-bold uppercase tracking-wide ${SEV_TEXT[sev]}`}>
              {sev}
            </span>
          </span>
        </div>
        {finding.filePath ? (
          <p className="mt-0.5 font-mono text-[11px] text-ink-dim">{finding.filePath}</p>
        ) : null}
        <p className="mt-1.5 text-[13px] text-ink-dim leading-relaxed">{finding.explanation}</p>
        {finding.evidence ? (
          <pre className="mt-2 bg-abyss border border-line rounded-md px-2.5 py-2 text-[11px] overflow-x-auto whitespace-pre-wrap font-mono">
            {finding.evidence}
          </pre>
        ) : null}
        <p className="mt-2 text-[13px]">
          <span className="font-semibold text-accent">Fix: </span>
          {finding.recommendation}
        </p>
        {status === "accepted" && acceptedReason ? (
          <p className="mt-2 text-[12px] text-ink-dim italic">Accepted: {acceptedReason}</p>
        ) : null}

        {finding.filePath && (canEdit || (prStatus === "open" && prUrl)) ? (
          <div className="mt-3 pt-3 border-t border-line flex items-center gap-3 flex-wrap">
            {prStatus === "open" && prUrl ? (
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-accent hover:underline"
              >
                View fix PR ↗
              </a>
            ) : canEdit && status !== "accepted" ? (
              <button
                onClick={handleOpenFixPR}
                disabled={isPending || prStatus === "generating"}
                className="text-xs font-semibold bg-accent text-accent-ink rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {prStatus === "generating"
                  ? "Generating fix… (may take a minute)"
                  : prStatus === "error"
                    ? "Retry: open fix PR"
                    : "Open fix PR"}
              </button>
            ) : null}
            {canEdit && prStatus === "error" && prError ? (
              <span className="text-[11px] text-high">{prError}</span>
            ) : null}
            {canEdit && prStatus !== "open" && status !== "accepted" ? (
              <span className="text-[10.5px] text-ink-dim">
                Asks Claude to fix this file and opens a real PR for you to review — nothing merges automatically.
              </span>
            ) : null}
          </div>
        ) : null}

        {canEdit ? (
          <div className="mt-3 pt-3 border-t border-line flex items-center gap-3 flex-wrap">
            {status === "accepted" ? (
              <button
                onClick={handleReopen}
                disabled={isPending}
                className="text-xs font-semibold text-ink-dim hover:text-ink disabled:opacity-50"
              >
                Reopen
              </button>
            ) : (
              <button
                onClick={handleAccept}
                disabled={isPending}
                className="text-xs font-semibold text-ink-dim hover:text-ink disabled:opacity-50"
              >
                Accept risk
              </button>
            )}
            {acceptError ? <span className="text-[11px] text-high">{acceptError}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
