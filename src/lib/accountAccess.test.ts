import { describe, expect, it } from "vitest";
import { filterAuthorizedAdAccounts, type AdAccountAccessContext } from "./accountAccess";

const account = (overrides: Partial<Parameters<typeof filterAuthorizedAdAccounts>[0][number]> = {}) => ({
  id: "account-1",
  user_id: "owner-1",
  workspace_id: "workspace-1",
  metadata: {},
  ...overrides,
});

const context = (overrides: Partial<AdAccountAccessContext> = {}): AdAccountAccessContext => ({
  userId: "delegated-1",
  master: false,
  managerWorkspaceIds: new Set(),
  accountAccess: new Set(),
  ...overrides,
});

describe("Meta account authorization contract", () => {
  it("allows an explicitly assigned delegated user and rejects an unassigned member", () => {
    const selected = filterAuthorizedAdAccounts([account()], context({ accountAccess: new Set(["delegated-1:account-1:workspace-1"]) }));
    expect(selected.map((item) => item.id)).toEqual(["account-1"]);
    expect(filterAuthorizedAdAccounts([account()], context())).toEqual([]);
  });

  it("allows the owner, workspace manager and master", () => {
    expect(filterAuthorizedAdAccounts([account()], context({ userId: "owner-1" }))).toHaveLength(1);
    expect(filterAuthorizedAdAccounts([account()], context({ managerWorkspaceIds: new Set(["workspace-1"]) }))).toHaveLength(1);
    expect(filterAuthorizedAdAccounts([account()], context({ master: true }))).toHaveLength(1);
  });

  it("rejects disconnected profiles even when the user would otherwise be authorized", () => {
    expect(filterAuthorizedAdAccounts([account({ metadata: { profile_disconnected: true } })], context({ master: true }))).toEqual([]);
  });

  it("supports legacy accounts without a workspace only with explicit matching access", () => {
    const legacy = account({ workspace_id: null });
    expect(filterAuthorizedAdAccounts([legacy], context({ accountAccess: new Set(["delegated-1:account-1:null"]) }))).toHaveLength(1);
    expect(filterAuthorizedAdAccounts([legacy], context({ accountAccess: new Set(["delegated-1:other:null"]) }))).toEqual([]);
  });
});
