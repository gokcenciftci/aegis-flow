import { RateLimitExceededError } from "../core/errors.js";

export interface RateLimiterOptions {
  readonly capacity: number;
  readonly refillRatePerMinute: number;
  readonly serviceName?: string;
}

export class TokenBucketRateLimiter {
  private readonly _capacity: number;
  private readonly _refillRatePerMs: number;
  private readonly _serviceName: string;
  private _tokens: number;
  private _lastRefillTimestamp: number;

  constructor(options: RateLimiterOptions) {
    this._capacity = Math.max(1, options.capacity);
    this._tokens = this._capacity;
    this._refillRatePerMs = options.refillRatePerMinute / 60_000;
    this._serviceName = options.serviceName ?? "service";
    this._lastRefillTimestamp = Date.now();
  }

  public get availableTokens(): number {
    this.refill();
    return Math.floor(this._tokens);
  }

  public tryAcquire(tokens: number = 1): boolean {
    this.refill();
    if (this._tokens >= tokens) {
      this._tokens -= tokens;
      return true;
    }
    return false;
  }

  public async acquire(tokens: number = 1): Promise<void> {
    if (!this.tryAcquire(tokens)) {
      const needed = tokens - this._tokens;
      const waitMs = Math.ceil(needed / this._refillRatePerMs);
      throw new RateLimitExceededError(this._serviceName, waitMs);
    }
  }

  public reset(): void {
    this._tokens = this._capacity;
    this._lastRefillTimestamp = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this._lastRefillTimestamp;
    if (elapsed <= 0) return;

    const refillTokens = elapsed * this._refillRatePerMs;
    this._tokens = Math.min(this._capacity, this._tokens + refillTokens);
    this._lastRefillTimestamp = now;
  }
}
