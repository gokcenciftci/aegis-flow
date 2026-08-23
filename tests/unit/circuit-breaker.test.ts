import { describe, it, expect, vi } from "vitest";
import { CircuitBreakerOpenError } from "../../src/core/errors.js";
import { CircuitBreaker } from "../../src/resilience/circuit-breaker.js";

describe("CircuitBreaker", () => {
  it("should start in CLOSED state and execute actions successfully", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 1000 });
    expect(cb.state).toBe("CLOSED");

    const result = await cb.execute(async () => 123);
    expect(result).toBe(123);
    expect(cb.consecutiveFailures).toBe(0);
  });

  it("should transition to OPEN state when failure threshold is reached", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, recoveryTimeoutMs: 500, serviceName: "test-api" });

    await expect(cb.execute(async () => { throw new Error("Fail 1"); })).rejects.toThrow("Fail 1");
    expect(cb.state).toBe("CLOSED");
    expect(cb.consecutiveFailures).toBe(1);

    await expect(cb.execute(async () => { throw new Error("Fail 2"); })).rejects.toThrow("Fail 2");
    expect(cb.state).toBe("OPEN");
    expect(cb.consecutiveFailures).toBe(2);

    await expect(cb.execute(async () => 999)).rejects.toThrow(CircuitBreakerOpenError);
  });

  it("should transition to HALF_OPEN after recoveryTimeoutMs and reset on success", async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker({ failureThreshold: 1, recoveryTimeoutMs: 1000 });

    await expect(cb.execute(async () => { throw new Error("Crash"); })).rejects.toThrow();
    expect(cb.state).toBe("OPEN");

    vi.advanceTimersByTime(1100);
    expect(cb.state).toBe("HALF_OPEN");

    const successResult = await cb.execute(async () => "recovered");
    expect(successResult).toBe("recovered");
    expect(cb.state).toBe("CLOSED");

    vi.useRealTimers();
  });
});
