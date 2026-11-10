import { describe, expect, it } from "vitest";
import { firstAllowedPath, type usePermissions } from "./usePermissions";

type PermissionsResult = ReturnType<typeof usePermissions>;

const mockPermissions = (overrides: Partial<PermissionsResult> = {}): PermissionsResult => ({
  loading: false,
  error: false,
  retry: async () => {},
  isMaster: false,
  workspaceRole: "member",
  accessRole: "viewer",
  configuredAccessRole: "viewer",
  canAdmin: false,
  canEdit: false,
  canDashboard: false,
  canCrm: false,
  canCommercial: false,
  canCampaigns: false,
  canFunnels: false,
  canFlow: false,
  canSocialMedia: false,
  canClasses: false,
  canManageClasses: false,
  canLeads: false,
  canKanban: false,
  canTickets: false,
  canAlerts: false,
  canAutomations: false,
  canFinance: false,
  canStorage: false,
  canBrands: false,
  canProducts: false,
  canIntegrations: false,
  canMetaConnect: false,
  canAnnouncements: false,
  canUsers: false,
  canAgents: false,
  canSettings: false,
  canDataHealth: false,
  canExpertDashboard: false,
  allowedAdAccounts: [],
  allowedRDFunnels: [],
  ...overrides,
});

describe("firstAllowedPath contract for co-users", () => {
  it("redirects to dashboard (/) when canDashboard is true", () => {
    expect(firstAllowedPath(mockPermissions({ canDashboard: true }))).toBe("/");
  });

  it("redirects to /analise-de-funis when co-user has only funnel permission", () => {
    const perms = mockPermissions({ canFunnels: true });
    expect(firstAllowedPath(perms)).toBe("/analise-de-funis");
  });

  it("redirects to /campanhas when co-user has only campaigns permission", () => {
    const perms = mockPermissions({ canCampaigns: true });
    expect(firstAllowedPath(perms)).toBe("/campanhas");
  });

  it("redirects to /crm when co-user has only CRM permission", () => {
    const perms = mockPermissions({ canCrm: true });
    expect(firstAllowedPath(perms)).toBe("/crm");
  });

  it("redirects to /financeiro when co-user has only finance permission", () => {
    const perms = mockPermissions({ canFinance: true });
    expect(firstAllowedPath(perms)).toBe("/financeiro");
  });

  it("redirects to /painel-expert when co-user has only expert dashboard permission", () => {
    const perms = mockPermissions({ canExpertDashboard: true });
    expect(firstAllowedPath(perms)).toBe("/painel-expert");
  });

  it("redirects to /auth when co-user has no permissions configured", () => {
    const perms = mockPermissions();
    expect(firstAllowedPath(perms)).toBe("/auth");
  });
});
