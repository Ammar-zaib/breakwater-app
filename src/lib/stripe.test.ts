import { describe, it, expect } from "vitest";
import { describeSubscriptionStatus } from "./stripe";

describe("describeSubscriptionStatus", () => {
  it("labels known Stripe subscription statuses", () => {
    expect(describeSubscriptionStatus("active")).toBe("Active");
    expect(describeSubscriptionStatus("trialing")).toBe("Trialing");
    expect(describeSubscriptionStatus("canceled")).toBe("Canceled");
  });

  it("flags past_due distinctly so it doesn't read as healthy", () => {
    expect(describeSubscriptionStatus("past_due")).toContain("Past due");
  });

  it("falls back to 'Not subscribed' for 'none' and anything unrecognized", () => {
    expect(describeSubscriptionStatus("none")).toBe("Not subscribed");
    expect(describeSubscriptionStatus("some-future-status")).toBe("Not subscribed");
  });
});
