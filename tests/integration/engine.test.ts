import { describe, it, expect } from "vitest";
import { z } from "zod";
import { MockLLMAdapter } from "../../src/adapters/llm/mock.js";
import { Agent } from "../../src/core/agent.js";
import { isOk } from "../../src/core/result.js";
import { AegisFlowEngine } from "../../src/engine.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { createTool } from "../../src/tools/tool.js";

describe("AegisFlowEngine Integration", () => {
  it("should run multi-step tool calling loop to completion", async () => {
    const registry = new ToolRegistry();
    const weatherTool = createTool({
      name: "get_weather",
      description: "Gets temperature for city",
      schema: z.object({ city: z.string() }),
      execute: (args) => ({ city: args.city, tempC: 22 }),
    });
    registry.register(weatherTool);

    const mockLLM = new MockLLMAdapter()
      .enqueueRule({
        response: {
          content: "Let me check the weather.",
          toolCalls: [
            {
              id: "call_w1",
              name: "get_weather",
              arguments: { city: "Istanbul" },
            },
          ],
          usage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 },
        },
      })
      .enqueueRule({
        response: {
          content: "The weather in Istanbul is 22°C.",
          usage: { promptTokens: 60, completionTokens: 15, totalTokens: 75 },
        },
      });

    const agent = Agent.create({
      name: "WeatherAgent",
      systemPrompt: "You are a weather assistant.",
    });

    const engine = new AegisFlowEngine({
      agent,
      provider: mockLLM,
      toolRegistry: registry,
    });

    const result = await engine.run("What's the weather in Istanbul?");

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.output).toBe("The weather in Istanbul is 22°C.");
      expect(result.value.steps).toBe(2);
      expect(result.value.tokenUsage.totalTokens).toBe(125);
      expect(result.value.history.length).toBeGreaterThan(3);
    }
  });
});
