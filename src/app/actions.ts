"use server";

import { revalidatePath } from "next/cache";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { repos, vendorWatches, scans, findings, users, teamMembers, apiKeys, type Vendor } from "@/db/schema";
import { getCurrentUser, getGitHubToken } from "@/lib/current-user";
import { listUserRepos, fetchFileContent } from "@/lib/github";
import { performScan } from "@/lib/scan-runner";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { sendAlertEmail } from "@/lib/email";
import { fanOutAlert } from "@/lib/alerts";
import { generateFix } from "@/lib/fix";
import { openFixPullRequest } from "@/lib/github-write";
import { getRoleForOwner, roleAtLeast, type AccessRole } from "@/lib/access";
import { generateApiKey } from "@/lib/api-keys";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}

/** Loads a repo and checks the signed-in user has at least `minRole` on
 *  whoever owns it (their own account, or an account they were invited
 *  into) — the single access gate every repo-scoped action goes through. */
async function requireRepoAccess(repoId: string, minRole: AccessRole) {
  const user = await requireUser();
  const [repo] = await db.select().from(repos).where(eq(repos.id, repoId));
  if (!repo) throw new Error("Repository not found.");
  const role = await getRoleForOwner(user.id, repo.userId);
  if (!role || !roleAtLeast(role, minRole)) {
    throw new Error("Repository not found.");
  }
  return { user, repo, role };
}

/** Repos in the user's GitHub account that aren't connected yet, for the "Add repository" picker. */
export async function listConnectableRepos() {
  const user = await requireUser();
  const token = await getGitHubToken(user.id);
  if (!token) throw new Error("No GitHub token on file — try signing in again.");

  const [githubRepos, connected] = await Promise.all([
    listUserRepos(token),
    db.select({ githubRepoId: repos.githubRepoId }).from(repos).where(eq(repos.userId, user.id)),
  ]);
  const connectedIds = new Set(connected.map((r) => r.githubRepoId));
  return githubRepos
    .filter((r) => !connectedIds.has(String(r.id)))
    .map((r) => ({
      id: String(r.id),
      fullName: r.full_name,
      private: r.private,
      defaultBranch: r.default_branch,
    }));
}

export async function connectRepo(githubRepoId: string, fullName: string, defaultBranch: string, isPrivate: boolean, vendor: Vendor) {
  const user = await requireUser();
  const [repo] = await db
    .insert(repos)
    .values({ userId: user.id, githubRepoId, fullName, defaultBranch, private: isPrivate })
    .returning();
  await db.insert(vendorWatches).values({ repoId: repo.id, vendor });

  // Best-effort first scan right away, so the repo isn't just sitting there
  // with no data — a missing API key just means it'll show "not scanned
  // yet" until Settings is filled in, not a hard failure.
  if (user.anthropicApiKeyEncrypted) {
    try {
      await performScan({
        userId: user.id,
        anthropicApiKeyEncrypted: user.anthropicApiKeyEncrypted,
        repoId: repo.id,
        repoFullName: repo.fullName,
        vendor,
        triggeredBy: "manual",
      });
    } catch {
      // Swallow — the repo is connected either way; user can retry from the detail page.
    }
  }

  revalidatePath("/dashboard/repositories");
  revalidatePath("/dashboard");
  return repo;
}

/** Destructive, so it's gated at "admin" — the true owner or someone they've
 *  explicitly trusted with admin rights, not every editor on the team. */
export async function disconnectRepo(repoId: string) {
  const { repo } = await requireRepoAccess(repoId, "admin");
  await db.delete(repos).where(eq(repos.id, repo.id));
  revalidatePath("/dashboard/repositories");
}

/** Runs a scan right now (the "Scan now" button) and stores the result.
 *  Uses the repo OWNER's Anthropic key and GitHub token even when a team
 *  member triggers it — those credentials live on the account the repo
 *  belongs to, not on whoever happens to click the button. */
export async function triggerScan(repoId: string, vendor: Vendor) {
  const { repo } = await requireRepoAccess(repoId, "editor");
  const [owner] = await db.select().from(users).where(eq(users.id, repo.userId));
  if (!owner?.anthropicApiKeyEncrypted) {
    throw new Error("The repository owner needs to add an Anthropic API key in Settings before scanning.");
  }

  const { scanId } = await performScan({
    userId: owner.id,
    anthropicApiKeyEncrypted: owner.anthropicApiKeyEncrypted,
    repoId: repo.id,
    repoFullName: repo.fullName,
    vendor,
    triggeredBy: "manual",
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/repositories/${repoId}`);
  return scanId;
}

export async function updateAnthropicKey(apiKey: string) {
  const user = await requireUser();
  const trimmed = apiKey.trim();
  await db
    .update(users)
    .set({ anthropicApiKeyEncrypted: trimmed ? encryptSecret(trimmed) : null })
    .where(eq(users.id, user.id));
  revalidatePath("/dashboard/settings");
}

export async function updateAlertEmail(email: string) {
  const user = await requireUser();
  await db
    .update(users)
    .set({ alertEmail: email.trim() || null })
    .where(eq(users.id, user.id));
  revalidatePath("/dashboard/settings");
}

export async function updateWebhookSettings(webhookUrl: string, slackWebhookUrl: string) {
  const user = await requireUser();
  await db
    .update(users)
    .set({
      webhookUrl: webhookUrl.trim() || null,
      slackWebhookUrl: slackWebhookUrl.trim() || null,
    })
    .where(eq(users.id, user.id));
  revalidatePath("/dashboard/settings");
}

/** Manual "send yourself a test alert" button — fans out to every channel
 *  the user has configured (email, webhook, Slack), so Settings isn't a
 *  leap of faith for any of them. */
export async function sendTestAlert() {
  const user = await requireUser();
  const to = user.alertEmail || user.email;
  if (!to && !user.webhookUrl && !user.slackWebhookUrl) {
    throw new Error("Add an alert email, webhook URL, or Slack webhook URL first.");
  }

  const dashboardUrl = process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/dashboard` : "/dashboard";
  const results = await fanOutAlert(
    { to: to ?? null, webhookUrl: user.webhookUrl, slackWebhookUrl: user.slackWebhookUrl },
    {
      repoName: "your-org/example-repo",
      repoUrl: "",
      vendor: "stripe",
      overallRisk: "medium",
      summary: "This is a test alert from Breakwater — your setup works.",
      dashboardUrl,
      findingsCount: 1,
    },
    (toAddr, payload) =>
      sendAlertEmail({
        to: toAddr,
        repoName: payload.repoName,
        vendor: payload.vendor,
        overallRisk: payload.overallRisk,
        summary: payload.summary,
        findingsCount: payload.findingsCount,
        dashboardUrl: payload.dashboardUrl,
      })
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0 && failed.length === results.length) {
    throw new Error(failed.map((f) => `${f.channel}: ${f.error}`).join(" · "));
  }
  return results;
}

export async function getRepoHistory(repoId: string) {
  const { repo } = await requireRepoAccess(repoId, "viewer");
  const scanRows = await db
    .select()
    .from(scans)
    .where(eq(scans.repoId, repoId))
    .orderBy(desc(scans.createdAt))
    .limit(20);
  return { repo, scans: scanRows };
}

export async function getScanDetail(scanId: string) {
  const user = await requireUser();
  const [row] = await db
    .select({ scan: scans, repo: repos })
    .from(scans)
    .innerJoin(repos, eq(scans.repoId, repos.id))
    .where(eq(scans.id, scanId));
  if (!row) throw new Error("Scan not found.");
  const role = await getRoleForOwner(user.id, row.repo.userId);
  if (!role) throw new Error("Scan not found.");
  const findingRows = await db.select().from(findings).where(eq(findings.scanId, scanId));
  return { scan: row.scan, findings: findingRows };
}

/**
 * Opt-in, per-finding: asks Claude for a corrected version of the one file
 * this finding is about, then opens a real GitHub PR the user can review
 * and merge or close themselves. Only ever triggered by this action — never
 * from a scan or the cron job.
 */
export async function openFixPR(findingId: string) {
  const user = await requireUser();

  const [row] = await db
    .select({ finding: findings, scan: scans, repo: repos })
    .from(findings)
    .innerJoin(scans, eq(findings.scanId, scans.id))
    .innerJoin(repos, eq(scans.repoId, repos.id))
    .where(eq(findings.id, findingId));
  if (!row) throw new Error("Finding not found.");
  const { finding, scan, repo } = row;

  const role = await getRoleForOwner(user.id, repo.userId);
  if (!role || !roleAtLeast(role, "editor")) throw new Error("Finding not found.");

  const [owner] = await db.select().from(users).where(eq(users.id, repo.userId));
  if (!owner?.anthropicApiKeyEncrypted) {
    throw new Error("The repository owner needs to add an Anthropic API key in Settings before generating a fix.");
  }

  const filePath = finding.filePath;
  if (!filePath) {
    throw new Error("This finding isn't tied to a specific file, so there's nothing to open a PR against.");
  }

  await db
    .update(findings)
    .set({ prStatus: "generating", prError: null })
    .where(eq(findings.id, findingId));
  revalidatePath(`/dashboard/repositories/${repo.id}`);

  let prUrl: string;
  try {
    const token = await getGitHubToken(owner.id);
    if (!token) throw new Error("The repository owner's GitHub connection needs to be reconnected.");

    const currentContent = await fetchFileContent(token, repo.fullName, filePath);
    if (currentContent === null) {
      throw new Error(
        `Couldn't read ${filePath} from GitHub — it may have moved or been deleted since the scan.`
      );
    }

    const apiKey = decryptSecret(owner.anthropicApiKeyEncrypted);
    const fix = await generateFix(apiKey, scan.vendor, { ...finding, filePath }, currentContent);

    const shortId = finding.id.slice(0, 8);
    prUrl = await openFixPullRequest({
      token,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      filePath,
      newContent: fix.newFileContent,
      branchName: `breakwater/fix-${shortId}`,
      commitMessage: fix.commitMessage,
      prTitle: fix.prTitle,
      prBody: fix.prBody,
    });

    await db
      .update(findings)
      .set({ prStatus: "open", prUrl, prError: null })
      .where(eq(findings.id, findingId));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong opening the fix PR.";
    await db
      .update(findings)
      .set({ prStatus: "error", prError: message })
      .where(eq(findings.id, findingId));
    revalidatePath(`/dashboard/repositories/${repo.id}`);
    throw new Error(message);
  }

  revalidatePath(`/dashboard/repositories/${repo.id}`);
  return { prUrl };
}

/**
 * Team collaboration: an account owner invites teammates by email and
 * assigns them a role. Repos and settings stay owned by the inviter — see
 * src/lib/access.ts for how a member's role is resolved against them.
 */

const TEAM_ROLES = ["admin", "editor", "viewer"] as const;
type TeamRole = (typeof TEAM_ROLES)[number];

function assertTeamRole(role: string): asserts role is TeamRole {
  if (!TEAM_ROLES.includes(role as TeamRole)) throw new Error("Invalid role.");
}

/** Everyone the signed-in user has invited onto their own account. */
export async function listTeamMembers() {
  const user = await requireUser();
  return db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.ownerId, user.id))
    .orderBy(desc(teamMembers.invitedAt));
}

/** Invites a teammate by email with a role. Links immediately if they
 *  already have a Breakwater account with that email; otherwise links the
 *  next time they sign in (see getCurrentUser). */
export async function inviteTeamMember(email: string, role: string) {
  const user = await requireUser();
  assertTeamRole(role);
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) throw new Error("Enter a valid email address.");
  if (trimmed === user.email?.toLowerCase()) throw new Error("That's your own account.");

  const [existingInvite] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.ownerId, user.id), eq(teamMembers.memberEmail, trimmed)));
  if (existingInvite) throw new Error("That person is already on your team.");

  const [matchingUser] = await db.select().from(users).where(eq(users.email, trimmed));

  await db.insert(teamMembers).values({
    ownerId: user.id,
    memberEmail: trimmed,
    memberUserId: matchingUser?.id ?? null,
    role,
    acceptedAt: matchingUser ? new Date() : null,
  });

  revalidatePath("/dashboard/settings/team");
}

export async function updateTeamMemberRole(memberId: string, role: string) {
  const user = await requireUser();
  assertTeamRole(role);
  await db
    .update(teamMembers)
    .set({ role })
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.ownerId, user.id)));
  revalidatePath("/dashboard/settings/team");
}

export async function removeTeamMember(memberId: string) {
  const user = await requireUser();
  await db.delete(teamMembers).where(and(eq(teamMembers.id, memberId), eq(teamMembers.ownerId, user.id)));
  revalidatePath("/dashboard/settings/team");
}

/** Teams the signed-in user belongs to as an invited member (not their own account). */
export async function listMyTeamMemberships() {
  const user = await requireUser();
  if (!user.email) return [];
  const rows = await db
    .select({ ownerEmail: users.email, role: teamMembers.role, acceptedAt: teamMembers.acceptedAt })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.ownerId, users.id))
    .where(eq(teamMembers.memberUserId, user.id));
  return rows;
}

/**
 * Programmatic API keys for /api/v1/* — read-only access to a user's own
 * scan data from scripts, CI, or another tool, without sharing their
 * Breakwater login.
 */

export async function listApiKeys() {
  const user = await requireUser();
  return db
    .select({
      id: apiKeys.id,
      label: apiKeys.label,
      keyPrefix: apiKeys.keyPrefix,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .orderBy(desc(apiKeys.createdAt));
}

/** Returns the raw key exactly once — only the hash is ever stored. */
export async function createApiKey(label: string) {
  const user = await requireUser();
  const { raw, hash, prefix } = generateApiKey();
  await db.insert(apiKeys).values({
    userId: user.id,
    label: label.trim() || "Default key",
    keyHash: hash,
    keyPrefix: prefix,
  });
  revalidatePath("/dashboard/settings");
  return raw;
}

export async function revokeApiKey(keyId: string) {
  const user = await requireUser();
  await db.delete(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)));
  revalidatePath("/dashboard/settings");
}
