import type { ignoreRules, Vendor } from "@/db/schema";

export type IgnoreRule = typeof ignoreRules.$inferSelect;

/**
 * Standing-suppression-rule matching — pulled out of scan-runner.ts into its
 * own module specifically because it's the one piece of scan-runner.ts that
 * doesn't need a database or the NextAuth import chain, so it can be unit
 * tested directly (see ignore-rules.test.ts) without either.
 *
 * A rule matches when every condition it sets is satisfied — a rule with no
 * conditions set (shouldn't normally happen) matches nothing, not everything.
 */
export function matchIgnoreRule(
  rules: IgnoreRule[],
  vendor: Vendor,
  title: string,
  filePath: string | null
): IgnoreRule | null {
  for (const rule of rules) {
    if (rule.vendor && rule.vendor !== vendor) continue;
    if (!rule.titleContains && !rule.filePathContains) continue;
    if (rule.titleContains && !title.toLowerCase().includes(rule.titleContains.toLowerCase())) continue;
    if (rule.filePathContains && !(filePath ?? "").toLowerCase().includes(rule.filePathContains.toLowerCase())) continue;
    return rule;
  }
  return null;
}
