export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

export interface ToolResult {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly content: string;
  readonly isError: boolean;
  readonly executionTimeMs: number;
}

export interface SystemMessage {
  readonly role: "system";
  readonly content: string;
}

export interface UserMessage {
  readonly role: "user";
  readonly content: string;
}

export interface AssistantMessage {
  readonly role: "assistant";
  readonly content: string | null;
  readonly toolCalls?: readonly ToolCall[] | undefined;
}

export interface ToolMessage {
  readonly role: "tool";
  readonly toolCallId: string;
  readonly toolName: string;
  readonly content: string;
  readonly isError?: boolean | undefined;
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

export type AgentStatus =
  | "IDLE"
  | "INITIALIZING"
  | "THINKING"
  | "TOOL_CALLING"
  | "EXECUTING_TOOLS"
  | "COMPLETED"
  | "FAILED"
  | "PAUSED";

export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number;
}

export interface BudgetConfig {
  readonly maxTokens: number;
  readonly maxCostUsd: number;
  readonly maxSteps: number;
  readonly executionTimeoutMs: number;
}

export interface ResilienceConfig {
  readonly maxRetries: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly failureThreshold: number;
  readonly recoveryTimeoutMs: number;
  readonly rateLimitPerMinute: number;
}

export interface AgentContext {
  readonly traceId: string;
  readonly agentId: string;
  readonly stepCount: number;
  readonly status: AgentStatus;
  readonly tokenUsage: TokenUsage;
  readonly startTime: number;
  readonly lastActiveTime: number;
}

export interface LLMResponse {
  readonly content: string | null;
  readonly toolCalls?: readonly ToolCall[] | undefined;
  readonly usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
  readonly finishReason?: "stop" | "tool_calls" | "length" | "content_filter" | undefined;
}

export interface LLMProvider {
  readonly providerName: string;
  generateCompletion(
    messages: readonly Message[],
    tools?: readonly ToolDefinitionContract[] | undefined,
    options?: { signal?: AbortSignal | undefined; traceId?: string | undefined } | undefined
  ): Promise<LLMResponse>;
}

export interface ToolDefinitionContract {
  readonly name: string;
  readonly description: string;
  readonly parametersSchema: Readonly<Record<string, unknown>>;
}
