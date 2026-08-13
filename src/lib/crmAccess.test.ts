import { describe, expect, it } from "vitest";
import { crmEmptyState, crmPipelineEnabled } from "./crmAccess";

describe("CRM access", () => {
  it("allows an authenticated member to read an RLS-authorized shared funnel without a personal token", () => {
    expect(crmPipelineEnabled(true)).toBe(true);
  });

  it("explains the real empty states without claiming data is missing", () => {
    expect(crmEmptyState({ hasFunnels: true, hasOwnIntegration: false })).toMatch(/atualize o RD/i);
    expect(crmEmptyState({ hasFunnels: false, hasOwnIntegration: true })).toMatch(/Vincule um funil/i);
  });
});
