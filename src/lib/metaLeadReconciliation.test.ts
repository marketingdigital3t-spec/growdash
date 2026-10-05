import { describe, expect, it } from "vitest";
import { resolveAccountMetaLeadReconciliation } from "./metaLeadReconciliation";

describe("Meta lead reconciliation", () => {
  const insight = { ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-04", attribution_window: "account_default" };

  it("ignora pixel de site não configurado e não substitui 7 formulários por alias genérico 13", () => {
    const result = resolveAccountMetaLeadReconciliation("account-1", [insight], [
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "onsite_conversion.lead_grouped", value: 7, attribution_window: "account_default" },
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "lead", value: 13, attribution_window: "account_default" },
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "offsite_conversion.fb_pixel_lead", value: 2, attribution_window: "account_default" },
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "onsite_conversion.messaging_conversation_started_7d", value: 2, attribution_window: "account_default" },
    ], undefined, undefined, true, new Set(["account-1|ad-1"]));

    expect(result).toMatchObject({ forms: 7, site: 0, conversations: 2, total: 9, available: true });
  });

  it("não conta fatos de outra janela de atribuição e diferencia falta de ações de zero confirmado", () => {
    const noMatchingFacts = resolveAccountMetaLeadReconciliation("account-1", [insight], [
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "onsite_conversion.lead_grouped", value: 8, attribution_window: "1d_click" },
    ]);
    expect(noMatchingFacts).toMatchObject({ total: 0, available: false, leadActionFactCount: 0 });

    const confirmedZero = resolveAccountMetaLeadReconciliation("account-1", [insight], [
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "onsite_conversion.lead_grouped", value: 0, attribution_window: "account_default" },
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
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "lead", value: 15, attribution_window: "account_default" },
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "offsite_conversion.fb_pixel_lead", value: 15, attribution_window: "account_default" },
    ]);
    expect(result).toMatchObject({ forms: 0, site: 0, total: 0, available: false, leadActionFactCount: 0 });
  });

  it("não marca como disponível quando o único evento é o lead genérico ignorado", () => {
    const result = resolveAccountMetaLeadReconciliation("account-1", [insight], [
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "lead", value: 15, attribution_window: "account_default" },
    ]);
    expect(result).toMatchObject({ forms: 0, site: 0, conversations: 0, total: 0, available: false, leadActionFactCount: 0 });
  });

  it("não conta pixel residual como lead de site em conjunto não Website", () => {
    const result = resolveAccountMetaLeadReconciliation("account-1", [insight], [
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "offsite_conversion.fb_pixel_lead", value: 15, attribution_window: "account_default" },
    ], "offsite_conversion.fb_pixel_lead", new Set(), true);

    expect(result).toMatchObject({ forms: 0, site: 0, total: 0, available: false });
  });

  it("deixa Leads Meta indisponível se falta classificar destinos com pixel configurado", () => {
    const result = resolveAccountMetaLeadReconciliation("account-1", [insight], [
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "offsite_conversion.fb_pixel_lead", value: 15, attribution_window: "account_default" },
    ], "offsite_conversion.fb_pixel_lead", new Set(), false);

    expect(result).toMatchObject({ total: 0, available: false, reason: "Destino do anúncio sem confirmação; Leads Meta indisponíveis neste recorte." });
  });

  it("mantém a regra global independente para cada conta conectada", () => {
    const otherAccount = { ad_id: "ad-2", ad_account_id: "account-2", date: insight.date, attribution_window: "account_default" };
    const actions = [
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "onsite_conversion.lead_grouped", value: 7, attribution_window: "account_default" },
      { ad_account_id: "account-1", ad_id: "ad-1", date: insight.date, action_type: "lead", value: 13, attribution_window: "account_default" },
      { ad_account_id: "account-2", ad_id: "ad-2", date: insight.date, action_type: "onsite_conversion.messaging_conversation_started_7d", value: 2, attribution_window: "account_default" },
    ];
    const account1 = resolveAccountMetaLeadReconciliation("account-1", [insight, otherAccount], actions, undefined, undefined, true, new Set(["account-1|ad-1"]));
    const account2 = resolveAccountMetaLeadReconciliation("account-2", [insight, otherAccount], actions, undefined, undefined, true, new Set(["account-2|ad-2"]));

    expect(account1.total).toBe(7);
    expect(account2.total).toBe(2);
  });

  it("rejects actions for a different account even when the ad ID and date collide", () => {
    const duplicatedAd = { ...insight, ad_id: "duplicate-ad" };
    const result = resolveAccountMetaLeadReconciliation("account-1", [duplicatedAd], [
      { ad_account_id: "account-2", ad_id: "duplicate-ad", date: insight.date, action_type: "onsite_conversion.lead_grouped", value: 15, attribution_window: "account_default" },
      { ad_account_id: "account-1", ad_id: "duplicate-ad", date: insight.date, action_type: "onsite_conversion.lead_grouped", value: 7, attribution_window: "account_default" },
    ]);
    expect(result.forms).toBe(7);
    expect(result.total).toBe(7);
  });
});
