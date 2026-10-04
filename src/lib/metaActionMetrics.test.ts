import { describe, expect, it } from "vitest";
import { aggregateMetaLeadActionDays, aggregateMetaLeadTargets, resolveMetaActionMetrics, resolveMetaCampaignResult, resolveMetaLeadActions } from "./metaActionMetrics";
import { canonicalMetaLeads } from "../../supabase/functions/_shared/metaLeadMetrics";

describe("Meta action metrics", () => {
  it("prioriza a ação omni para não duplicar checkout e compra", () => {
    const metrics = resolveMetaActionMetrics({
      omni_initiated_checkout: 8,
      "offsite_conversion.fb_pixel_initiate_checkout": 8,
      omni_purchase: 3,
      "offsite_conversion.fb_pixel_purchase": 3,
      landing_page_view: 21,
      link_click: 34,
    }, {
      omni_purchase: 897,
      "offsite_conversion.fb_pixel_purchase": 897,
    });

    expect(metrics).toEqual({
      linkClicks: 34,
      landingPageViews: 21,
      checkouts: 8,
      purchases: 3,
      purchaseValue: 897,
    });
  });

  it("usa o evento de pixel quando o evento omni não existe", () => {
    const metrics = resolveMetaActionMetrics({
      "offsite_conversion.fb_pixel_initiate_checkout": 4,
      "offsite_conversion.fb_pixel_purchase": 2,
    }, {
      "offsite_conversion.fb_pixel_purchase": 500,
    });

    expect(metrics.checkouts).toBe(4);
    expect(metrics.purchases).toBe(2);
    expect(metrics.purchaseValue).toBe(500);
  });

  it("prioriza lead_grouped sobre aliases agregados e não soma eventos duplicados", () => {
    expect(resolveMetaLeadActions({
      "onsite_conversion.lead_grouped": 3,
      lead: 5,
      omni_lead: 5,
      "onsite_conversion.messaging_conversation_started_7d": 7,
      "onsite_conversion.messaging_conversation_started": 11,
      "onsite_conversion.total_messaging_connection": 11,
    })).toEqual({ forms: 3, site: 0, conversations: 7, total: 10 });
  });

  it("usa o alias genérico lead apenas quando nenhum alias canônico está disponível", () => {
    expect(resolveMetaLeadActions({ lead: 5 }))
      .toEqual({ forms: 5, site: 0, conversations: 0, total: 5 });
  });

  it("mantém o zero explícito do evento canônico em vez de usar alias inflado", () => {
    expect(resolveMetaLeadActions({
      "onsite_conversion.lead_grouped": 0,
      "onsite_conversion.lead": 13,
      omni_lead: 13,
    })).toEqual({ forms: 0, site: 0, conversations: 0, total: 0 });
  });

  it("prefere leadgen_grouped a variantes não agrupadas", () => {
    expect(resolveMetaLeadActions({
      leadgen_grouped: 7,
      "onsite_conversion.lead": 13,
      omni_lead: 15,
    })).toEqual({ forms: 7, site: 0, conversations: 0, total: 7 });
  });

  it("reproduz a divergência observada: 13 genéricos não substituem 7 formulários", () => {
    const actions = {
      "onsite_conversion.lead_grouped": 7,
      lead: 13,
      "offsite_conversion.fb_pixel_lead": 6,
      "onsite_conversion.messaging_conversation_started_7d": 1,
      "onsite_conversion.total_messaging_connection": 1,
    };
    expect(resolveMetaLeadActions(actions)).toEqual({ forms: 7, site: 6, conversations: 1, total: 14 });
    expect(canonicalMetaLeads([
      { ad_id: "ad-1", ad_account_id: "ca01", date: "2026-10-04", leads: 0 },
    ], Object.entries(actions).map(([action_type, value]) => ({
      ad_id: "ad-1", date: "2026-10-04", action_type, value,
    })), {}).at(0)).toMatchObject({ form_leads: 7, site_leads: 6, conversations: 1, leads: 14 });
  });

  it("resolve aliases por anúncio antes do total global entre contas", () => {
    const rows = canonicalMetaLeads([
      { ad_id: "ad-1", ad_account_id: "ca01", date: "2026-10-04", leads: 0 },
      { ad_id: "ad-2", ad_account_id: "ca02", date: "2026-10-04", leads: 0 },
    ], [
      { ad_id: "ad-1", date: "2026-10-04", action_type: "onsite_conversion.lead_grouped", value: 7 },
      { ad_id: "ad-1", date: "2026-10-04", action_type: "lead", value: 13 },
      { ad_id: "ad-2", date: "2026-10-04", action_type: "leadgen_grouped", value: 2 },
      { ad_id: "ad-2", date: "2026-10-04", action_type: "lead", value: 5 },
    ], {});

    expect(rows.map((row) => row.form_leads)).toEqual([7, 2]);
    expect(rows.reduce((sum, row) => sum + row.leads, 0)).toBe(9);
  });

  it("não trata lead auxiliar de campanha de mensagem como formulário", () => {
    expect(resolveMetaLeadActions({ lead: 9, "onsite_conversion.messaging_conversation_started_7d": 3 }))
      .toEqual({ forms: 0, site: 0, conversations: 3, total: 3 });
  });

  it("usa o evento legado de conexão como fallback de conversa", () => {
    expect(resolveMetaLeadActions({ "onsite_conversion.total_messaging_connection": 16 }))
      .toEqual({ forms: 0, site: 0, conversations: 16, total: 16 });
  });

  it("reconhece variantes de action_type sem somar aliases equivalentes", () => {
    expect(resolveMetaLeadActions({
      "leadgen.other": 4,
      "onsite_conversion.lead": 4,
      "onsite_conversion.messaging_conversation_started_7d_click": 2,
      "messaging_conversation_started_7d": 2,
    })).toEqual({ forms: 4, site: 0, conversations: 2, total: 6 });
  });

  it("mantém a mesma regra de formulário, site e conversa no snapshot usado por MCP e IA", () => {
    const canonical = canonicalMetaLeads([
      { ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-04", leads: 0 },
    ], [
      { ad_id: "ad-1", date: "2026-10-04", action_type: "leadgen.other", value: 3 },
      { ad_id: "ad-1", date: "2026-10-04", action_type: "onsite_conversion.lead", value: 3 },
      { ad_id: "ad-1", date: "2026-10-04", action_type: "offsite_conversion.fb_pixel_lead", value: 2 },
      { ad_id: "ad-1", date: "2026-10-04", action_type: "onsite_conversion.messaging_conversation_started_7d_click", value: 4 },
      { ad_id: "ad-1", date: "2026-10-04", action_type: "messaging_conversation_started_7d", value: 4 },
    ], {});

    expect(canonical[0]).toMatchObject({ form_leads: 3, site_leads: 2, conversations: 4, leads: 9 });
    expect(resolveMetaLeadActions({
      "leadgen.other": 3,
      "onsite_conversion.lead": 3,
      "offsite_conversion.fb_pixel_lead": 2,
      "onsite_conversion.messaging_conversation_started_7d_click": 4,
      "messaging_conversation_started_7d": 4,
    })).toEqual({ forms: 3, site: 2, conversations: 4, total: 9 });
  });

  it("classifica lead de site retornado pelo pixel separadamente sem duplicar aliases", () => {
    expect(resolveMetaLeadActions({ "offsite_conversion.fb_pixel_lead": 50, lead: 50 }))
      .toEqual({ forms: 0, site: 50, conversations: 0, total: 50 });
  });

  it("soma formulário, site e conversa somente uma vez cada", () => {
    expect(resolveMetaLeadActions({
      "onsite_conversion.lead_grouped": 12,
      omni_lead: 12,
      "offsite_conversion.fb_pixel_lead": 4,
      "onsite_conversion.messaging_conversation_started_7d": 7,
      "onsite_conversion.messaging_conversation_started": 9,
    })).toEqual({ forms: 12, site: 4, conversations: 7, total: 23 });
  });

  it("resolve site sem misturar com formulário ou lead auxiliar", () => {
    expect(resolveMetaLeadActions({ lead: 9, offsite_registration: 4 }, "offsite_registration"))
      .toEqual({ forms: 0, site: 4, conversations: 0, total: 4 });
  });

  it("resolve aliases por dia antes de somar o período inteiro", () => {
    const result = aggregateMetaLeadActionDays({
      ad1: {
        "2026-09-27": { "onsite_conversion.lead_grouped": 4, leadgen_grouped: 4 },
        "2026-09-28": { omni_lead: 3, "onsite_conversion.lead_grouped": 2 },
      },
    }, { ad1: "account-1" });

    expect(result.totals).toEqual({ forms: 6, site: 0, conversations: 0, total: 6 });
    expect(result.dailyByAccount["account-1"]["2026-09-27"].total).toBe(4);
    expect(result.dailyByAccount["account-1"]["2026-09-28"].total).toBe(2);
  });

  it("soma os três grupos Meta sem exigir catálogo de campanha e mantém o escopo de atribuição", () => {
    const result = aggregateMetaLeadTargets(
      [{ ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-04", attribution_window: "account_default" }],
      [
        { ad_id: "ad-1", date: "2026-10-04", action_type: "onsite_conversion.lead_grouped", value: 7, attribution_window: null },
        { ad_id: "ad-1", date: "2026-10-04", action_type: "lead", value: 13, attribution_window: "account_default" },
        { ad_id: "ad-1", date: "2026-10-04", action_type: "offsite_conversion.fb_pixel_lead", value: 2, attribution_window: "account_default" },
        { ad_id: "ad-1", date: "2026-10-04", action_type: "onsite_conversion.messaging_conversation_started_7d", value: 1, attribution_window: "account_default" },
        { ad_id: "ad-1", date: "2026-10-04", action_type: "onsite_conversion.lead_grouped", value: 99, attribution_window: "1d_click" },
      ],
    );

    expect(result.dailyByAccount["account-1"]["2026-10-04"]).toEqual({ forms: 7, site: 2, conversations: 1, total: 10 });
  });

  it("does not use another day's attribution scope or orphan action rows", () => {
    const result = aggregateMetaLeadTargets(
      [
        { ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-03", attribution_window: "7d_click" },
        { ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-04", attribution_window: "account_default" },
      ],
      [
        { ad_id: "ad-1", date: "2026-10-03", action_type: "onsite_conversion.lead_grouped", value: 5, attribution_window: "7d_click" },
        { ad_id: "ad-1", date: "2026-10-04", action_type: "onsite_conversion.lead_grouped", value: 7, attribution_window: "7d_click" },
        { ad_id: "ad-1", date: "2026-10-02", action_type: "onsite_conversion.lead_grouped", value: 99, attribution_window: "account_default" },
      ],
    );

    expect(result.dailyByAccount["account-1"]).toEqual({
      "2026-10-03": { forms: 5, site: 0, conversations: 0, total: 5 },
    });
  });

  it("fails closed when an ad/day has snapshots in multiple attribution windows", () => {
    const result = aggregateMetaLeadTargets(
      [
        { ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-04", attribution_window: "7d_click" },
        { ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-04", attribution_window: "account_default" },
      ],
      [{ ad_id: "ad-1", date: "2026-10-04", action_type: "onsite_conversion.lead_grouped", value: 13, attribution_window: "account_default" }],
    );

    expect(result.dailyByAccount["account-1"]).toBeUndefined();
  });

  it("resolve o resultado oficial por objetivo sem somar mecanismos diferentes", () => {
    expect(resolveMetaCampaignResult("OUTCOME_LEADS", "LEAD_GENERATION", {
      "onsite_conversion.lead_grouped": 4,
      "offsite_conversion.fb_pixel_lead": 9,
      "onsite_conversion.messaging_conversation_started_7d": 12,
    })).toEqual({ resultType: "leads", value: 13 });
    expect(resolveMetaCampaignResult("OUTCOME_ENGAGEMENT", "CONVERSATIONS", {
      "onsite_conversion.messaging_conversation_started_7d": 12,
      "onsite_conversion.messaging_conversation_started": 20,
    })).toEqual({ resultType: "conversations", value: 12 });
  });
});
