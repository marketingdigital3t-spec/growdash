import { describe, expect, it } from "vitest";
import { filterRDFunnelsByAccountScope } from "@/lib/rdFunnelScope";

describe("filterRDFunnelsByAccountScope", () => {
  const funnels = [
    { id: "funnel-a", ad_account_id: "account-a" },
    { id: "funnel-b", ad_account_id: "account-b" },
    { id: "funnel-unlinked", ad_account_id: null },
  ];

  it("mantém somente os funis da conta selecionada", () => {
    expect(filterRDFunnelsByAccountScope(funnels, ["account-b"]).map((funnel) => funnel.id)).toEqual(["funnel-b"]);
  });

  it("mantém o funil explicitamente resolvido pela conta mesmo sem ad_account_id local", () => {
    expect(filterRDFunnelsByAccountScope(funnels, ["account-a"], ["funnel-unlinked"]).map((funnel) => funnel.id)).toEqual(["funnel-a", "funnel-unlinked"]);
  });

  it("mantém todos os funis quando não há escopo de conta", () => {
    expect(filterRDFunnelsByAccountScope(funnels).map((funnel) => funnel.id)).toEqual(["funnel-a", "funnel-b", "funnel-unlinked"]);
  });
});
