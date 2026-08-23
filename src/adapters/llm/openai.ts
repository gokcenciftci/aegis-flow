import { ProviderError } from "../../core/errors.js";
import {
  type LLMProvider,
  type LLMResponse,
  type Message,
  type ToolCall,
  type ToolDefinitionContract,
} from "../../core/types.js";

export interface OpenAIAdapterConfig {
  readonly apiKey?: string | undefined;
  readonly baseUrl?: string | undefined;
  readonly model?: string | undefined;
  readonly timeoutMs?: number | undefined;
}

export class OpenAIAdapter implements LLMProvider {
  public readonly providerName = "openai-compatible";
  private readonly _apiKey: string;
  private readonly _baseUrl: string;
  private readonly _model: string;
  private readonly _timeoutMs: number;

  constructor(config?: OpenAIAdapterConfig | undefined) {
    this._apiKey = config?.apiKey ?? process.env["OPENAI_API_KEY"] ?? "";
    this._baseUrl = (config?.baseUrl ?? process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this._model = config?.model ?? "gpt-4o";
    this._timeoutMs = config?.timeoutMs ?? 30_000;
  }

  public async generateCompletion(
    messages: readonly Message[],
    tools?: readonly ToolDefinitionContract[] | undefined,
    options?: { signal?: AbortSignal | undefined; traceId?: string | undefined } | undefined
  ): Promise<LLMResponse> {
    const formattedMessages = messages.map((m) => {
      if (m.role === "tool") {
        return {
          role: "tool",
          tool_call_id: m.toolCallId,
          content: m.content,
        };
      }
      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: "assistant",
          content: m.content,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return {
        role: m.role,
        content: m.content,
      };
    });

    const formattedTools = tools && tools.length > 0
      ? tools.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parametersSchema,
          },
        }))
      : undefined;

    const payload: Record<string, unknown> = {
      model: this._model,
      messages: formattedMessages,
    };
    if (formattedTools) {
      payload["tools"] = formattedTools;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      const response = await fetch(`${this._baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this._apiKey ? { Authorization: `Bearer ${this._apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ProviderError(
          this.providerName,
          `HTTP ${response.status}: ${errorText}`,
          { statusCode: response.status, traceId: options?.traceId }
        );
      }

      const json = (await response.json()) as {
        choices: Array<{
          message: {
            content: string | null;
            tool_calls?: Array<{
              id: string;
              function: { name: string; arguments: string };
            }>;
          };
          finish_reason?: "stop" | "tool_calls" | "length" | "content_filter";
        }>;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const choice = json.choices[0];
      if (!choice) {
        throw new ProviderError(this.providerName, "No choice returned from API", { traceId: options?.traceId });
      }

      let parsedToolCalls: readonly ToolCall[] | undefined = undefined;
      if (choice.message.tool_calls) {
        parsedToolCalls = choice.message.tool_calls.map((tc) => {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            parsedArgs = { raw: tc.function.arguments };
          }
          return {
            id: tc.id,
            name: tc.function.name,
            arguments: parsedArgs,
          };
        });
      }

      return {
        content: choice.message.content,
        toolCalls: parsedToolCalls,
        finishReason: choice.finish_reason,
        usage: {
          promptTokens: json.usage?.prompt_tokens ?? 0,
          completionTokens: json.usage?.completion_tokens ?? 0,
          totalTokens: json.usage?.total_tokens ?? 0,
        },
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(this.providerName, (err as Error).message, { traceId: options?.traceId, cause: err });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
