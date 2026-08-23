import { z } from "zod";
import { type ToolDefinitionContract } from "../core/types.js";

export interface ToolExecutionContext {
  readonly traceId: string;
  readonly agentId: string;
  readonly timeoutMs?: number | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface ToolConfig<TArgs extends Record<string, unknown>, TResult> {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodType<TArgs>;
  readonly execute: (args: TArgs, context: ToolExecutionContext) => Promise<TResult> | TResult;
}

export class Tool<TArgs extends Record<string, unknown> = Record<string, unknown>, TResult = unknown> {
  public readonly name: string;
  public readonly description: string;
  public readonly schema: z.ZodType<TArgs>;
  private readonly _executor: (args: TArgs, context: ToolExecutionContext) => Promise<TResult> | TResult;

  constructor(config: ToolConfig<TArgs, TResult>) {
    this.name = config.name;
    this.description = config.description;
    this.schema = config.schema;
    this._executor = config.execute;
  }

  public parseArguments(rawArgs: unknown): TArgs {
    return this.schema.parse(rawArgs);
  }

  public async run(args: TArgs, context: ToolExecutionContext): Promise<TResult> {
    return await this._executor(args, context);
  }

  public toContract(): ToolDefinitionContract {
    return {
      name: this.name,
      description: this.description,
      parametersSchema: {
        type: "object",
        description: this.description,
      },
    };
  }
}

export const createTool = <TArgs extends Record<string, unknown>, TResult>(
  config: ToolConfig<TArgs, TResult>
): Tool<TArgs, TResult> => {
  return new Tool<TArgs, TResult>(config);
};
