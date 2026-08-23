import { describe, it, expect } from "vitest";
import { InvalidStateTransitionError } from "../../src/core/errors.js";
import { AgentStateMachine } from "../../src/core/state-machine.js";

describe("AgentStateMachine", () => {
  it("should initialize with IDLE state", () => {
    const sm = new AgentStateMachine();
    expect(sm.currentStatus).toBe("IDLE");
    expect(sm.isTerminal()).toBe(false);
  });

  it("should transition through valid sequence", () => {
    const sm = new AgentStateMachine();
    sm.transition("INITIALIZING", "Starting");
    expect(sm.currentStatus).toBe("INITIALIZING");

    sm.transition("THINKING", "Loop begin");
    expect(sm.currentStatus).toBe("THINKING");

    sm.transition("TOOL_CALLING", "Calling tools");
    expect(sm.currentStatus).toBe("TOOL_CALLING");

    sm.transition("EXECUTING_TOOLS", "Running tools");
    expect(sm.currentStatus).toBe("EXECUTING_TOOLS");

    sm.transition("THINKING", "Tool results back");
    expect(sm.currentStatus).toBe("THINKING");

    sm.transition("COMPLETED", "Task done");
    expect(sm.currentStatus).toBe("COMPLETED");
    expect(sm.isTerminal()).toBe(true);
  });

  it("should throw InvalidStateTransitionError on illegal transition", () => {
    const sm = new AgentStateMachine();
    expect(() => sm.transition("EXECUTING_TOOLS")).toThrow(InvalidStateTransitionError);
  });

  it("should record transition history faithfully", () => {
    const sm = new AgentStateMachine();
    sm.transition("INITIALIZING", "Step 1");
    sm.transition("FAILED", "Something crashed");

    expect(sm.history.length).toBe(2);
    expect(sm.history[0]?.from).toBe("IDLE");
    expect(sm.history[0]?.to).toBe("INITIALIZING");
    expect(sm.history[1]?.to).toBe("FAILED");
    expect(sm.history[1]?.reason).toBe("Something crashed");
  });
});
