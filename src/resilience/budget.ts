import { BudgetExceededError, TimeoutError } from "../core/errors.js";
import { type BudgetConfig, type TokenUsage } from "../core/types.js";

export class BudgetGuard {
  private readonly _config: BudgetConfig;
  private readonly _startTime: number;
  private _promptTokens = 0;
  private _completionTokens = 0;
  private _stepCount = 0;
  private _accumulatedCostUsd = 0;

  constructor(config: BudgetConfig, startTime: number = Date.now()) {
    this._config = config;
    this._startTime = startTime;
  }

  public get tokenUsage(): TokenUsage {
    return {
      promptTokens: this._promptTokens,
      completionTokens: this._completionTokens,
      totalTokens: this._promptTokens + this._completionTokens,
      estimatedCostUsd: Number(this._accumulatedCostUsd.toFixed(6)),
    };
  }

  public get stepCount(): number {
    return this._stepCount;
  }

  public recordUsage(
    usage: { promptTokens: number; completionTokens: number },
    costPerTokenUsd?: { promptCostPer1k: number; completionCostPer1k: number }
  ): void {
    this._promptTokens += usage.promptTokens;
    this._completionTokens += usage.completionTokens;

    if (costPerTokenUsd) {
      const promptCost = (usage.promptTokens / 1000) * costPerTokenUsd.promptCostPer1k;
      const compCost = (usage.completionTokens / 1000) * costPerTokenUsd.completionCostPer1k;
      this._accumulatedCostUsd += promptCost + compCost;
    }
  }

  public recordStep(): void {
    this._stepCount += 1;
  }

  public checkBudget(traceId?: string): void {
    const elapsed = Date.now() - this._startTime;
    if (elapsed > this._config.executionTimeoutMs) {
      throw new TimeoutError("Agent execution loop", this._config.executionTimeoutMs, { traceId });
    }

    if (this._stepCount > this._config.maxSteps) {
      throw new BudgetExceededError("steps", this._stepCount, this._config.maxSteps, { traceId });
    }

    const totalTokens = this._promptTokens + this._completionTokens;
    if (totalTokens > this._config.maxTokens) {
      throw new BudgetExceededError("tokens", totalTokens, this._config.maxTokens, { traceId });
    }

    if (this._accumulatedCostUsd > this._config.maxCostUsd) {
      throw new BudgetExceededError("cost", this._accumulatedCostUsd, this._config.maxCostUsd, { traceId });
    }
  }
}
