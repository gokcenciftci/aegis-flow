import { describe, it, expect, vi } from "vitest";
import { ConsoleTraceExporter } from "../../src/adapters/telemetry/console-exporter.js";
import { AgentEventEmitter } from "../../src/telemetry/emitter.js";
import { MetricsCollector, calculatePercentile, computeHistogram } from "../../src/telemetry/metrics.js";
import { Tracer } from "../../src/telemetry/tracer.js";

describe("Telemetry & Observability", () => {
  describe("Tracer", () => {
    it("should start and end spans with duration", () => {
      const tracer = new Tracer("custom_trace");
      expect(tracer.traceId).toBe("custom_trace");

      const span = tracer.startSpan("db_query", { table: "users" });
      expect(span.name).toBe("db_query");
      expect(span.status).toBe("IN_PROGRESS");
      expect(tracer.spans.length).toBe(1);

      tracer.endSpan(span.id, "OK");
      expect(span.status).toBe("OK");
      expect(span.durationMs).toBeDefined();
    });

    it("should execute withSpan wrapper and handle errors", async () => {
      const tracer = new Tracer();
      const res = await tracer.withSpan("compute", async (s) => {
        expect(s.name).toBe("compute");
        return 42;
      });
      expect(res).toBe(42);

      await expect(
        tracer.withSpan("failing_op", async () => {
          throw new Error("Span failed");
        })
      ).rejects.toThrow("Span failed");
    });
  });

  describe("Metrics & Histograms", () => {
    it("should compute percentiles and histograms correctly", () => {
      const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const p50 = calculatePercentile(samples, 50);
      const p99 = calculatePercentile(samples, 99);

      expect(p50).toBe(50);
      expect(p99).toBe(100);

      const hist = computeHistogram(samples);
      expect(hist.count).toBe(10);
      expect(hist.min).toBe(10);
      expect(hist.max).toBe(100);
      expect(hist.mean).toBe(55);
    });

    it("should aggregate collector metrics", () => {
      const collector = new MetricsCollector();
      collector.recordStepLatency(15);
      collector.recordStepLatency(25);
      collector.recordStepSuccess();
      collector.recordStepFailure();
      collector.recordTokens(100, 50);

      const summary = collector.getSummary();
      expect(summary.totalSteps).toBe(2);
      expect(summary.successRate).toBe(50);
      expect(summary.totalTokens).toBe(150);
      expect(summary.promptTokens).toBe(100);
      expect(summary.completionTokens).toBe(50);
    });
  });

  describe("AgentEventEmitter & ConsoleTraceExporter", () => {
    it("should attach listeners, emit events, and unsubscribe cleanly", () => {
      const emitter = new AgentEventEmitter();
      const fn = vi.fn();

      const unsubscribe = emitter.on("thought", fn);
      emitter.emit("thought", { content: "Thinking...", timestamp: Date.now() });

      expect(fn).toHaveBeenCalledTimes(1);

      unsubscribe();
      emitter.emit("thought", { content: "Second thought", timestamp: Date.now() });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should attach ConsoleTraceExporter and handle console logs without errors", () => {
      const emitter = new AgentEventEmitter();
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      ConsoleTraceExporter.attach(emitter);

      emitter.emit("start", { agentId: "a1", traceId: "t1", timestamp: Date.now() });
      emitter.emit("stateChange", { from: "IDLE", to: "THINKING", reason: "Init", timestamp: Date.now() });
      emitter.emit("thought", { content: "Thinking", timestamp: Date.now() });
      emitter.emit("toolCall", { call: { id: "c1", name: "tool", arguments: {} }, timestamp: Date.now() });
      emitter.emit("toolResult", { result: { toolCallId: "c1", toolName: "tool", content: "ok", isError: false, executionTimeMs: 5 }, timestamp: Date.now() });
      emitter.emit("retry", { attempt: 1, delayMs: 10, error: "err", timestamp: Date.now() });
      emitter.emit("circuitBreaker", { service: "openai", state: "OPEN", timestamp: Date.now() });
      emitter.emit("finish", { result: "Done", tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, estimatedCostUsd: 0.01 }, totalDurationMs: 50 });
      emitter.emit("error", { error: new Error("Test error"), traceId: "t1", timestamp: Date.now() });

      expect(logSpy).toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalled();

      logSpy.mockRestore();
      errSpy.mockRestore();
    });
  });
});
