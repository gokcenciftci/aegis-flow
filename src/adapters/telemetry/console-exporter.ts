import { type AgentEventEmitter } from "../../telemetry/emitter.js";

export class ConsoleTraceExporter {
  public static attach(emitter: AgentEventEmitter): void {
    emitter.on("start", (data) => {
      console.log(`\x1b[36m[AegisFlow:START]\x1b[0m Agent '${data.agentId}' initialized (Trace: ${data.traceId})`);
    });

    emitter.on("stateChange", (data) => {
      console.log(`\x1b[90m[State]\x1b[0m ${data.from} -> \x1b[33m${data.to}\x1b[0m ${data.reason ? `(${data.reason})` : ""}`);
    });

    emitter.on("thought", (data) => {
      console.log(`\x1b[32m[Thought]\x1b[0m ${data.content}`);
    });

    emitter.on("toolCall", (data) => {
      console.log(`\x1b[35m[Tool:Call]\x1b[0m -> \x1b[1m${data.call.name}\x1b[0m(${JSON.stringify(data.call.arguments)})`);
    });

    emitter.on("toolResult", (data) => {
      const color = data.result.isError ? "\x1b[31m" : "\x1b[34m";
      console.log(`${color}[Tool:Result]\x1b[0m <- ${data.result.toolName} (${data.result.executionTimeMs}ms): ${data.result.content}`);
    });

    emitter.on("retry", (data) => {
      console.log(`\x1b[33m[Resilience:Retry]\x1b[0m Attempt ${data.attempt} backing off for ${data.delayMs}ms. Reason: ${data.error}`);
    });

    emitter.on("circuitBreaker", (data) => {
      console.log(`\x1b[31m[Resilience:CircuitBreaker]\x1b[0m Service '${data.service}' transitioned to \x1b[1m${data.state}\x1b[0m`);
    });

    emitter.on("finish", (data) => {
      console.log(`\x1b[32m\x1b[1m[AegisFlow:FINISH]\x1b[0m Completed in ${data.totalDurationMs}ms | Tokens: ${data.tokenUsage.totalTokens} (Prompt: ${data.tokenUsage.promptTokens}, Comp: ${data.tokenUsage.completionTokens})`);
    });

    emitter.on("error", (data) => {
      console.error(`\x1b[31m\x1b[1m[AegisFlow:ERROR]\x1b[0m ${data.error.message}`);
    });
  }
}
