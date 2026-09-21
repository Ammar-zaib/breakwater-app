import { describe, it, expect } from "vitest";
import { estimateCostUsd } from "./cost";

describe("estimateCostUsd", () => {
  it("prices a sonnet call at $3/$15 per million tokens", () => {
    const cost = estimateCostUsd("claude-sonnet-5", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(3 + 15, 6);
  });

  it("prices an opus call higher than the same-size sonnet call", () => {
    const sonnet = estimateCostUsd("claude-sonnet-5", 500_000, 200_000);
    const opus = estimateCostUsd("claude-opus-4", 500_000, 200_000);
    expect(opus).toBeGreaterThan(sonnet);
  });

  it("prices a haiku call lower than the same-size sonnet call", () => {
    const sonnet = estimateCostUsd("claude-sonnet-5", 500_000, 200_000);
    const haiku = estimateCostUsd("claude-haiku-4", 500_000, 200_000);
    expect(haiku).toBeLessThan(sonnet);
  });

  it("falls back to sonnet rates for an unrecognized model name", () => {
    const sonnet = estimateCostUsd("claude-sonnet-5", 100_000, 50_000);
    const unknown = estimateCostUsd("some-future-model-nobody-has-heard-of", 100_000, 50_000);
    expect(unknown).toBeCloseTo(sonnet, 10);
  });

  it("matches on model name case-insensitively", () => {
    const lower = estimateCostUsd("claude-opus-4", 10_000, 10_000);
    const upper = estimateCostUsd("CLAUDE-OPUS-4", 10_000, 10_000);
    expect(upper).toBeCloseTo(lower, 10);
  });

  it("returns 0 for a zero-token scan", () => {
    expect(estimateCostUsd("claude-sonnet-5", 0, 0)).toBe(0);
  });
});
