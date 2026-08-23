#!/usr/bin/env node
import { z } from "zod";
import { Agent } from "./core/agent.js";
import { isOk } from "./core/result.js";
import { MockLLMAdapter } from "./adapters/llm/mock.js";
import { OpenAIAdapter } from "./adapters/llm/openai.js";
import { ConsoleTraceExporter } from "./adapters/telemetry/console-exporter.js";
import { AegisFlowEngine } from "./engine.js";
import { ToolRegistry } from "./tools/registry.js";
import { createTool } from "./tools/tool.js";

async function main() {
  console.log("\n\x1b[1m\x1b[36m=====================================================");
  console.log(" 🛡️  AegisFlow Agent Execution Engine & Gateway  🛡️");
  console.log("=====================================================\x1b[0m\n");

  const calculatorTool = createTool({
    name: "calculator",
    description: "Evaluates mathematical expressions safely",
    schema: z.object({
      expression: z.string().describe("Mathematical expression, e.g., '14 * 25 + 120'"),
    }),
    execute: (args) => {
      try {

        const sanitized = args.expression.replace(/[^0-9+\-*/(). ]/g, "");
        const result = Function(`'use strict'; return (${sanitized})`)() as number;
        return { expression: args.expression, result };
      } catch {
        return { error: "Failed to evaluate expression" };
      }
    },
  });

  const systemMetricsTool = createTool({
    name: "get_system_metrics",
    description: "Retrieves current system memory and CPU architecture stats",
    schema: z.object({
      filter: z.enum(["all", "memory", "cpu"]).default("all"),
    }),
    execute: () => {
      return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      };
    },
  });

  const registry = new ToolRegistry();
  registry.register(calculatorTool);
  registry.register(systemMetricsTool);

  const agent = Agent.create({
    name: "DevOpsOrchestrator",
    systemPrompt: "You are an autonomous DevOps & Systems Assistant. Use available tools to analyze systems and calculate metrics.",
    model: "gpt-4o",
    budget: {
      maxTokens: 10_000,
      maxSteps: 5,
    },
    resilience: {
      maxRetries: 3,
      initialDelayMs: 100,
    },
  });

  const hasApiKey = Boolean(process.env["OPENAI_API_KEY"]);
  const provider = hasApiKey
    ? new OpenAIAdapter()
    : new MockLLMAdapter()
        .enqueueRule({
          response: {
            content: "I will check the system metrics first to inspect memory consumption.",
            toolCalls: [
              {
                id: "call_sys_1",
                name: "get_system_metrics",
                arguments: { filter: "all" },
              },
            ],
            usage: { promptTokens: 45, completionTokens: 25, totalTokens: 70 },
          },
        })
        .enqueueRule({
          response: {
            content: "System metrics collected. Now I will calculate the cluster memory projection.",
            toolCalls: [
              {
                id: "call_calc_1",
                name: "calculator",
                arguments: { expression: "64 * 1024 - 128" },
              },
            ],
            usage: { promptTokens: 90, completionTokens: 30, totalTokens: 120 },
          },
        })
        .enqueueRule({
          response: {
            content: "Analysis complete! Node runtime is active with 65,408 MB projected headroom. All resilience gates verified.",
            usage: { promptTokens: 120, completionTokens: 40, totalTokens: 160 },
          },
        });

  console.log(`\x1b[90mActive Provider: ${provider.providerName} (${hasApiKey ? "Live API" : "Deterministic Sandbox Mode"})\x1b[0m\n`);

  const engine = new AegisFlowEngine({
    agent,
    provider,
    toolRegistry: registry,
  });

  ConsoleTraceExporter.attach(engine.events);

  const prompt = "Inspect system health and compute projected cluster headroom for a 64GB node pool.";
  console.log(`\x1b[1mUser Query:\x1b[0m "${prompt}"\n`);

  const result = await engine.run(prompt);

  if (isOk(result)) {
    console.log("\n\x1b[32m\x1b[1m✔ Task Succeeded!\x1b[0m");
    console.log(`\x1b[1mSummary Output:\x1b[0m\n${result.value.output}\n`);
    console.log("\x1b[1mTelemetry Metrics:\x1b[0m");
    console.table(engine.metrics.getSummary());
  } else {
    console.error("\n\x1b[31m\x1b[1m✖ Execution Failed:\x1b[0m", result.error.message);
  }
}

void main();
