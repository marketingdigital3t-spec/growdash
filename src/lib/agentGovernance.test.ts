import { describe, expect, it } from "vitest";
import { AGENT_OFFICE_ROLES, AGENT_OFFICE_STATES, canAgentApprove, requiresOwnerApproval } from "./agentGovernance";

describe("agent office governance contract", () => {
  it("keeps the five directors and internal specialist roles", () => {
    expect(AGENT_OFFICE_ROLES).toEqual(["ceo", "marketing", "commercial", "finance", "legal", "backend_security", "backend_meta_rd", "frontend", "designer"]);
  });

  it("does not allow an agent to approve its own change", () => {
    expect(canAgentApprove("ceo")).toBe(false);
    expect(canAgentApprove("backend_meta_rd")).toBe(false);
  });

  it("requires owner approval for every change area", () => {
    expect(AGENT_OFFICE_STATES).toContain("awaiting_approval");
    expect(requiresOwnerApproval("frontend")).toBe(true);
    expect(requiresOwnerApproval("backend")).toBe(true);
  });
});
