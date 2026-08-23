import { AgentConfigSchema, type AgentConfig } from "./schema.js";
import { type BudgetConfig, type ResilienceConfig } from "./types.js";

export const DEFAULT_BUDGET: BudgetConfig = {
  maxTokens: 50_000,
  maxCostUsd: 1.0,
  maxSteps: 25,
  executionTimeoutMs: 60_000,
};

export const DEFAULT_RESILIENCE: ResilienceConfig = {
  maxRetries: 3,
  initialDelayMs: 250,
  maxDelayMs: 4000,
  failureThreshold: 5,
  recoveryTimeoutMs: 15_000,
  rateLimitPerMinute: 60,
};

export class Agent {
  public readonly id: string;
  public readonly name: string;
  public readonly systemPrompt: string;
  public readonly model: string;
  public readonly temperature: number;
  public readonly budget: BudgetConfig;
  public readonly resilience: ResilienceConfig;
  public readonly allowedTools: readonly string[];

  private constructor(config: AgentConfig) {
    this.id = config.id ?? `agent_${Math.random().toString(36).substring(2, 10)}`;
    this.name = config.name;
    this.systemPrompt = config.systemPrompt;
    this.model = config.model ?? "gpt-4o";
    this.temperature = config.temperature ?? 0.1;

    this.budget = {
      maxTokens: config.budget?.maxTokens ?? DEFAULT_BUDGET.maxTokens,
      maxCostUsd: config.budget?.maxCostUsd ?? DEFAULT_BUDGET.maxCostUsd,
      maxSteps: config.budget?.maxSteps ?? DEFAULT_BUDGET.maxSteps,
      executionTimeoutMs: config.budget?.executionTimeoutMs ?? DEFAULT_BUDGET.executionTimeoutMs,
    };

    this.resilience = {
      maxRetries: config.resilience?.maxRetries ?? DEFAULT_RESILIENCE.maxRetries,
      initialDelayMs: config.resilience?.initialDelayMs ?? DEFAULT_RESILIENCE.initialDelayMs,
      maxDelayMs: config.resilience?.maxDelayMs ?? DEFAULT_RESILIENCE.maxDelayMs,
      failureThreshold: config.resilience?.failureThreshold ?? DEFAULT_RESILIENCE.failureThreshold,
      recoveryTimeoutMs: config.resilience?.recoveryTimeoutMs ?? DEFAULT_RESILIENCE.recoveryTimeoutMs,
      rateLimitPerMinute: config.resilience?.rateLimitPerMinute ?? DEFAULT_RESILIENCE.rateLimitPerMinute,
    };

    this.allowedTools = Object.freeze([...(config.allowedTools ?? [])]);
  }

  public static create(config: unknown): Agent {
    const parsed = AgentConfigSchema.parse(config);
    return new Agent(parsed);
  }
}
