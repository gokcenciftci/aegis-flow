import { describe, it, expect } from "vitest";
import {
  ToolExecutionError,
  TimeoutError,
  SchemaValidationError,
  BudgetExceededError,
} from "../../src/core/errors.js";
import { type Message } from "../../src/core/types.js";
import { SlidingContextWindow } from "../../src/memory/sliding-window.js";
import { BudgetGuard } from "../../src/resilience/budget.js";
import { RetryPolicy, sleep } from "../../src/resilience/retry.js";
import { AgentEventEmitter } from "../../src/telemetry/emitter.js";

describe("Coverage Perfection & Edge Branches", () => {
  it("should cover all error classes and properties", () => {
    const te = new ToolExecutionError("tool1", "failed", { traceId: "tr1" });
    expect(te.toolName).toBe("tool1");
    expect(te.code).toBe("TOOL_EXECUTION_FAILED");

    const to = new TimeoutError("op1", 1000);
    expect(to.timeoutMs).toBe(1000);

    const se = new SchemaValidationError("target", ["err1", "err2"]);
    expect(se.issues.length).toBe(2);
  });

  it("should trigger cost budget limit", () => {
    const guard = new BudgetGuard({
      maxTokens: 50000,
      maxCostUsd: 0.05,
      maxSteps: 10,
      executionTimeoutMs: 10000,
    });

    guard.recordUsage(
      { promptTokens: 10000, completionTokens: 10000 },
      { promptCostPer1k: 0.01, completionCostPer1k: 0.03 }
    );

    expect(() => guard.checkBudget()).toThrow(BudgetExceededError);
  });

  it("should trigger sliding window truncation message insertion", () => {
    const window = new SlidingContextWindow({
      maxTokens: 600,
      reservedResponseTokens: 50,
      charsPerToken: 4,
    });

    const messages: Message[] = [
      { role: "system", content: "System" },
      { role: "user", content: "Message 1 ".repeat(200) },
      { role: "assistant", content: "Message 2 ".repeat(200) },
      { role: "user", content: "Message 3 ".repeat(200) },
      { role: "assistant", content: "Short final" },
    ];

    const fitted = window.fit(messages);
    expect(fitted.length).toBeGreaterThan(1);
    expect(fitted.some((m) => m.content?.includes("pruned to fit"))).toBe(true);

    expect(window.fit([{ role: "user", content: "single" }]).length).toBe(1);
  });

  it("should test retry policy predicates and abort signals", async () => {
    const policy = new RetryPolicy({
      maxRetries: 3,
      shouldRetry: (_err, attempt) => attempt <= 1,
    });

    let count = 0;
    await expect(
      policy.execute(async () => {
        count++;
        throw new Error("fatal");
      })
    ).rejects.toThrow("fatal");
    expect(count).toBe(2);

    const controller = new AbortController();
    controller.abort();
    await expect(sleep(1000, controller.signal)).rejects.toThrow("Operation aborted");
  });

  it("should handle event emitter removeAllListeners and errors", () => {
    const emitter = new AgentEventEmitter();
    emitter.on("thought", () => {
      throw new Error("Error inside listener");
    });

    expect(() => emitter.emit("thought", { content: "t", timestamp: Date.now() })).not.toThrow();

    emitter.removeAllListeners();
    expect(() => emitter.emit("thought", { content: "t", timestamp: Date.now() })).not.toThrow();
  });
});
