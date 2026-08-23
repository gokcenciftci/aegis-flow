import { describe, it, expect } from "vitest";
import { z } from "zod";
import { MessageHistory } from "../../src/memory/message-history.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { createTool } from "../../src/tools/tool.js";

describe("MessageHistory & ToolRegistry edge cases", () => {
  it("should handle MessageHistory operations", () => {
    const history = new MessageHistory([{ role: "system", content: "sys" }]);
    expect(history.length).toBe(1);

    history.append({ role: "user", content: "u1" });
    history.appendBatch([{ role: "assistant", content: "a1" }]);

    expect(history.length).toBe(3);
    expect(history.last()?.role).toBe("assistant");

    const cloned = history.clone();
    expect(cloned.length).toBe(3);

    history.clear();
    expect(history.length).toBe(0);
  });

  it("should handle ToolRegistry edge cases", () => {
    const registry = new ToolRegistry();
    const t1 = createTool({
      name: "t1",
      description: "tool 1",
      schema: z.object({}),
      execute: () => "t1",
    });
    const t2 = createTool({
      name: "t2",
      description: "tool 2",
      schema: z.object({}),
      execute: () => "t2",
    });

    registry.registerBatch([t1, t2]);
    expect(registry.size()).toBe(2);
    expect(registry.has("t1")).toBe(true);
    expect(registry.has("nonexistent")).toBe(false);

    expect(() => registry.register(t1)).toThrow("already registered");
    expect(() => registry.getOrThrow("missing")).toThrow();

    const filtered = registry.list(["t1"]);
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.name).toBe("t1");
  });
});
