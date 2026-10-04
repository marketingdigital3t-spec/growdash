import { describe, expect, it } from "vitest";
import { NO_LINKED_RD_FUNNEL_SCOPE_ID, resolveLinkedRDFunnelIds } from "./rdAccountScope";

const accounts = [
  { id: "meta-ca02", account_id: "act_1064564169282353" },
  { id: "meta-sté", account_id: "1967639360601456" },
];
const connections = [
  { id: "rd-ca02", external_account_id: "act_1064564169282353" },
  { id: "rd-sté", external_account_id: "act_1967639360601456" },
];
const funnels = [
  { id: "ranniely-aluna", rd_connection_id: "rd-ca02", rd_funnel_id: "f-1", is_active: true },
  { id: "ranniely-paciente", rd_connection_id: "rd-ca02", rd_funnel_id: "f-2", is_active: true },
  { id: "ste-aluna", rd_connection_id: "rd-sté", rd_funnel_id: "f-3", is_active: true },
  { id: "inactive", rd_connection_id: "rd-ca02", rd_funnel_id: "f-4", is_active: false },
  { id: "without-provider-id", rd_connection_id: "rd-ca02", rd_funnel_id: null, is_active: true },
];

describe("resolveLinkedRDFunnelIds", () => {
  it("uses RD connection external account IDs to scope linked funnels", () => {
    expect(resolveLinkedRDFunnelIds(["meta-ca02"], accounts, connections, funnels)).toEqual([
      "ranniely-aluna",
      "ranniely-paciente",
    ]);
  });

  it("keeps a selected account with no RD link empty instead of widening to every funnel", () => {
    expect(resolveLinkedRDFunnelIds(["missing"], accounts, connections, funnels)).toEqual([NO_LINKED_RD_FUNNEL_SCOPE_ID]);
  });

  it("does not widen a multi-account request when one selected account cannot be resolved", () => {
    expect(resolveLinkedRDFunnelIds(["meta-ca02", "missing"], accounts, connections, funnels)).toEqual([NO_LINKED_RD_FUNNEL_SCOPE_ID]);
  });

  it("supports legacy direct internal-account links", () => {
    expect(resolveLinkedRDFunnelIds(["meta-ca02"], accounts, [], [
      { id: "legacy", ad_account_id: "meta-ca02", rd_funnel_id: "f-legacy", is_active: true },
    ])).toEqual(["legacy"]);
  });

  it("returns all active provider-backed funnels only when all Meta accounts are selected", () => {
    expect(resolveLinkedRDFunnelIds([], accounts, connections, funnels)).toEqual([
      "ranniely-aluna",
      "ranniely-paciente",
      "ste-aluna",
    ]);
  });
});
