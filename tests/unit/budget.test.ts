import { describe, it, expect } from "vitest";
import { BudgetExceededError, TimeoutError } from "../../src/core/errors.js";
import { BudgetGuard } from "../../src/resilience/budget.js";

describe("BudgetGuard", () => {
  it("should record token usage and cost correctly", () => {
    const guard = new BudgetGuard({
      maxTokens: 1000,
      maxCostUsd: 0.1,
      maxSteps: 10,
      executionTimeoutMs: 5000,
    });

    guard.recordUsage(
      { promptTokens: 100, completionTokens: 50 },
      { promptCostPer1k: 0.005, completionCostPer1k: 0.015 }
    );

    const usage = guard.tokenUsage;
    expect(usage.promptTokens).toBe(100);
    expect(usage.completionTokens).toBe(50);
    expect(usage.totalTokens).toBe(150);
    expect(usage.estimatedCostUsd).toBe(0.00125);
  });

  it("should throw BudgetExceededError when tokens exceed limit", () => {
    const guard = new BudgetGuard({
      maxTokens: 200,
      maxCostUsd: 1.0,
      maxSteps: 10,
      executionTimeoutMs: 5000,
    });

    guard.recordUsage({ promptTokens: 150, completionTokens: 100 });
    expect(() => guard.checkBudget()).toThrow(BudgetExceededError);
  });

  it("should throw BudgetExceededError when max steps exceeded", () => {
    const guard = new BudgetGuard({
      maxTokens: 5000,
      maxCostUsd: 1.0,
      maxSteps: 2,
      executionTimeoutMs: 5000,
    });

    guard.recordStep();
    guard.recordStep();
    guard.recordStep();

    expect(() => guard.checkBudget()).toThrow(BudgetExceededError);
  });

  it("should throw TimeoutError when execution time elapsed", () => {
    const pastTime = Date.now() - 6000;
    const guard = new BudgetGuard(
      {
        maxTokens: 5000,
        maxCostUsd: 1.0,
        maxSteps: 10,
        executionTimeoutMs: 5000,
      },
      pastTime
    );

    expect(() => guard.checkBudget()).toThrow(TimeoutError);
  });
});
