import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit, clientIpFromHeaders } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, { limit: 5, windowMs: 1000 }).ok).toBe(true);
    }
  });

  it("blocks once the limit is exceeded within the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, { limit: 3, windowMs: 1000 });
    const result = rateLimit(key, { limit: 3, windowMs: 1000 });
    expect(result.ok).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, { limit: 3, windowMs: 1000 });
    expect(rateLimit(key, { limit: 3, windowMs: 1000 }).ok).toBe(false);

    vi.setSystemTime(1001);
    expect(rateLimit(key, { limit: 3, windowMs: 1000 }).ok).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    rateLimit(keyA, { limit: 1, windowMs: 1000 });
    expect(rateLimit(keyA, { limit: 1, windowMs: 1000 }).ok).toBe(false);
    expect(rateLimit(keyB, { limit: 1, windowMs: 1000 }).ok).toBe(true);
  });
});

describe("clientIpFromHeaders", () => {
  it("takes the first entry from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIpFromHeaders(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(clientIpFromHeaders(headers)).toBe("9.9.9.9");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
