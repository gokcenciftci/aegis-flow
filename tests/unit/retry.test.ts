import { describe, it, expect, vi } from "vitest";
import { RetryPolicy, calculateExponentialBackoffWithJitter } from "../../src/resilience/retry.js";

describe("RetryPolicy", () => {
  it("should calculate backoff with jitter within bounded range", () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const delay = calculateExponentialBackoffWithJitter(attempt, 100, 1000, 2);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(1000);
    }
  });

  it("should succeed on first try without retries", async () => {
    const policy = new RetryPolicy({ maxRetries: 3 });
    const fn = vi.fn().mockResolvedValue("done");

    const res = await policy.execute(fn);
    expect(res).toBe("done");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on transient failures and succeed", async () => {
    const policy = new RetryPolicy({ maxRetries: 3, initialDelayMs: 1, maxDelayMs: 5 });
    let attempts = 0;
    const fn = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error(`Attempt ${attempts} failed`);
      }
      return "finally succeeded";
    });

    const res = await policy.execute(fn);
    expect(res).toBe("finally succeeded");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should exhaust max retries and throw final error", async () => {
    const policy = new RetryPolicy({ maxRetries: 2, initialDelayMs: 1, maxDelayMs: 5 });
    const fn = vi.fn().mockRejectedValue(new Error("persistent failure"));

    await expect(policy.execute(fn)).rejects.toThrow("persistent failure");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
