import { describe, expect, it } from "vitest";
import { aggregateMetaLeadActionDays, resolveMetaActionMetrics, resolveMetaCampaignResult, resolveMetaLeadActions } from "./metaActionMetrics";
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

  it("usa o maior alias compatível por mecanismo sem duplicar o mesmo resultado", () => {
    expect(resolveMetaLeadActions({
      "onsite_conversion.lead_grouped": 3,
      lead: 5,
      omni_lead: 5,
      "onsite_conversion.messaging_conversation_started_7d": 7,
      "onsite_conversion.messaging_conversation_started": 11,
      "onsite_conversion.total_messaging_connection": 11,
    })).toEqual({ forms: 5, site: 0, conversations: 11, total: 16 });
  });

  it("usa lead somente quando não existe evento nativo de formulário", () => {
    expect(resolveMetaLeadActions({ lead: 5 }))
      .toEqual({ forms: 5, site: 0, conversations: 0, total: 5 });
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
    })).toEqual({ forms: 12, site: 4, conversations: 9, total: 25 });
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

    expect(result.totals).toEqual({ forms: 7, site: 0, conversations: 0, total: 7 });
    expect(result.dailyByAccount["account-1"]["2026-09-27"].total).toBe(4);
    expect(result.dailyByAccount["account-1"]["2026-09-28"].total).toBe(3);
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
    })).toEqual({ resultType: "conversations", value: 20 });
  });
});
