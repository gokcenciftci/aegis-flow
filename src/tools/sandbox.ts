import { SchemaValidationError, TimeoutError } from "../core/errors.js";
import { type ToolCall, type ToolResult } from "../core/types.js";
import { type ToolRegistry } from "./registry.js";
import { type ToolExecutionContext } from "./tool.js";

export interface SandboxOptions {
  readonly defaultTimeoutMs?: number | undefined;
}

export class ToolSandbox {
  private readonly _registry: ToolRegistry;
  private readonly _defaultTimeoutMs: number;

  constructor(registry: ToolRegistry, options?: SandboxOptions | undefined) {
    this._registry = registry;
    this._defaultTimeoutMs = options?.defaultTimeoutMs ?? 10_000;
  }

  public async execute(
    call: ToolCall,
    context: {
      traceId: string;
      agentId: string;
      signal?: AbortSignal | undefined;
      timeoutMs?: number | undefined;
    }
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const timeoutMs = context.timeoutMs ?? this._defaultTimeoutMs;

    try {
      const tool = this._registry.get(call.name);
      if (!tool) {
        return {
          toolCallId: call.id,
          toolName: call.name,
          content: `Error: Tool '${call.name}' is not recognized or permitted.`,
          isError: true,
          executionTimeMs: Date.now() - startTime,
        };
      }

      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = tool.parseArguments(call.arguments);
      } catch (err) {
        const issues = err instanceof Error ? [err.message] : ["Invalid arguments"];
        const valError = new SchemaValidationError(call.name, issues, { traceId: context.traceId });
        return {
          toolCallId: call.id,
          toolName: call.name,
          content: `Schema Error: ${valError.message}`,
          isError: true,
          executionTimeMs: Date.now() - startTime,
        };
      }

      const executionContext: ToolExecutionContext = {
        traceId: context.traceId,
        agentId: context.agentId,
        timeoutMs,
        signal: context.signal,
      };

      const resultPromise = Promise.resolve(tool.run(parsedArgs, executionContext));

      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new TimeoutError(`Tool '${call.name}'`, timeoutMs, { traceId: context.traceId }));
        }, timeoutMs);

        context.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("Tool execution aborted"));
        }, { once: true });
      });

      const rawResult = await Promise.race([resultPromise, timeoutPromise]);
      const stringifiedResult = typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult, null, 2);

      return {
        toolCallId: call.id,
        toolName: call.name,
        content: stringifiedResult,
        isError: false,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        toolCallId: call.id,
        toolName: call.name,
        content: `Tool Execution Failure: ${message}`,
        isError: true,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  public async executeBatch(
    calls: readonly ToolCall[],
    context: {
      traceId: string;
      agentId: string;
      signal?: AbortSignal | undefined;
      timeoutMs?: number | undefined;
    }
  ): Promise<readonly ToolResult[]> {
    const promises = calls.map((call) => this.execute(call, context));
    return await Promise.all(promises);
  }
}
