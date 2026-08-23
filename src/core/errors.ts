export abstract class AegisError extends Error {
  public abstract readonly code: string;
  public readonly timestamp: number;
  public readonly traceId?: string | undefined;
  public readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  public override readonly cause?: unknown | undefined;

  constructor(
    message: string,
    options?: {
      traceId?: string | undefined;
      metadata?: Readonly<Record<string, unknown>> | undefined;
      cause?: unknown | undefined;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = Date.now();
    this.traceId = options?.traceId;
    this.metadata = options?.metadata;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnknownEngineError extends AegisError {
  public readonly code = "UNKNOWN_ENGINE_ERROR" as const;

  constructor(message: string, options?: { traceId?: string | undefined; cause?: unknown | undefined }) {
    super(message, options);
  }
}

export class CircuitBreakerOpenError extends AegisError {
  public readonly code = "CIRCUIT_BREAKER_OPEN" as const;
  public readonly retryAfterMs: number;

  constructor(service: string, retryAfterMs: number, options?: { traceId?: string | undefined }) {
    super(`Circuit breaker for service '${service}' is OPEN. Retry after ${retryAfterMs}ms`, options);
    this.retryAfterMs = retryAfterMs;
  }
}

export class RateLimitExceededError extends AegisError {
  public readonly code = "RATE_LIMIT_EXCEEDED" as const;
  public readonly retryAfterMs: number;

  constructor(service: string, retryAfterMs: number, options?: { traceId?: string | undefined }) {
    super(`Rate limit exceeded for '${service}'. Retry after ${retryAfterMs}ms`, options);
    this.retryAfterMs = retryAfterMs;
  }
}

export class BudgetExceededError extends AegisError {
  public readonly code = "BUDGET_EXCEEDED" as const;
  public readonly currentUsage: number;
  public readonly limit: number;

  constructor(metric: "tokens" | "cost" | "steps", currentUsage: number, limit: number, options?: { traceId?: string | undefined }) {
    super(`Execution budget exceeded for ${metric}: ${currentUsage} / ${limit}`, options);
    this.currentUsage = currentUsage;
    this.limit = limit;
  }
}

export class ToolExecutionError extends AegisError {
  public readonly code = "TOOL_EXECUTION_FAILED" as const;
  public readonly toolName: string;

  constructor(toolName: string, message: string, options?: { traceId?: string | undefined; cause?: unknown | undefined }) {
    super(`Execution failed for tool '${toolName}': ${message}`, options);
    this.toolName = toolName;
  }
}

export class ToolNotFoundError extends AegisError {
  public readonly code = "TOOL_NOT_FOUND" as const;
  public readonly toolName: string;

  constructor(toolName: string, options?: { traceId?: string | undefined }) {
    super(`Tool '${toolName}' is not registered in the active tool registry`, options);
    this.toolName = toolName;
  }
}

export class InvalidStateTransitionError extends AegisError {
  public readonly code = "INVALID_STATE_TRANSITION" as const;
  public readonly fromState: string;
  public readonly toState: string;

  constructor(fromState: string, toState: string, options?: { traceId?: string | undefined }) {
    super(`Illegal state transition from '${fromState}' to '${toState}'`, options);
    this.fromState = fromState;
    this.toState = toState;
  }
}

export class TimeoutError extends AegisError {
  public readonly code = "TIMEOUT_EXCEEDED" as const;
  public readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number, options?: { traceId?: string | undefined }) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`, options);
    this.timeoutMs = timeoutMs;
  }
}

export class ProviderError extends AegisError {
  public readonly code = "PROVIDER_ERROR" as const;
  public readonly provider: string;
  public readonly statusCode?: number | undefined;

  constructor(provider: string, message: string, options?: { statusCode?: number | undefined; traceId?: string | undefined; cause?: unknown | undefined }) {
    super(`Provider '${provider}' error: ${message}`, options);
    this.provider = provider;
    this.statusCode = options?.statusCode;
  }
}

export class SchemaValidationError extends AegisError {
  public readonly code = "SCHEMA_VALIDATION_ERROR" as const;
  public readonly issues: readonly string[];

  constructor(target: string, issues: readonly string[], options?: { traceId?: string | undefined }) {
    super(`Validation failed for '${target}': ${issues.join("; ")}`, options);
    this.issues = issues;
  }
}
