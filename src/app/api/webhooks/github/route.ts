import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { repos, vendorWatches, users } from "@/db/schema";
import { performPrScan } from "@/lib/scan-runner";
import { getGitHubToken } from "@/lib/current-user";
import { commentOnPullRequest } from "@/lib/github-comment";
import { VENDOR_LABELS } from "@/lib/vendors";

/**
 * GitHub webhook receiver for PR-triggered scanning. Only ever registered
 * on a repo when an admin explicitly turns on "Scan pull requests" for that
 * repo (see togglePrScan in src/app/actions.ts) — a repo with the feature
 * off never has a webhook pointed here, and a payload for a repo we don't
 * recognize (or don't have the feature enabled for) is a no-op, not an
 * error, since GitHub retries on non-2xx responses.
 */

const HANDLED_ACTIONS = new Set(["opened", "synchronize", "reopened"]);

const PullRequestPayloadSchema = z.object({
  action: z.string(),
  repository: z.object({ full_name: z.string() }),
  pull_request: z.object({
    number: z.number(),
    head: z.object({ sha: z.string() }),
  }),
});

function verifySignature(payload: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhooks/github] GITHUB_WEBHOOK_SECRET is not set — refusing to process webhooks.");
    return NextResponse.json({ error: "Webhook not configured on this server." }, { status: 500 });
  }

  const payload = await req.text();
  if (!verifySignature(payload, req.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const githubEvent = req.headers.get("x-github-event");
  if (githubEvent === "ping") return NextResponse.json({ ok: true });
  if (githubEvent !== "pull_request") {
    return NextResponse.json({ ok: true, skipped: `unhandled event: ${githubEvent}` });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const result = PullRequestPayloadSchema.safeParse(parsedBody);
  if (!result.success) {
    return NextResponse.json({ error: "Unexpected payload shape." }, { status: 400 });
  }
  const { action, repository, pull_request: pullRequest } = result.data;

  if (!HANDLED_ACTIONS.has(action)) {
    return NextResponse.json({ ok: true, skipped: `unhandled action: ${action}` });
  }

  const [repo] = await db
    .select()
    .from(repos)
    .where(and(eq(repos.fullName, repository.full_name), eq(repos.prScanEnabled, true)));
  if (!repo) {
    // Either not a repo Breakwater watches, or PR scanning has since been
    // disabled — a stale webhook delivery isn't an error.
    return NextResponse.json({ ok: true, skipped: "repo not found or PR scanning disabled" });
  }

  const [owner] = await db.select().from(users).where(eq(users.id, repo.userId));
  if (!owner?.anthropicApiKeyEncrypted) {
    return NextResponse.json({ ok: true, skipped: "repository owner has no Anthropic API key configured" });
  }

  const watches = await db
    .select()
    .from(vendorWatches)
    .where(and(eq(vendorWatches.repoId, repo.id), eq(vendorWatches.enabled, true)));
  if (watches.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no enabled vendor watches on this repo" });
  }

  const token = await getGitHubToken(owner.id);
  if (!token) {
    return NextResponse.json({ ok: true, skipped: "repository owner has no GitHub token on file" });
  }

  const results: { vendor: string; overallRisk: string; findingsCount: number }[] = [];
  for (const watch of watches) {
    try {
      const { report } = await performPrScan({
        userId: owner.id,
        anthropicApiKeyEncrypted: owner.anthropicApiKeyEncrypted,
        repoId: repo.id,
        repoFullName: repo.fullName,
        vendor: watch.vendor,
        prNumber: pullRequest.number,
        headSha: pullRequest.head.sha,
      });
      results.push({ vendor: watch.vendor, overallRisk: report.overallRisk, findingsCount: report.findings.length });
    } catch (e) {
      console.error(
        `[webhooks/github] PR scan failed for ${repository.full_name}#${pullRequest.number} (${watch.vendor}):`,
        e
      );
    }
  }

  if (results.length > 0) {
    try {
      await commentOnPullRequest(
        token,
        repository.full_name,
        pullRequest.number,
        buildComment(results, repo.id)
      );
    } catch (e) {
      console.error(
        `[webhooks/github] failed to comment on ${repository.full_name}#${pullRequest.number}:`,
        e
      );
    }
  }

  return NextResponse.json({ ok: true, results });
}

function buildComment(
  results: { vendor: string; overallRisk: string; findingsCount: number }[],
  repoId: string
): string {
  const dashboardUrl = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/dashboard/repositories/${repoId}`
    : null;
  const badge = (risk: string) => (risk === "high" ? "🔴 HIGH" : risk === "medium" ? "🟡 MEDIUM" : "🟢 LOW");
  const lines = results.map(
    (r) => `- **${VENDOR_LABELS[r.vendor as keyof typeof VENDOR_LABELS] ?? r.vendor}**: ${badge(r.overallRisk)} risk — ${r.findingsCount} finding(s)`
  );
  return [
    "**Breakwater vendor-risk scan** _(files changed in this PR)_",
    "",
    ...lines,
    "",
    dashboardUrl ? `[View details in Breakwater](${dashboardUrl})` : "This scan only reads your code — nothing here was changed automatically.",
  ]
    .filter(Boolean)
    .join("\n");
}
