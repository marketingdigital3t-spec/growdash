import { describe, expect, it } from "vitest";
import { resolveAccountMetaLeadReconciliation } from "./metaLeadReconciliation";

describe("Meta lead reconciliation", () => {
  const insight = { ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-04", attribution_window: "account_default" };

  it("ignora pixel de site não configurado e não substitui 7 formulários por alias genérico 13", () => {
    const result = resolveAccountMetaLeadReconciliation("account-1", [insight], [
      { ad_id: "ad-1", date: insight.date, action_type: "onsite_conversion.lead_grouped", value: 7, attribution_window: "account_default" },
      { ad_id: "ad-1", date: insight.date, action_type: "lead", value: 13, attribution_window: "account_default" },
      { ad_id: "ad-1", date: insight.date, action_type: "offsite_conversion.fb_pixel_lead", value: 2, attribution_window: "account_default" },
      { ad_id: "ad-1", date: insight.date, action_type: "onsite_conversion.messaging_conversation_started_7d", value: 2, attribution_window: "account_default" },
    ]);

    expect(result).toMatchObject({ forms: 7, site: 0, conversations: 2, total: 9, available: true });
  });

  it("não conta fatos de outra janela de atribuição e diferencia falta de ações de zero confirmado", () => {
    const noMatchingFacts = resolveAccountMetaLeadReconciliation("account-1", [insight], [
      { ad_id: "ad-1", date: insight.date, action_type: "onsite_conversion.lead_grouped", value: 8, attribution_window: "1d_click" },
    ]);
    expect(noMatchingFacts).toMatchObject({ total: 0, available: false, leadActionFactCount: 0 });

    const confirmedZero = resolveAccountMetaLeadReconciliation("account-1", [insight], [
      { ad_id: "ad-1", date: insight.date, action_type: "onsite_conversion.lead_grouped", value: 0, attribution_window: "account_default" },
    ]);
    expect(confirmedZero).toMatchObject({ forms: 0, total: 0, available: true });
  });

  it("não transforma ausência de Insights em zero confirmado", () => {
    expect(resolveAccountMetaLeadReconciliation("account-1", [], [])).toMatchObject({
      total: 0,
      available: false,
      reason: "Nenhum snapshot de Insights neste período.",
    });
  });

  it("não considera lead ambíguo confirmado quando só há pixel de site não configurado", () => {
    const result = resolveAccountMetaLeadReconciliation("account-1", [insight], [
      { ad_id: "ad-1", date: insight.date, action_type: "lead", value: 15, attribution_window: "account_default" },
      { ad_id: "ad-1", date: insight.date, action_type: "offsite_conversion.fb_pixel_lead", value: 15, attribution_window: "account_default" },
    ]);
    expect(result).toMatchObject({ forms: 0, site: 0, total: 0, available: false, leadActionFactCount: 0 });
  });

  it("mantém a regra global independente para cada conta conectada", () => {
    const otherAccount = { ad_id: "ad-2", ad_account_id: "account-2", date: insight.date, attribution_window: "account_default" };
    const actions = [
      { ad_id: "ad-1", date: insight.date, action_type: "onsite_conversion.lead_grouped", value: 7, attribution_window: "account_default" },
      { ad_id: "ad-1", date: insight.date, action_type: "lead", value: 13, attribution_window: "account_default" },
      { ad_id: "ad-2", date: insight.date, action_type: "onsite_conversion.messaging_conversation_started_7d", value: 2, attribution_window: "account_default" },
    ];
    const account1 = resolveAccountMetaLeadReconciliation("account-1", [insight, otherAccount], actions);
    const account2 = resolveAccountMetaLeadReconciliation("account-2", [insight, otherAccount], actions);

    expect(account1.total).toBe(7);
    expect(account2.total).toBe(2);
  });
});
