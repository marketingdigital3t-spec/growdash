export const AGENT_OFFICE_ROLES = ["ceo", "marketing", "commercial", "finance", "legal", "backend_security", "backend_meta_rd", "frontend", "designer"] as const;
export type AgentOfficeRole = typeof AGENT_OFFICE_ROLES[number];

export type AgentDepartment = AgentOfficeRole;
export type AgentRuntimeStatus = "working" | "analyzing" | "waiting_approval" | "paused" | "blocked" | "error" | "idle";
export type AgentTaskStatus = "queued" | "running" | "completed" | "waiting_approval" | "blocked" | "failed" | "cancelled";

export type AgentOfficeMessage = {
  id: string;
  workspaceId: string;
  agentId: string;
  conversationId: string;
  role: "user" | "agent" | "system";
  content: string;
  sources: Array<{ type: "meta" | "rd" | "sales" | "finance" | "workspace" | "task"; reference: string; label: string }>;
  scope: { accountIds: string[]; funnelIds: string[]; startDate: string | null; endDate: string | null };
  createdAt: string;
};

export const AGENT_OFFICE_STATES = ["detected", "investigating", "patch_ready", "tests_passed", "awaiting_approval", "deployed", "rejected", "blocked", "rolled_back"] as const;
export type AgentOfficeState = typeof AGENT_OFFICE_STATES[number];

export function canAgentApprove(role: AgentOfficeRole) {
  void role;
  return false;
}

export function requiresOwnerApproval(changeArea: "frontend" | "backend" | "database" | "security" | "design") {
  return changeArea === "frontend" || changeArea === "backend" || changeArea === "database" || changeArea === "security" || changeArea === "design";
}
