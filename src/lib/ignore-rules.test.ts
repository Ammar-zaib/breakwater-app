import { describe, it, expect } from "vitest";
import { matchIgnoreRule } from "./ignore-rules";
import type { ignoreRules } from "@/db/schema";

type IgnoreRule = typeof ignoreRules.$inferSelect;

function rule(overrides: Partial<IgnoreRule>): IgnoreRule {
  return {
    id: "rule-1",
    repoId: "repo-1",
    vendor: null,
    titleContains: null,
    filePathContains: null,
    reason: null,
    createdBy: "user-1",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("matchIgnoreRule", () => {
  it("matches on a title substring, case-insensitively", () => {
    const rules = [rule({ titleContains: "Deprecated Endpoint" })];
    const hit = matchIgnoreRule(rules, "stripe", "Uses deprecated endpoint /v1/charges", null);
    expect(hit).not.toBeNull();
  });

  it("does not match when the title substring is absent", () => {
    const rules = [rule({ titleContains: "some other thing" })];
    const hit = matchIgnoreRule(rules, "stripe", "Uses deprecated endpoint /v1/charges", null);
    expect(hit).toBeNull();
  });

  it("requires the vendor to match when a rule sets one", () => {
    const rules = [rule({ vendor: "twilio", titleContains: "deprecated" })];
    const hit = matchIgnoreRule(rules, "stripe", "deprecated endpoint used", null);
    expect(hit).toBeNull();
  });

  it("matches across vendors when a rule leaves vendor unset", () => {
    const rules = [rule({ vendor: null, titleContains: "deprecated" })];
    expect(matchIgnoreRule(rules, "stripe", "deprecated endpoint used", null)).not.toBeNull();
    expect(matchIgnoreRule(rules, "twilio", "deprecated endpoint used", null)).not.toBeNull();
  });

  it("requires both titleContains and filePathContains when both are set on a rule", () => {
    const rules = [rule({ titleContains: "deprecated", filePathContains: "src/payments.ts" })];
    expect(matchIgnoreRule(rules, "stripe", "deprecated endpoint used", "src/payments.ts")).not.toBeNull();
    expect(matchIgnoreRule(rules, "stripe", "deprecated endpoint used", "src/other.ts")).toBeNull();
  });

  it("a rule with neither condition set matches nothing, defensively", () => {
    const rules = [rule({ titleContains: null, filePathContains: null })];
    expect(matchIgnoreRule(rules, "stripe", "anything at all", "any/path.ts")).toBeNull();
  });

  it("returns the first matching rule when multiple rules are present", () => {
    const rules = [
      rule({ id: "rule-a", titleContains: "no match here" }),
      rule({ id: "rule-b", titleContains: "deprecated" }),
    ];
    const hit = matchIgnoreRule(rules, "stripe", "deprecated endpoint used", null);
    expect(hit?.id).toBe("rule-b");
  });

  it("treats a null filePath as an empty string for filePathContains matching", () => {
    const rules = [rule({ filePathContains: "payments" })];
    expect(matchIgnoreRule(rules, "stripe", "some finding", null)).toBeNull();
  });
});
