import { ToolNotFoundError } from "../core/errors.js";
import { type ToolDefinitionContract } from "../core/types.js";
import { Tool } from "./tool.js";

type AnyTool = Tool<Record<string, unknown>, unknown>;

export class ToolRegistry {
  private readonly _tools: Map<string, AnyTool> = new Map();

  public register<TArgs extends Record<string, unknown>, TResult>(tool: Tool<TArgs, TResult>): ToolRegistry {
    if (this._tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered in registry`);
    }
    this._tools.set(tool.name, tool as unknown as AnyTool);
    return this;
  }

  public registerBatch(tools: readonly Tool<Record<string, unknown>, unknown>[]): ToolRegistry {
    for (const tool of tools) {
      this.register(tool);
    }
    return this;
  }

  public get(name: string): AnyTool | undefined {
    return this._tools.get(name);
  }

  public getOrThrow(name: string, traceId?: string): AnyTool {
    const tool = this._tools.get(name);
    if (!tool) {
      throw new ToolNotFoundError(name, { traceId });
    }
    return tool;
  }

  public has(name: string): boolean {
    return this._tools.has(name);
  }

  public list(allowedNames?: readonly string[]): AnyTool[] {
    const all = Array.from(this._tools.values());
    if (!allowedNames || allowedNames.length === 0) {
      return all;
    }
    return all.filter((t) => allowedNames.includes(t.name));
  }

  public toContracts(allowedNames?: readonly string[]): ToolDefinitionContract[] {
    return this.list(allowedNames).map((t) => t.toContract());
  }

  public size(): number {
    return this._tools.size;
  }
}
