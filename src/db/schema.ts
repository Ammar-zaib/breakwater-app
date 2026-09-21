import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  boolean,
  jsonb,
  doublePrecision,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/**
 * Auth.js (NextAuth) tables — the exact shape @auth/drizzle-adapter expects.
 * Do not rename these without also updating src/auth.ts.
 */
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),

  // Breakwater-specific settings, kept on the user row for simplicity.
  anthropicApiKeyEncrypted: text("anthropic_api_key_encrypted"),
  alertEmail: text("alert_email"), // defaults to `email` if null
  webhookUrl: text("webhook_url"), // optional extra alert destination — POSTed JSON
  slackWebhookUrl: text("slack_webhook_url"), // optional Slack incoming-webhook URL
  // Microsoft Teams incoming webhook (classic "MessageCard" JSON format).
  // Note: Microsoft has been migrating Teams webhooks toward a
  // Workflows/Adaptive-Card model and has at various points announced
  // retirement timelines for the old connector-based webhooks — if a URL
  // here starts failing, that's the most likely cause; see sendTeamsAlert
  // in src/lib/alerts.ts.
  teamsWebhookUrl: text("teams_webhook_url"),
  // PagerDuty Events API v2 integration key (from a PagerDuty "Events API
  // v2" service integration). Only fires for high-risk scans, deliberately
  // — PagerDuty is for pages, not every medium/low finding.
  pagerDutyIntegrationKey: text("pagerduty_integration_key"),
  // Weekly risk-posture summary email (see /api/cron/digest), independent
  // of the per-scan alert channels above — on by default since it's a
  // low-noise once-a-week email, opt-out rather than opt-in.
  weeklyDigestEnabled: boolean("weekly_digest_enabled").notNull().default(true),
  // Stripe billing (see src/lib/stripe.ts, /api/webhooks/stripe). Tracked
  // for every account, but DELIBERATELY not enforced anywhere yet — no
  // action in this app checks subscriptionStatus before allowing access.
  // Enforcing it (e.g. blocking scans for a lapsed subscription) is a
  // product decision — trial length, grace period, what happens to
  // existing data — that should be made explicitly, not implied by this
  // column existing. See SECURITY_REVIEW.md / DEPLOY_COOLIFY.md.
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").notNull().default("none"), // 'none' | Stripe subscription.status values ('trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid' | 'paused')
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"), // GitHub token — grants repo read access
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

/**
 * Breakwater domain tables.
 */

export const VENDORS = [
  "stripe",
  "twilio",
  "openai",
  "shopify",
  "slack",
  "aws",
  "paypal",
  "auth0",
  "sendgrid",
] as const;
export type Vendor = (typeof VENDORS)[number];

export const repos = pgTable("repo", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  githubRepoId: text("github_repo_id").notNull(),
  fullName: text("full_name").notNull(), // "owner/repo"
  defaultBranch: text("default_branch").notNull().default("main"),
  private: boolean("private").notNull().default(false),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  // PR-triggered scanning: when enabled, a GitHub webhook is registered on
  // the repo (id stored here so we can unregister it later) and incoming
  // pull_request events run a PR-scoped scan that comments findings inline.
  prScanEnabled: boolean("pr_scan_enabled").notNull().default(false),
  githubWebhookId: text("github_webhook_id"),
  // Optional second branch to watch beyond the default branch (e.g. a
  // long-lived release/staging branch). Scanned the same way as a PR — a
  // direct tree walk + content match, not GitHub code search, since search
  // only indexes the default branch.
  extraBranch: text("extra_branch"),
});

export const vendorWatches = pgTable("vendor_watch", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  repoId: text("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  vendor: text("vendor").$type<Vendor>().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scans = pgTable("scan", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  repoId: text("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  vendor: text("vendor").$type<Vendor>().notNull(),
  overallRisk: text("overall_risk").notNull(), // 'high' | 'medium' | 'low'
  summary: text("summary").notNull(),
  filesScanned: jsonb("files_scanned").$type<string[]>().notNull(),
  triggeredBy: text("triggered_by").notNull(), // 'manual' | 'cron' | 'pr'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Anthropic usage for this scan's model call — lets an account see roughly
  // what its own scanning is costing on its own API key. estimatedCostUsd is
  // a directional estimate from a hardcoded rate table (src/lib/cost.ts),
  // not a billing-accurate figure — Anthropic's actual pricing is the source
  // of truth.
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  estimatedCostUsd: doublePrecision("estimated_cost_usd"),
});

export const findings = pgTable("finding", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  scanId: text("scan_id")
    .notNull()
    .references(() => scans.id, { onDelete: "cascade" }),
  severity: text("severity").notNull(), // 'high' | 'medium' | 'low'
  title: text("title").notNull(),
  explanation: text("explanation").notNull(),
  evidence: text("evidence").notNull(),
  filePath: text("file_path"),
  recommendation: text("recommendation").notNull(),
  // Opt-in fix PR — never opened automatically, only when a user clicks
  // "Open fix PR" on this specific finding.
  prStatus: text("pr_status").notNull().default("none"), // 'none' | 'generating' | 'open' | 'error'
  prUrl: text("pr_url"),
  prError: text("pr_error"),
  // Accept/dismiss: a reviewed finding an editor+ has decided not to act on
  // (accepted risk, false positive, etc). Accepted findings stay in history
  // but are excluded from "effective risk" counts on dashboards.
  status: text("status").notNull().default("open"), // 'open' | 'accepted' | 'suppressed'
  acceptedBy: text("accepted_by").references(() => users.id, { onDelete: "set null" }),
  acceptedAt: timestamp("accepted_at"),
  acceptedReason: text("accepted_reason"),
  // Triage: routing a finding to a specific teammate to work on. Purely
  // informational — doesn't grant them any extra access beyond their
  // existing role on the account.
  assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
  assignedAt: timestamp("assigned_at"),
  // Set when a standing suppression rule (see ignoreRules below) auto-hid
  // this finding at scan time, so the UI can explain why without the user
  // having dismissed it themselves.
  suppressedByRuleId: text("suppressed_by_rule_id"),
});

/**
 * A standing rule an editor+ creates so future scans stop re-surfacing a
 * known/accepted pattern automatically, instead of accepting the same kind
 * of finding scan after scan. Matched at scan-persist time (see
 * applySuppressionRules in scan-runner.ts) against a finding's vendor,
 * title, and file path.
 */
export const ignoreRules = pgTable("ignore_rule", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  repoId: text("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  vendor: text("vendor").$type<Vendor>(),
  // Case-insensitive substring match against a finding's title. Null means
  // "any title" (only vendor/filePathPattern narrow the match).
  titleContains: text("title_contains"),
  // Case-insensitive substring match against a finding's file path.
  filePathContains: text("file_path_contains"),
  reason: text("reason"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Lightweight collaboration: an account owner invites teammates by email.
 * Repos/scans stay owned by `ownerId` — a member's role determines what
 * they're allowed to do on the owner's behalf, without a full multi-tenant
 * rewrite of every existing query.
 */
export const teamMembers = pgTable("team_member", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  memberEmail: text("member_email").notNull(),
  memberUserId: text("member_user_id").references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("viewer"), // 'admin' | 'editor' | 'viewer'
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
});

export const apiKeys = pgTable("api_key", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Default key"),
  keyHash: text("key_hash").notNull(), // sha256, never store the raw key
  keyPrefix: text("key_prefix").notNull(), // first 8 chars, shown in the UI for identification
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

export const alertLogs = pgTable("alert_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  repoId: text("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  scanId: text("scan_id")
    .notNull()
    .references(() => scans.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("email"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

/**
 * Audit trail for anything a user does that changes account state or repo
 * access — connecting/disconnecting repos, triggering scans, opening fix
 * PRs, changing team roles, creating/revoking API keys, accepting findings,
 * toggling PR scans, updating settings. `ownerId` is whose account the
 * action happened under (so a team member's actions show up in the owner's
 * log too); `actorUserId` is who actually did it. Logs are kept even if the
 * actor is later removed from the team or deleted, so `actorUserId` doesn't
 * cascade-delete — only `ownerId` does, since the whole log belongs to that
 * account.
 */
export const auditLogs = pgTable("audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorEmail: text("actor_email"), // snapshot, in case the user/email later changes
  action: text("action").notNull(), // e.g. 'repo.connect', 'finding.accept', 'team.role_change'
  targetType: text("target_type"), // e.g. 'repo', 'finding', 'team_member', 'api_key'
  targetId: text("target_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
