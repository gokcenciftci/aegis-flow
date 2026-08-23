import {
  type LLMProvider,
  type LLMResponse,
  type Message,
  type ToolDefinitionContract,
} from "../../core/types.js";

export type { LLMProvider, LLMResponse, Message, ToolDefinitionContract };

export abstract class BaseLLMAdapter implements LLMProvider {
  public abstract readonly providerName: string;

  public abstract generateCompletion(
    messages: readonly Message[],
    tools?: readonly ToolDefinitionContract[],
    options?: { signal?: AbortSignal; traceId?: string }
  ): Promise<LLMResponse>;
}
