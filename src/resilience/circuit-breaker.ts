import { CircuitBreakerOpenError } from "../core/errors.js";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  readonly failureThreshold?: number;
  readonly recoveryTimeoutMs?: number;
  readonly serviceName?: string;
}

export class CircuitBreaker {
  private _state: CircuitState = "CLOSED";
  private _consecutiveFailures = 0;
  private _lastStateChange = Date.now();
  private readonly _failureThreshold: number;
  private readonly _recoveryTimeoutMs: number;
  private readonly _serviceName: string;

  constructor(options?: CircuitBreakerOptions) {
    this._failureThreshold = options?.failureThreshold ?? 5;
    this._recoveryTimeoutMs = options?.recoveryTimeoutMs ?? 15_000;
    this._serviceName = options?.serviceName ?? "external-service";
  }

  public get state(): CircuitState {
    this.checkAutoRecovery();
    return this._state;
  }

  public get consecutiveFailures(): number {
    return this._consecutiveFailures;
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkAutoRecovery();

    if (this._state === "OPEN") {
      const remainingMs = Math.max(0, this._recoveryTimeoutMs - (Date.now() - this._lastStateChange));
      throw new CircuitBreakerOpenError(this._serviceName, remainingMs);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  public recordSuccess(): void {
    this._consecutiveFailures = 0;
    if (this._state === "HALF_OPEN") {
      this._state = "CLOSED";
      this._lastStateChange = Date.now();
    }
  }

  public recordFailure(): void {
    this._consecutiveFailures += 1;
    if (this._state === "HALF_OPEN" || this._consecutiveFailures >= this._failureThreshold) {
      this._state = "OPEN";
      this._lastStateChange = Date.now();
    }
  }

  public reset(): void {
    this._state = "CLOSED";
    this._consecutiveFailures = 0;
    this._lastStateChange = Date.now();
  }

  private checkAutoRecovery(): void {
    if (this._state === "OPEN") {
      const elapsed = Date.now() - this._lastStateChange;
      if (elapsed >= this._recoveryTimeoutMs) {
        this._state = "HALF_OPEN";
        this._lastStateChange = Date.now();
      }
    }
  }
}
