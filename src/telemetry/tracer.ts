export interface Span {
  readonly id: string;
  readonly traceId: string;
  readonly parentSpanId?: string | undefined;
  readonly name: string;
  readonly startTime: number;
  endTime?: number | undefined;
  durationMs?: number | undefined;
  status: "OK" | "ERROR" | "IN_PROGRESS";
  error?: string | undefined;
  readonly attributes: Record<string, unknown>;
}

export class Tracer {
  private readonly _spans: Map<string, Span> = new Map();
  private readonly _traceId: string;

  constructor(traceId?: string | undefined) {
    this._traceId = traceId ?? `trace_${Math.random().toString(36).substring(2, 12)}`;
  }

  public get traceId(): string {
    return this._traceId;
  }

  public get spans(): readonly Span[] {
    return Object.freeze(Array.from(this._spans.values()));
  }

  public startSpan(name: string, attributes?: Record<string, unknown> | undefined, parentSpanId?: string | undefined): Span {
    const id = `span_${Math.random().toString(36).substring(2, 10)}`;
    const span: Span = {
      id,
      traceId: this._traceId,
      parentSpanId,
      name,
      startTime: Date.now(),
      status: "IN_PROGRESS",
      attributes: { ...(attributes ?? {}) },
    };

    this._spans.set(id, span);
    return span;
  }

  public endSpan(spanId: string, status: "OK" | "ERROR" = "OK", error?: unknown): void {
    const span = this._spans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = status;
    if (error) {
      span.error = error instanceof Error ? error.message : String(error);
    }
  }

  public async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, unknown> | undefined,
    parentSpanId?: string | undefined
  ): Promise<T> {
    const span = this.startSpan(name, attributes, parentSpanId);
    try {
      const result = await fn(span);
      this.endSpan(span.id, "OK");
      return result;
    } catch (err) {
      this.endSpan(span.id, "ERROR", err);
      throw err;
    }
  }
}
