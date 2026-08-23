import { InvalidStateTransitionError } from "./errors.js";
import { type AgentStatus } from "./types.js";

const VALID_TRANSITIONS: Readonly<Record<AgentStatus, readonly AgentStatus[]>> = {
  IDLE: ["INITIALIZING"],
  INITIALIZING: ["THINKING", "FAILED"],
  THINKING: ["TOOL_CALLING", "COMPLETED", "FAILED", "PAUSED"],
  TOOL_CALLING: ["EXECUTING_TOOLS", "FAILED"],
  EXECUTING_TOOLS: ["THINKING", "FAILED"],
  PAUSED: ["THINKING", "COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
};

export interface StateTransitionEvent {
  readonly from: AgentStatus;
  readonly to: AgentStatus;
  readonly timestamp: number;
  readonly reason?: string | undefined;
}

export class AgentStateMachine {
  private _currentStatus: AgentStatus = "IDLE";
  private readonly _history: StateTransitionEvent[] = [];

  public get currentStatus(): AgentStatus {
    return this._currentStatus;
  }

  public get history(): readonly StateTransitionEvent[] {
    return Object.freeze([...this._history]);
  }

  public transition(to: AgentStatus, reason?: string | undefined): void {
    const allowed = VALID_TRANSITIONS[this._currentStatus];
    if (!allowed.includes(to)) {
      throw new InvalidStateTransitionError(this._currentStatus, to);
    }

    const event: StateTransitionEvent = {
      from: this._currentStatus,
      to,
      timestamp: Date.now(),
      reason,
    };

    this._currentStatus = to;
    this._history.push(event);
  }

  public canTransitionTo(to: AgentStatus): boolean {
    return VALID_TRANSITIONS[this._currentStatus].includes(to);
  }

  public isTerminal(): boolean {
    return this._currentStatus === "COMPLETED" || this._currentStatus === "FAILED";
  }

  public reset(): void {
    this._currentStatus = "IDLE";
    this._history.length = 0;
  }
}
