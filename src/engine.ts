import { Agent } from "./core/agent.js";
import { AegisError, UnknownEngineError } from "./core/errors.js";
import { type Result, ok, err } from "./core/result.js";
import { AgentStateMachine } from "./core/state-machine.js";
import {
  type LLMProvider,
  type Message,
  type TokenUsage,
  type ToolCall,
} from "./core/types.js";
import { MessageHistory } from "./memory/message-history.js";
import { SlidingContextWindow } from "./memory/sliding-window.js";
import { BudgetGuard } from "./resilience/budget.js";
import { CircuitBreaker } from "./resilience/circuit-breaker.js";
import { TokenBucketRateLimiter } from "./resilience/rate-limiter.js";
import { RetryPolicy } from "./resilience/retry.js";
import { AgentEventEmitter } from "./telemetry/emitter.js";
import { MetricsCollector } from "./telemetry/metrics.js";
import { Tracer } from "./telemetry/tracer.js";
import { ToolRegistry } from "./tools/registry.js";
import { ToolSandbox } from "./tools/sandbox.js";

export interface EngineOptions {
  readonly agent: Agent;
  readonly provider: LLMProvider;
  readonly toolRegistry?: ToolRegistry | undefined;
  readonly traceId?: string | undefined;
}

export interface AgentExecutionOutput {
  readonly output: string;
  readonly tokenUsage: TokenUsage;
  readonly steps: number;
  readonly history: readonly Message[];
  readonly traceId: string;
  readonly durationMs: number;
}

export class AegisFlowEngine {
  public readonly agent: Agent;
  public readonly provider: LLMProvider;
  public readonly tools: ToolRegistry;
  public readonly events: AgentEventEmitter;
  public readonly tracer: Tracer;
  public readonly metrics: MetricsCollector;

  private readonly _stateMachine: AgentStateMachine;
  private readonly _sandbox: ToolSandbox;
  private readonly _contextWindow: SlidingContextWindow;
  private readonly _circuitBreaker: CircuitBreaker;
  private readonly _rateLimiter: TokenBucketRateLimiter;
  private readonly _retryPolicy: RetryPolicy;

  constructor(options: EngineOptions) {
    this.agent = options.agent;
    this.provider = options.provider;
    this.tools = options.toolRegistry ?? new ToolRegistry();
    this.events = new AgentEventEmitter();
    this.tracer = new Tracer(options.traceId);
    this.metrics = new MetricsCollector();

    this._stateMachine = new AgentStateMachine();
    this._sandbox = new ToolSandbox(this.tools);
    this._contextWindow = new SlidingContextWindow({
      maxTokens: this.agent.budget.maxTokens,
    });
    this._circuitBreaker = new CircuitBreaker({
      failureThreshold: this.agent.resilience.failureThreshold,
      recoveryTimeoutMs: this.agent.resilience.recoveryTimeoutMs,
      serviceName: this.provider.providerName,
    });
    this._rateLimiter = new TokenBucketRateLimiter({
      capacity: 10,
      refillRatePerMinute: this.agent.resilience.rateLimitPerMinute,
      serviceName: this.provider.providerName,
    });
    this._retryPolicy = new RetryPolicy({
      maxRetries: this.agent.resilience.maxRetries,
      initialDelayMs: this.agent.resilience.initialDelayMs,
      maxDelayMs: this.agent.resilience.maxDelayMs,
    });
  }

  public async run(
    userInput: string,
    options?: { signal?: AbortSignal | undefined } | undefined
  ): Promise<Result<AgentExecutionOutput, AegisError>> {
    const startTime = Date.now();
    const budgetGuard = new BudgetGuard(this.agent.budget, startTime);
    const history = new MessageHistory([
      { role: "system", content: this.agent.systemPrompt },
      { role: "user", content: userInput },
    ]);

    this._stateMachine.reset();
    this._stateMachine.transition("INITIALIZING", "Engine execution initiated");
    this.events.emit("start", {
      agentId: this.agent.id,
      traceId: this.tracer.traceId,
      timestamp: startTime,
    });

    try {
      this._stateMachine.transition("THINKING", "Entering agent loop");
      let finalContent = "";

      while (true) {
        if (options?.signal?.aborted) {
          throw new Error("Execution cancelled by caller");
        }

        budgetGuard.checkBudget(this.tracer.traceId);
        budgetGuard.recordStep();

        const stepSpan = this.tracer.startSpan(`step_${budgetGuard.stepCount}`, {
          step: budgetGuard.stepCount,
        });

        await this._rateLimiter.acquire(1);

        const fittedMessages = this._contextWindow.fit(history.messages);
        const toolContracts = this.tools.toContracts(this.agent.allowedTools);

        const completion = await this._circuitBreaker.execute(async () => {
          return await this._retryPolicy.execute(
            async () => {
              return await this.provider.generateCompletion(fittedMessages, toolContracts, {
                signal: options?.signal,
                traceId: this.tracer.traceId,
              });
            },
            {
              signal: options?.signal,
              onRetry: (attempt, delayMs, error) => {
                this.events.emit("retry", {
                  attempt,
                  delayMs,
                  error: error instanceof Error ? error.message : String(error),
                  timestamp: Date.now(),
                });
              },
            }
          );
        });

        budgetGuard.recordUsage({
          promptTokens: completion.usage.promptTokens,
          completionTokens: completion.usage.completionTokens,
        });
        budgetGuard.checkBudget(this.tracer.traceId);

        this.metrics.recordTokens(completion.usage.promptTokens, completion.usage.completionTokens);
        this.metrics.recordStepSuccess();
        this.tracer.endSpan(stepSpan.id, "OK");

        if (completion.content) {
          finalContent = completion.content;
          this.events.emit("thought", {
            content: completion.content,
            timestamp: Date.now(),
          });
        }

        const toolCalls: readonly ToolCall[] = completion.toolCalls ?? [];

        if (toolCalls.length === 0) {

          history.append({ role: "assistant", content: completion.content });
          this._stateMachine.transition("COMPLETED", "Agent finished task without pending tools");
          break;
        }

        this._stateMachine.transition("TOOL_CALLING", `Invoking ${toolCalls.length} tool(s)`);
        history.append({
          role: "assistant",
          content: completion.content,
          toolCalls: toolCalls,
        });

        for (const call of toolCalls) {
          this.events.emit("toolCall", { call, timestamp: Date.now() });
        }

        this._stateMachine.transition("EXECUTING_TOOLS", "Executing tool batch in sandbox");
        const toolResults = await this._sandbox.executeBatch(toolCalls, {
          traceId: this.tracer.traceId,
          agentId: this.agent.id,
          signal: options?.signal,
        });

        for (const res of toolResults) {
          this.events.emit("toolResult", { result: res, timestamp: Date.now() });
          history.append({
            role: "tool",
            toolCallId: res.toolCallId,
            toolName: res.toolName,
            content: res.content,
            isError: res.isError,
          });
        }

        this._stateMachine.transition("THINKING", "Resuming agent loop with tool results");
      }

      const totalDurationMs = Date.now() - startTime;
      const output: AgentExecutionOutput = {
        output: finalContent,
        tokenUsage: budgetGuard.tokenUsage,
        steps: budgetGuard.stepCount,
        history: history.messages,
        traceId: this.tracer.traceId,
        durationMs: totalDurationMs,
      };

      this.events.emit("finish", {
        result: finalContent,
        tokenUsage: budgetGuard.tokenUsage,
        totalDurationMs,
      });

      return ok(output);
    } catch (error) {
      if (this._stateMachine.canTransitionTo("FAILED")) {
        this._stateMachine.transition("FAILED", error instanceof Error ? error.message : String(error));
      }
      this.metrics.recordStepFailure();

      const domainError: AegisError = error instanceof AegisError
        ? error
        : new UnknownEngineError(error instanceof Error ? error.message : String(error), {
            traceId: this.tracer.traceId,
            cause: error,
          });

      this.events.emit("error", {
        error: domainError,
        traceId: this.tracer.traceId,
        timestamp: Date.now(),
      });

      return err(domainError);
    }
  }
}
