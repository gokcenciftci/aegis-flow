import { describe, it, expect } from "vitest";
import { MockLLMAdapter } from "../../src/adapters/llm/mock.js";
import { Agent } from "../../src/core/agent.js";
import { isErr, isOk } from "../../src/core/result.js";
import { AegisFlowEngine } from "../../src/engine.js";

describe("Resilience & Chaos Harness", () => {
  it("should survive intermittent 429 rate limit errors via retry policy", async () => {
    const mockLLM = new MockLLMAdapter()

      .enqueueRule({
        response: { content: null, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } },
        failWith: { type: "RATE_LIMIT", message: "Rate limit exceeded (429)", statusCode: 429 },
      })

      .enqueueRule({
        response: {
          content: "Recovered successfully from transient 429 spike!",
          usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        },
      });

    const agent = Agent.create({
      name: "ResilientAgent",
      systemPrompt: "You are a resilient assistant.",
      resilience: {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
      },
    });

    const engine = new AegisFlowEngine({ agent, provider: mockLLM });
    const result = await engine.run("Perform resilient operation");

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.output).toContain("Recovered successfully");
    }
  });

  it("should trip circuit breaker upon reaching consecutive failure threshold", async () => {
    const mockLLM = new MockLLMAdapter()
      .enqueueRule({
        response: { content: null, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } },
        failWith: { type: "SERVER_ERROR", message: "Backend 500 Outage" },
      })
      .enqueueRule({
        response: { content: null, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } },
        failWith: { type: "SERVER_ERROR", message: "Backend 500 Outage" },
      });

    const agent = Agent.create({
      name: "TripAgent",
      systemPrompt: "You are a test assistant.",
      resilience: {
        maxRetries: 0,
        failureThreshold: 2,
        recoveryTimeoutMs: 5000,
      },
    });

    const engine = new AegisFlowEngine({ agent, provider: mockLLM });

    const res1 = await engine.run("Call 1");
    expect(isErr(res1)).toBe(true);

    const res2 = await engine.run("Call 2");
    expect(isErr(res2)).toBe(true);

    const res3 = await engine.run("Call 3");
    expect(isErr(res3)).toBe(true);
    if (isErr(res3)) {
      expect(res3.error.code).toBe("CIRCUIT_BREAKER_OPEN");
    }
  });

  it("should halt deterministically when token budget is exceeded", async () => {
    const mockLLM = new MockLLMAdapter().enqueueRule({
      response: {
        content: "Huge payload response",
        usage: { promptTokens: 4000, completionTokens: 2000, totalTokens: 6000 },
      },
    });

    const agent = Agent.create({
      name: "BudgetAgent",
      systemPrompt: "You are an assistant.",
      budget: {
        maxTokens: 500,
      },
    });

    const engine = new AegisFlowEngine({ agent, provider: mockLLM });
    const result = await engine.run("Test budget overflow");

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("BUDGET_EXCEEDED");
    }
  });
});
