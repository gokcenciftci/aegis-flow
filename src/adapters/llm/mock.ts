import { ProviderError, TimeoutError } from "../../core/errors.js";
import {
  type LLMProvider,
  type LLMResponse,
  type Message,
  type ToolDefinitionContract,
} from "../../core/types.js";

export interface MockResponseRule {
  readonly response: LLMResponse;
  readonly delayMs?: number | undefined;
  readonly failWith?: {
    readonly type: "RATE_LIMIT" | "SERVER_ERROR" | "TIMEOUT" | "NETWORK";
    readonly message?: string | undefined;
    readonly statusCode?: number | undefined;
  } | undefined;
}

export class MockLLMAdapter implements LLMProvider {
  public readonly providerName = "mock-llm";
  private readonly _rules: MockResponseRule[] = [];
  private readonly _callHistory: {
    readonly messages: readonly Message[];
    readonly tools?: readonly ToolDefinitionContract[] | undefined;
    readonly timestamp: number;
  }[] = [];
  private _defaultResponse: LLMResponse = {
    content: "Deterministic mock response.",
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  };

  public get callHistory(): readonly (typeof this._callHistory)[number][] {
    return Object.freeze([...this._callHistory]);
  }

  public get callCount(): number {
    return this._callHistory.length;
  }

  public enqueueRule(rule: MockResponseRule): MockLLMAdapter {
    this._rules.push(rule);
    return this;
  }

  public setDefaultResponse(response: LLMResponse): MockLLMAdapter {
    this._defaultResponse = response;
    return this;
  }

  public async generateCompletion(
    messages: readonly Message[],
    tools?: readonly ToolDefinitionContract[] | undefined,
    options?: { signal?: AbortSignal | undefined; traceId?: string | undefined } | undefined
  ): Promise<LLMResponse> {
    this._callHistory.push({
      messages: [...messages],
      tools: tools ? [...tools] : undefined,
      timestamp: Date.now(),
    });

    const rule = this._rules.shift();

    if (rule?.delayMs && rule.delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, rule.delayMs);
        options?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("Operation aborted"));
        }, { once: true });
      });
    }

    if (rule?.failWith) {
      const { type, message, statusCode } = rule.failWith;
      if (type === "RATE_LIMIT") {
        throw new ProviderError(this.providerName, message ?? "Rate limit exceeded (429)", {
          statusCode: statusCode ?? 429,
          traceId: options?.traceId,
        });
      }
      if (type === "TIMEOUT") {
        throw new TimeoutError(this.providerName, rule.delayMs ?? 1000, { traceId: options?.traceId });
      }
      if (type === "SERVER_ERROR") {
        throw new ProviderError(this.providerName, message ?? "Internal server error (500)", {
          statusCode: statusCode ?? 500,
          traceId: options?.traceId,
        });
      }
      throw new Error(message ?? "Mock network failure");
    }

    return rule ? rule.response : this._defaultResponse;
  }

  public reset(): void {
    this._rules.length = 0;
    this._callHistory.length = 0;
  }
}
