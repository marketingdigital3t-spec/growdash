import { describe, expect, it } from "vitest";
import { advanceAgentLifeState, createInitialAgentLifeState, formatAgentClock, getAgentPhaseLabel } from "./agentLife";

describe("Growdash Life agent simulation", () => {
  it("alterna entre trabalho e interação mantendo o estado legível", () => {
    const initial = createInitialAgentLifeState();
    expect(advanceAgentLifeState(initial, "working", 500).phase).toBe("INTERAGIR");
    expect(advanceAgentLifeState(initial, "working", 504).phase).toBe("TRABALHAR");
    expect(getAgentPhaseLabel("INTERAGIR")).toContain("computador");
  });

  it("faz o NPC andar ou descansar conforme o comando", () => {
    const initial = createInitialAgentLifeState();
    expect(advanceAgentLifeState(initial, "walking", 520).phase).toBe("MOVER");
    expect(advanceAgentLifeState(initial, "free", 520).phase).toBe("IDLE");
  });

  it("drena necessidades sem ultrapassar os limites do HUD", () => {
    const initial = createInitialAgentLifeState();
    const state = Array.from({ length: 700 }, (_, index) => index).reduce((current, minute) => advanceAgentLifeState(current, "working", minute), initial);
    expect(Object.values(state.needs).every((value) => value >= 0 && value <= 100)).toBe(true);
    expect(formatAgentClock(24 * 60 + 5)).toBe("00:05");
  });
});
