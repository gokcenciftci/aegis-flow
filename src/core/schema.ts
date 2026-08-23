import { z } from "zod";

export const BudgetConfigSchema = z.object({
  maxTokens: z.number().int().positive().default(50_000),
  maxCostUsd: z.number().positive().default(1.0),
  maxSteps: z.number().int().positive().default(25),
  executionTimeoutMs: z.number().int().positive().default(60_000),
});

export const ResilienceConfigSchema = z.object({
  maxRetries: z.number().int().min(0).default(3),
  initialDelayMs: z.number().int().positive().default(250),
  maxDelayMs: z.number().int().positive().default(4000),
  failureThreshold: z.number().int().positive().default(5),
  recoveryTimeoutMs: z.number().int().positive().default(15_000),
  rateLimitPerMinute: z.number().int().positive().default(60),
});

export const AgentConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Agent name cannot be empty"),
  systemPrompt: z.string().min(1, "System prompt cannot be empty"),
  model: z.string().default("gpt-4o"),
  temperature: z.number().min(0).max(2).default(0.1),
  budget: BudgetConfigSchema.partial().optional(),
  resilience: ResilienceConfigSchema.partial().optional(),
  allowedTools: z.array(z.string()).optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
