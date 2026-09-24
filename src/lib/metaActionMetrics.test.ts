import { describe, expect, it } from "vitest";
import { resolveMetaActionMetrics, resolveMetaLeadActions } from "./metaActionMetrics";

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

  it("resolve site sem misturar com formulário ou lead auxiliar", () => {
    expect(resolveMetaLeadActions({ lead: 9, offsite_registration: 4 }, "offsite_registration"))
      .toEqual({ forms: 0, site: 4, conversations: 0, total: 4 });
  });
});
