import { describe, it, expect } from "vitest";
import { timingSafeEqualString } from "./security";

describe("timingSafeEqualString", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqualString("Bearer abc123", "Bearer abc123")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(timingSafeEqualString("Bearer abc123", "Bearer xyz789")).toBe(false);
  });

  it("returns false for different-length strings without throwing", () => {
    expect(timingSafeEqualString("short", "a lot longer than that")).toBe(false);
  });

  it("returns false against an empty string", () => {
    expect(timingSafeEqualString("something", "")).toBe(false);
  });
});
