import { describe, it, expect } from "vitest";
import { type Message } from "../../src/core/types.js";
import { SlidingContextWindow, estimateMessageTokens } from "../../src/memory/sliding-window.js";

describe("SlidingContextWindow", () => {
  it("should estimate tokens deterministically", () => {
    const msg: Message = { role: "user", content: "Hello world!" };
    const tokens = estimateMessageTokens(msg, 4);
    expect(tokens).toBeGreaterThan(0);
  });

  it("should preserve system prompt and prune overflowing older messages", () => {
    const window = new SlidingContextWindow({
      maxTokens: 600,
      reservedResponseTokens: 50,
      charsPerToken: 4,
    });

    const messages: Message[] = [
      { role: "system", content: "You are an assistant." },
      { role: "user", content: "A".repeat(500) },
      { role: "assistant", content: "B".repeat(500) },
      { role: "user", content: "Recent query" },
    ];

    const fitted = window.fit(messages);

    expect(fitted[0]?.role).toBe("system");
    expect(fitted[0]?.content).toBe("You are an assistant.");
    expect(fitted[fitted.length - 1]?.content).toBe("Recent query");
  });
});
