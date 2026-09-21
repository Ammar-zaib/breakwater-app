"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateAnthropicKey,
  updateAlertEmail,
  sendTestAlert,
  createApiKey,
  revokeApiKey,
  updateWebhookSettings,
  updateDigestPreference,
} from "@/app/actions";

export function AnthropicKeyForm({ hasKey }: { hasKey: boolean }) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div>
      <p className="text-sm text-ink-dim mb-3">
        {hasKey
          ? "A key is saved and encrypted. Enter a new one to replace it, or leave blank and save to remove it."
          : "Breakwater scans run on your own Claude usage, not a shared key — get one at "}
        {!hasKey ? (
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-accent underline">
            console.anthropic.com
          </a>
        ) : null}
        {!hasKey ? "." : null}
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          placeholder={hasKey ? "sk-ant-••••••••••••" : "sk-ant-..."}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 border border-line rounded-lg px-3 py-2 text-sm font-mono bg-bg"
        />
        <button
          onClick={() =>
            startTransition(async () => {
              await updateAnthropicKey(value);
              setValue("");
              setStatus("Saved.");
              setTimeout(() => setStatus(null), 2500);
            })
          }
          disabled={isPending}
          className="text-sm font-semibold bg-accent text-accent-ink rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {status ? <p className="mt-2 text-xs text-low">{status}</p> : null}
    </div>
  );
}

export function AlertEmailForm({ currentEmail }: { currentEmail: string }) {
  const [value, setValue] = useState(currentEmail);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div>
      <p className="text-sm text-ink-dim mb-3">Where alert emails go. Defaults to your GitHub email.</p>
      <div className="flex gap-2">
        <input
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 border border-line rounded-lg px-3 py-2 text-sm bg-bg"
        />
        <button
          onClick={() =>
            startTransition(async () => {
              await updateAlertEmail(value);
              setStatus("Saved.");
              setTimeout(() => setStatus(null), 2500);
            })
          }
          disabled={isPending}
          className="text-sm font-semibold bg-accent text-accent-ink rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {status ? <p className="mt-2 text-xs text-low">{status}</p> : null}
    </div>
  );
}

type ApiKeyRow = {
  id: string;
  label: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

export function ApiKeysManager({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <p className="text-sm text-ink-dim mb-3">
        Read-only access to your repos and latest scans from scripts or CI — see{" "}
        <code className="text-[12.5px] bg-surface-2 px-1.5 py-0.5 rounded">GET /api/v1/repos</code>.
      </p>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Key label (e.g. CI pipeline)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1 border border-line rounded-lg px-3 py-2 text-sm bg-bg"
        />
        <button
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                const raw = await createApiKey(label || "Default key");
                setRevealedKey(raw);
                setLabel("");
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Couldn't create a key.");
              }
            })
          }
          disabled={isPending}
          className="text-sm font-semibold bg-accent text-accent-ink rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          {isPending ? "Creating…" : "Create key"}
        </button>
      </div>
      {error ? <p className="text-xs text-high mb-3">{error}</p> : null}

      {revealedKey ? (
        <div className="mb-4 border border-accent/40 bg-surface-2 rounded-lg px-3 py-2.5">
          <p className="text-[11px] text-ink-dim mb-1">
            Copy this now — it won&apos;t be shown again.
          </p>
          <code className="block text-[12.5px] font-mono break-all">{revealedKey}</code>
        </div>
      ) : null}

      {initialKeys.length === 0 ? (
        <p className="text-sm text-low">No API keys yet.</p>
      ) : (
        <ul className="divide-y divide-line border border-line rounded-lg overflow-hidden">
          {initialKeys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm truncate">{k.label}</p>
                <p className="text-[11px] text-ink-dim font-mono mt-0.5">
                  {k.keyPrefix}… · {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!confirm(`Revoke "${k.label}"? Anything using it will stop working immediately.`)) return;
                  startTransition(async () => {
                    await revokeApiKey(k.id);
                    router.refresh();
                  });
                }}
                disabled={isPending}
                className="text-xs font-medium text-high hover:underline disabled:opacity-50 shrink-0"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WebhookSettingsForm({
  webhookUrl,
  slackWebhookUrl,
  teamsWebhookUrl,
  pagerDutyIntegrationKey,
}: {
  webhookUrl: string;
  slackWebhookUrl: string;
  teamsWebhookUrl: string;
  pagerDutyIntegrationKey: string;
}) {
  const [webhook, setWebhook] = useState(webhookUrl);
  const [slack, setSlack] = useState(slackWebhookUrl);
  const [teams, setTeams] = useState(teamsWebhookUrl);
  const [pagerDuty, setPagerDuty] = useState(pagerDutyIntegrationKey);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function save() {
    startTransition(async () => {
      await updateWebhookSettings(webhook, slack, teams, pagerDuty);
      setStatus("Saved.");
      setTimeout(() => setStatus(null), 2500);
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-ink-dim mb-1.5">
          Webhook URL <span className="text-ink-dim/70">(optional — receives a JSON POST on every alert)</span>
        </label>
        <input
          type="url"
          placeholder="https://your-service.example.com/webhooks/breakwater"
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
          className="w-full border border-line rounded-lg px-3 py-2 text-sm font-mono bg-bg"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-dim mb-1.5">
          Slack incoming webhook URL <span className="text-ink-dim/70">(optional)</span>
        </label>
        <input
          type="url"
          placeholder="https://hooks.slack.com/services/…"
          value={slack}
          onChange={(e) => setSlack(e.target.value)}
          className="w-full border border-line rounded-lg px-3 py-2 text-sm font-mono bg-bg"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-dim mb-1.5">
          Microsoft Teams webhook URL <span className="text-ink-dim/70">(optional)</span>
        </label>
        <input
          type="url"
          placeholder="https://….webhook.office.com/webhookb2/…"
          value={teams}
          onChange={(e) => setTeams(e.target.value)}
          className="w-full border border-line rounded-lg px-3 py-2 text-sm font-mono bg-bg"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-dim mb-1.5">
          PagerDuty integration key{" "}
          <span className="text-ink-dim/70">(optional — only pages on high-risk findings)</span>
        </label>
        <input
          type="text"
          placeholder="32-character Events API v2 key"
          value={pagerDuty}
          onChange={(e) => setPagerDuty(e.target.value)}
          className="w-full border border-line rounded-lg px-3 py-2 text-sm font-mono bg-bg"
        />
      </div>
      <button
        onClick={save}
        disabled={isPending}
        className="text-sm font-semibold bg-accent text-accent-ink rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      {status ? <p className="text-xs text-low">{status}</p> : null}
    </div>
  );
}

export function DigestPreferenceToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next); // optimistic — a weekly email preference isn't worth a loading flicker
    startTransition(async () => {
      try {
        await updateDigestPreference(next);
      } catch {
        setEnabled(!next);
      }
    });
  }

  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={enabled}
        disabled={isPending}
        onChange={toggle}
        className="w-4 h-4 accent-accent"
      />
      <span className="text-sm">
        Send me a weekly summary email of my account&apos;s risk posture across every watched repo
      </span>
    </label>
  );
}

export function TestAlertButton() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div>
      <button
        onClick={() =>
          startTransition(async () => {
            try {
              const results = await sendTestAlert();
              const ok = results.filter((r) => r.ok).map((r) => r.channel);
              const failed = results.filter((r) => !r.ok).map((r) => r.channel);
              setStatus(
                [
                  ok.length ? `Sent: ${ok.join(", ")}.` : null,
                  failed.length ? `Failed: ${failed.join(", ")}.` : null,
                ]
                  .filter(Boolean)
                  .join(" ")
              );
            } catch (e) {
              setStatus(e instanceof Error ? e.message : "Couldn't send it.");
            }
          })
        }
        disabled={isPending}
        className="text-sm font-semibold border border-line rounded-lg px-4 py-2 hover:bg-surface-2 transition-colors disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send test alert"}
      </button>
      {status ? <p className="mt-2 text-xs text-ink-dim">{status}</p> : null}
    </div>
  );
}
