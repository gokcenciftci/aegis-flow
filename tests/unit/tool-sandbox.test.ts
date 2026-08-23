import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../../src/tools/registry.js";
import { ToolSandbox } from "../../src/tools/sandbox.js";
import { createTool } from "../../src/tools/tool.js";

describe("ToolSandbox", () => {
  it("should execute valid tool and return structured result", async () => {
    const registry = new ToolRegistry();
    const echoTool = createTool({
      name: "echo",
      description: "Echoes input text",
      schema: z.object({ text: z.string() }),
      execute: (args) => `Echo: ${args.text}`,
    });
    registry.register(echoTool);

    const sandbox = new ToolSandbox(registry);
    const result = await sandbox.execute(
      { id: "call_1", name: "echo", arguments: { text: "Hello" } },
      { traceId: "t1", agentId: "a1" }
    );

    expect(result.isError).toBe(false);
    expect(result.content).toBe("Echo: Hello");
    expect(result.toolName).toBe("echo");
  });

  it("should catch validation errors gracefully without crashing", async () => {
    const registry = new ToolRegistry();
    const sumTool = createTool({
      name: "sum",
      description: "Sums two numbers",
      schema: z.object({ a: z.number(), b: z.number() }),
      execute: (args) => args.a + args.b,
    });
    registry.register(sumTool);

    const sandbox = new ToolSandbox(registry);
    const result = await sandbox.execute(
      { id: "call_2", name: "sum", arguments: { a: "invalid_string", b: 10 } },
      { traceId: "t1", agentId: "a1" }
    );

    expect(result.isError).toBe(true);
    expect(result.content).toContain("Schema Error");
  });

  it("should enforce execution timeout", async () => {
    const registry = new ToolRegistry();
    const slowTool = createTool({
      name: "slow",
      description: "Hangs indefinitely",
      schema: z.object({}),
      execute: async () => new Promise((resolve) => setTimeout(resolve, 5000)),
    });
    registry.register(slowTool);

    const sandbox = new ToolSandbox(registry, { defaultTimeoutMs: 50 });
    const result = await sandbox.execute(
      { id: "call_3", name: "slow", arguments: {} },
      { traceId: "t1", agentId: "a1", timeoutMs: 50 }
    );

    expect(result.isError).toBe(true);
    expect(result.content).toContain("timed out after 50ms");
  });
});
