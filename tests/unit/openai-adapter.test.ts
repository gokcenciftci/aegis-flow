import { describe, it, expect, vi, afterEach } from "vitest";
import { OpenAIAdapter } from "../../src/adapters/llm/openai.js";
import { ProviderError } from "../../src/core/errors.js";

describe("OpenAIAdapter", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should format request, invoke fetch and parse completion with tool calls", async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: "Calling tool",
            tool_calls: [
              {
                id: "call_123",
                function: {
                  name: "search",
                  arguments: JSON.stringify({ query: "vitest" }),
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 15,
        total_tokens: 35,
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const adapter = new OpenAIAdapter({ apiKey: "test-key" });
    const result = await adapter.generateCompletion(
      [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Search vitest" },
      ],
      [{ name: "search", description: "Search query", parametersSchema: {} }]
    );

    expect(result.content).toBe("Calling tool");
    expect(result.toolCalls?.length).toBe(1);
    expect(result.toolCalls?.[0]?.name).toBe("search");
    expect(result.toolCalls?.[0]?.arguments).toEqual({ query: "vitest" });
    expect(result.usage.totalTokens).toBe(35);
  });

  it("should throw ProviderError on non-200 HTTP response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limit reached",
    } as Response);

    const adapter = new OpenAIAdapter({ apiKey: "test-key" });
    await expect(
      adapter.generateCompletion([{ role: "user", content: "Hello" }])
    ).rejects.toThrow(ProviderError);
  });
});
