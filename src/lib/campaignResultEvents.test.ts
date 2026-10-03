import { describe, expect, it } from "vitest";
import { resolveCampaignPrimaryResult, resolveCampaignResults } from "./campaignResultEvents";

describe("resolveCampaignResults", () => {
  it("mantém leads Meta e conversas iniciadas separados", () => {
    expect(resolveCampaignResults(0, {
      link_click: 900,
      "onsite_conversion.messaging_conversation_started_7d": 4,
    })).toEqual({
      total: 4,
      leadCount: 0,
      conversations: 4,
      breakdown: [
        { label: "Conversas iniciadas", value: 4 },
      ],
    });
  });

  it("usa o evento de lead quando o insight ainda não trouxe o total", () => {
    expect(resolveCampaignResults(0, { lead: 3, landing_page_view: 100 })).toMatchObject({
      total: 3,
      leadCount: 3,
      conversations: 0,
    });
  });

  it("não duplica aliases da mesma conversa iniciada", () => {
    expect(resolveCampaignResults(0, {
      "onsite_conversion.messaging_conversation_started_7d": 8,
      "onsite_conversion.messaging_conversation_started_28d": 8,
      "onsite_conversion.messaging_first_reply": 8,
    })).toMatchObject({ total: 8, leadCount: 0, conversations: 8 });
  });

  it("soma conversas de campanhas diferentes sem perder o resultado de cada uma", () => {
    const campaignA = resolveCampaignResults(0, { "onsite_conversion.messaging_conversation_started_7d": 2 });
    const campaignB = resolveCampaignResults(0, { "onsite_conversion.messaging_conversation_started_7d": 2 });

    expect([campaignA.total, campaignB.total]).toEqual([2, 2]);
    expect(campaignA.total + campaignB.total).toBe(4);
  });

  it("mostra o maior evento mesmo em campanha de geração de leads", () => {
    const results = resolveCampaignResults(0, { "onsite_conversion.messaging_conversation_started_7d": 4 });
    expect(resolveCampaignPrimaryResult("OUTCOME_LEADS", results)).toEqual({ label: "Conversas iniciadas", value: 4 });
  });

  it("mostra apenas conversas iniciadas para campanha que não é de leads", () => {
    const results = resolveCampaignResults(0, { "onsite_conversion.messaging_conversation_started_7d": 4 });
    expect(resolveCampaignPrimaryResult("OUTCOME_ENGAGEMENT", results)).toEqual({ label: "Conversas iniciadas", value: 4 });
  });

  it("mantém o único evento disponível como resultado exibido", () => {
    const results = resolveCampaignResults(0, { "onsite_conversion.messaging_conversation_started_7d": 18 });
    expect(resolveCampaignPrimaryResult("OUTCOME_LEADS", results)).toEqual({ label: "Conversas iniciadas", value: 18 });
  });

  it("prioriza conversas quando elas são o maior resultado", () => {
    const results = resolveCampaignResults(12, { "onsite_conversion.messaging_conversation_started_7d": 18 });
    expect(resolveCampaignPrimaryResult("OUTCOME_LEADS", results)).toEqual({ label: "Conversas iniciadas", value: 18 });
  });

  it("compõe formulários e conversas sem somar aliases duplicados", () => {
    expect(resolveCampaignResults(0, {
      "onsite_conversion.lead_grouped": 3,
      lead: 5,
      "onsite_conversion.messaging_conversation_started_7d": 7,
      "onsite_conversion.messaging_conversation_started": 11,
    })).toMatchObject({ total: 14, leadCount: 3, conversations: 11 });
  });

  it("usa o evento configurado de site e não o lead auxiliar", () => {
    expect(resolveCampaignResults(99, { lead: 9, landing_page_view: 10, offsite_registration: 4 }, "offsite_registration"))
      .toMatchObject({ total: 4, leadCount: 4, conversations: 0 });
  });

  it("não usa insights antigos quando há ações auditáveis sem formulário", () => {
    expect(resolveCampaignResults(38, { "onsite_conversion.messaging_conversation_started_7d": 11 }))
      .toMatchObject({ total: 11, leadCount: 0, conversations: 11 });
  });

  it("não zera leads persistidos quando só existem ações que não são de aquisição", () => {
    expect(resolveCampaignResults(4, { link_click: 20 }))
      .toMatchObject({ total: 4, leadCount: 4, conversations: 0 });
  });

  it("usa os componentes canônicos persistidos quando a consulta de ações não trouxe conversas", () => {
    expect(resolveCampaignResults(4, { link_click: 20 }, null, { forms: 0, site: 0, conversations: 4 }))
      .toMatchObject({ total: 4, leadCount: 0, conversations: 4 });
  });

  it("mescla componentes por fonte sem apagar conversas quando a resposta de ações é parcial", () => {
    expect(resolveCampaignResults(7, { "onsite_conversion.lead_grouped": 3 }, null, { forms: 3, site: 0, conversations: 4 }))
      .toMatchObject({ total: 7, leadCount: 3, conversations: 4 });
  });

  it("mantém zero real dos componentes canônicos sem recorrer ao total legado", () => {
    expect(resolveCampaignResults(4, { link_click: 20 }, null, { forms: 0, site: 0, conversations: 0 }))
      .toMatchObject({ total: 0, leadCount: 0, conversations: 0 });
  });
});
