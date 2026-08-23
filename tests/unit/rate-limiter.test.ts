import { describe, it, expect, vi } from "vitest";
import { RateLimitExceededError } from "../../src/core/errors.js";
import { TokenBucketRateLimiter } from "../../src/resilience/rate-limiter.js";

describe("TokenBucketRateLimiter", () => {
  it("should initialize with full capacity", () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 5, refillRatePerMinute: 60 });
    expect(limiter.availableTokens).toBe(5);
  });

  it("should consume tokens and reject when exhausted", async () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 2, refillRatePerMinute: 60, serviceName: "llm" });

    expect(limiter.tryAcquire(1)).toBe(true);
    expect(limiter.tryAcquire(1)).toBe(true);
    expect(limiter.tryAcquire(1)).toBe(false);

    await expect(limiter.acquire(1)).rejects.toThrow(RateLimitExceededError);
  });

  it("should refill tokens over time", () => {
    vi.useFakeTimers();

    const limiter = new TokenBucketRateLimiter({ capacity: 10, refillRatePerMinute: 60 });

    expect(limiter.tryAcquire(10)).toBe(true);
    expect(limiter.availableTokens).toBe(0);

    vi.advanceTimersByTime(2000);
    expect(limiter.availableTokens).toBe(2);

    vi.useRealTimers();
  });
});
