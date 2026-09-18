import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  boolean,
  jsonb,
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

export const VENDORS = ["stripe", "twilio", "openai", "shopify", "slack"] as const;
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
  triggeredBy: text("triggered_by").notNull(), // 'manual' | 'cron'
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
