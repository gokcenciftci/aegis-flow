export interface LatencyHistogram {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly p50: number;
  readonly p90: number;
  readonly p95: number;
  readonly p99: number;
}

export const calculatePercentile = (sortedValues: readonly number[], percentile: number): number => {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  const clampedIndex = Math.max(0, Math.min(sortedValues.length - 1, index));
  return sortedValues[clampedIndex] ?? 0;
};

export const computeHistogram = (samples: readonly number[]): LatencyHistogram => {
  if (samples.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const mean = Number((sum / sorted.length).toFixed(2));

  return {
    count: sorted.length,
    min,
    max,
    mean,
    p50: calculatePercentile(sorted, 50),
    p90: calculatePercentile(sorted, 90),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
  };
};

export class MetricsCollector {
  private readonly _latencies: number[] = [];
  private _successfulSteps = 0;
  private _failedSteps = 0;
  private _promptTokens = 0;
  private _completionTokens = 0;

  public recordStepLatency(durationMs: number): void {
    this._latencies.push(durationMs);
  }

  public recordStepSuccess(): void {
    this._successfulSteps += 1;
  }

  public recordStepFailure(): void {
    this._failedSteps += 1;
  }

  public recordTokens(prompt: number, completion: number): void {
    this._promptTokens += prompt;
    this._completionTokens += completion;
  }

  public getSummary(): {
    readonly totalSteps: number;
    readonly successRate: number;
    readonly totalTokens: number;
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly latencyHistogram: LatencyHistogram;
  } {
    const totalSteps = this._successfulSteps + this._failedSteps;
    const successRate = totalSteps > 0 ? Number(((this._successfulSteps / totalSteps) * 100).toFixed(2)) : 100;

    return {
      totalSteps,
      successRate,
      totalTokens: this._promptTokens + this._completionTokens,
      promptTokens: this._promptTokens,
      completionTokens: this._completionTokens,
      latencyHistogram: computeHistogram(this._latencies),
    };
  }
}
