export type AgentLifePhase = "IDLE" | "MOVER" | "TRABALHAR" | "INTERAGIR";

export type AgentNeedKey = "fome" | "energia" | "social" | "diversao" | "higiene" | "conforto";

export type AgentNeeds = Record<AgentNeedKey, number>;

export type AgentLifeState = {
  phase: AgentLifePhase;
  needs: AgentNeeds;
  phaseStartedAt: number;
};

export const AGENT_NEED_META: Record<AgentNeedKey, { label: string; icon: string; color: string }> = {
  fome: { label: "Fome", icon: "🍽", color: "#f59e0b" },
  energia: { label: "Energia", icon: "⚡", color: "#facc15" },
  social: { label: "Social", icon: "✦", color: "#fb7185" },
  diversao: { label: "Diversão", icon: "◈", color: "#a78bfa" },
  higiene: { label: "Higiene", icon: "◌", color: "#38bdf8" },
  conforto: { label: "Conforto", icon: "⌂", color: "#34d399" },
};

export const DEFAULT_AGENT_NEEDS: AgentNeeds = {
  fome: 82,
  energia: 88,
  social: 74,
  diversao: 68,
  higiene: 91,
  conforto: 79,
};

export function createInitialAgentLifeState(): AgentLifeState {
  return { phase: "TRABALHAR", needs: { ...DEFAULT_AGENT_NEEDS }, phaseStartedAt: 8 * 60 };
}

export function createInitialAgentLifeStates<T extends readonly { id: string }[]>(agents: T): Record<T[number]["id"], AgentLifeState> {
  return Object.fromEntries(agents.map((agent) => [agent.id, createInitialAgentLifeState()])) as Record<T[number]["id"], AgentLifeState>;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

export function resolveAgentPhase(status: "working" | "walking" | "free", needs: AgentNeeds, gameMinutes: number): AgentLifePhase {
  if (status === "walking") return "MOVER";
  if (status === "free" || needs.energia < 18 || needs.higiene < 18) return "IDLE";
  if (status === "working") return Math.floor(gameMinutes / 12) % 2 === 0 ? "TRABALHAR" : "INTERAGIR";
  return "IDLE";
}

export function advanceAgentLifeState(
  state: AgentLifeState,
  status: "working" | "walking" | "free",
  gameMinutes: number,
): AgentLifeState {
  const drain = status === "working"
    ? { fome: -0.18, energia: -0.25, social: -0.08, diversao: -0.1, higiene: -0.08, conforto: -0.03 }
    : status === "walking"
      ? { fome: -0.1, energia: -0.14, social: 0.05, diversao: 0.08, higiene: -0.04, conforto: 0.02 }
      : { fome: -0.04, energia: 0.16, social: 0.14, diversao: 0.12, higiene: 0.05, conforto: 0.1 };
  const needs = Object.fromEntries((Object.keys(DEFAULT_AGENT_NEEDS) as AgentNeedKey[]).map((key) => [key, clamp(state.needs[key] + drain[key])])) as AgentNeeds;
  const phase = resolveAgentPhase(status, needs, gameMinutes);
  return { phase, needs, phaseStartedAt: phase === state.phase ? state.phaseStartedAt : gameMinutes };
}

export function formatAgentClock(totalMinutes: number): string {
  const normalized = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function getAgentPhaseLabel(phase: AgentLifePhase): string {
  return {
    IDLE: "Tempo livre",
    MOVER: "Caminhando",
    TRABALHAR: "Trabalhando",
    INTERAGIR: "Interagindo com o computador",
  }[phase];
}
