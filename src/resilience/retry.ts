export interface RetryPolicyOptions {
  readonly maxRetries?: number | undefined;
  readonly initialDelayMs?: number | undefined;
  readonly maxDelayMs?: number | undefined;
  readonly backoffFactor?: number | undefined;
  readonly shouldRetry?: ((error: unknown, attempt: number) => boolean) | undefined;
}

export const calculateExponentialBackoffWithJitter = (
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffFactor: number = 2
): number => {
  const calculatedDelay = initialDelayMs * Math.pow(backoffFactor, attempt);
  const cappedDelay = Math.min(maxDelayMs, calculatedDelay);

  return Math.floor(Math.random() * cappedDelay);
};

export const sleep = (ms: number, signal?: AbortSignal | undefined): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error("Operation aborted"));
    }

    const timer = setTimeout(() => {
      resolve();
    }, ms);

    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("Operation aborted"));
    }, { once: true });
  });
};

export class RetryPolicy {
  public readonly maxRetries: number;
  public readonly initialDelayMs: number;
  public readonly maxDelayMs: number;
  public readonly backoffFactor: number;
  private readonly _shouldRetry?: ((error: unknown, attempt: number) => boolean) | undefined;

  constructor(options?: RetryPolicyOptions | undefined) {
    this.maxRetries = options?.maxRetries ?? 3;
    this.initialDelayMs = options?.initialDelayMs ?? 250;
    this.maxDelayMs = options?.maxDelayMs ?? 4000;
    this.backoffFactor = options?.backoffFactor ?? 2;
    this._shouldRetry = options?.shouldRetry;
  }

  public async execute<T>(
    fn: (attempt: number) => Promise<T>,
    options?: {
      signal?: AbortSignal | undefined;
      onRetry?: ((attempt: number, delayMs: number, error: unknown) => void) | undefined;
    } | undefined
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        if (options?.signal?.aborted) {
          throw new Error("Operation aborted");
        }
        return await fn(attempt);
      } catch (error) {
        attempt += 1;

        const isRetryAllowed = this._shouldRetry ? this._shouldRetry(error, attempt) : true;
        if (attempt > this.maxRetries || !isRetryAllowed) {
          throw error;
        }

        const delayMs = calculateExponentialBackoffWithJitter(
          attempt - 1,
          this.initialDelayMs,
          this.maxDelayMs,
          this.backoffFactor
        );

        options?.onRetry?.(attempt, delayMs, error);
        await sleep(delayMs, options?.signal);
      }
    }
  }
}
