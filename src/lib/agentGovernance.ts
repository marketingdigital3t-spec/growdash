export const AGENT_OFFICE_ROLES = ["ceo", "backend_security", "backend_meta_rd", "frontend", "designer"] as const;
export type AgentOfficeRole = typeof AGENT_OFFICE_ROLES[number];

export const AGENT_OFFICE_STATES = ["detected", "investigating", "patch_ready", "tests_passed", "awaiting_approval", "deployed", "rejected", "blocked", "rolled_back"] as const;
export type AgentOfficeState = typeof AGENT_OFFICE_STATES[number];

export function canAgentApprove(role: AgentOfficeRole) {
  void role;
  return false;
}

export function requiresOwnerApproval(changeArea: "frontend" | "backend" | "database" | "security" | "design") {
  return changeArea === "frontend" || changeArea === "backend" || changeArea === "database" || changeArea === "security" || changeArea === "design";
}
