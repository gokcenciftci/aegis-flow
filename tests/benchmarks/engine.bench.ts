import { bench, describe } from "vitest";
import { z } from "zod";
import { AgentStateMachine } from "../../src/core/state-machine.js";
import { type Message } from "../../src/core/types.js";
import { SlidingContextWindow } from "../../src/memory/sliding-window.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { ToolSandbox } from "../../src/tools/sandbox.js";
import { createTool } from "../../src/tools/tool.js";

describe("AegisFlow Performance Benchmarks", () => {
  const sm = new AgentStateMachine();
  bench("State Machine Lifecycle Transitions", () => {
    sm.reset();
    sm.transition("INITIALIZING");
    sm.transition("THINKING");
    sm.transition("TOOL_CALLING");
    sm.transition("EXECUTING_TOOLS");
    sm.transition("THINKING");
    sm.transition("COMPLETED");
  });

  const window = new SlidingContextWindow({ maxTokens: 4000 });
  const sampleMessages: Message[] = Array.from({ length: 50 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `Sample message content with token payload index ${i}`,
  }));

  bench("Sliding Window Context Pruning (50 msgs)", () => {
    window.fit(sampleMessages);
  });

  const registry = new ToolRegistry();
  const fastTool = createTool({
    name: "fast_calc",
    description: "Fast computation",
    schema: z.object({ x: z.number() }),
    execute: (args) => args.x * 2,
  });
  registry.register(fastTool);
  const sandbox = new ToolSandbox(registry);

  bench("Tool Sandbox Execution Pipeline", async () => {
    await sandbox.execute(
      { id: "c1", name: "fast_calc", arguments: { x: 42 } },
      { traceId: "bench_trace", agentId: "bench_agent" }
    );
  });
});
