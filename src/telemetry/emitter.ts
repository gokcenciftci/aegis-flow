import { type AgentStatus, type ToolCall, type ToolResult, type TokenUsage } from "../core/types.js";
import { type CircuitState } from "../resilience/circuit-breaker.js";

export type AgentEventMap = {
  start: { agentId: string; traceId: string; timestamp: number };
  stateChange: { from: AgentStatus; to: AgentStatus; reason?: string; timestamp: number };
  thought: { content: string; timestamp: number };
  toolCall: { call: ToolCall; timestamp: number };
  toolResult: { result: ToolResult; timestamp: number };
  retry: { attempt: number; delayMs: number; error: string; timestamp: number };
  circuitBreaker: { service: string; state: CircuitState; timestamp: number };
  finish: { result: string; tokenUsage: TokenUsage; totalDurationMs: number };
  error: { error: Error; traceId?: string; timestamp: number };
};

export type EventListener<K extends keyof AgentEventMap> = (payload: AgentEventMap[K]) => void | Promise<void>;

export class AgentEventEmitter {
  private readonly _listeners: Map<keyof AgentEventMap, Set<EventListener<any>>> = new Map();

  public on<K extends keyof AgentEventMap>(event: K, listener: EventListener<K>): () => void {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(listener);

    return () => {
      set?.delete(listener);
    };
  }

  public emit<K extends keyof AgentEventMap>(event: K, payload: AgentEventMap[K]): void {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return;

    for (const listener of set) {
      try {
        void listener(payload);
      } catch (err) {
        console.error(`[AgentEventEmitter] Listener error on event '${event}':`, err);
      }
    }
  }

  public removeAllListeners(): void {
    this._listeners.clear();
  }
}
