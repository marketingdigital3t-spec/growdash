import { describe, expect, it } from "vitest";
import { aggregateMetaLeadActionDays, aggregateMetaLeadTargets, aggregateScopedMetaLeads, resolveMetaActionMetrics, resolveMetaCampaignResult, resolveMetaLeadActions } from "./metaActionMetrics";
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
    }, undefined, false, true)).toEqual({ forms: 3, site: 0, conversations: 7, total: 10 });
  });

  it("não classifica agregados genéricos de lead como formulário nativo", () => {
    expect(resolveMetaLeadActions({ lead: 5, omni_lead: 8 }))
      .toEqual({ forms: 0, site: 0, conversations: 0, total: 0 });
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

  it("reproduz a divergência: não soma pixel residual de LP sem configuração", () => {
    const actions = {
      "onsite_conversion.lead_grouped": 7,
      lead: 13,
      "offsite_conversion.fb_pixel_lead": 6,
      "onsite_conversion.messaging_conversation_started_7d": 1,
      "onsite_conversion.total_messaging_connection": 1,
    };
    expect(resolveMetaLeadActions(actions, undefined, false, true)).toEqual({ forms: 7, site: 0, conversations: 1, total: 8 });
    expect(canonicalMetaLeads([
      { ad_id: "ad-1", ad_account_id: "ca01", date: "2026-10-04", leads: 0 },
    ], Object.entries(actions).map(([action_type, value]) => ({
      ad_account_id: "ca01", ad_id: "ad-1", date: "2026-10-04", action_type, value,
    })), {}, undefined, new Set(["ca01|ad-1"])).at(0)).toMatchObject({ form_leads: 7, site_leads: 0, conversations: 1, leads: 8 });
  });

  it("mantém Forms nativo e ignora pixel de site não configurado no total por estado", () => {
    expect(aggregateScopedMetaLeads([
      { ad_id: "ad-1", ad_account_id: "ca01", date: "2026-10-04", attribution_window: "account_default" },
    ], [
      { ad_id: "ad-1", date: "2026-10-04", attribution_window: "account_default", action_type: "onsite_conversion.lead_grouped", value: 7 },
      { ad_id: "ad-1", date: "2026-10-04", attribution_window: "account_default", action_type: "offsite_conversion.fb_pixel_lead", value: 15 },
      { ad_id: "ad-1", date: "2026-10-04", attribution_window: "account_default", action_type: "onsite_conversion.messaging_conversation_started_7d", value: 2 },
    ], {}, undefined, new Set(["ca01|ad-1"]))).toBe(9);
  });

  it("conta lead de site somente quando a ação está configurada para a conta", () => {
    expect(aggregateScopedMetaLeads([
      { ad_id: "ad-1", ad_account_id: "ca01", date: "2026-10-04", attribution_window: "account_default" },
    ], [
      { ad_id: "ad-1", date: "2026-10-04", attribution_window: "account_default", action_type: "onsite_conversion.lead_grouped", value: 7 },
      { ad_id: "ad-1", date: "2026-10-04", attribution_window: "account_default", action_type: "custom_site_lead", value: 3 },
    ], { ca01: "custom_site_lead" }, new Set(["ca01|ad-1"]))).toBe(10);
  });

  it("não mistura ação com janela de atribuição diferente do snapshot", () => {
    expect(aggregateScopedMetaLeads([
      { ad_id: "ad-1", ad_account_id: "ca01", date: "2026-10-04", attribution_window: "account_default" },
    ], [
      { ad_id: "ad-1", date: "2026-10-04", attribution_window: "1d_click", action_type: "onsite_conversion.lead_grouped", value: 20 },
    ])).toBe(0);
  });

  it("resolve aliases por anúncio antes do total global entre contas", () => {
    const rows = canonicalMetaLeads([
      { ad_id: "ad-1", ad_account_id: "ca01", date: "2026-10-04", leads: 0 },
      { ad_id: "ad-2", ad_account_id: "ca02", date: "2026-10-04", leads: 0 },
    ], [
      { ad_account_id: "ca01", ad_id: "ad-1", date: "2026-10-04", action_type: "onsite_conversion.lead_grouped", value: 7 },
      { ad_account_id: "ca01", ad_id: "ad-1", date: "2026-10-04", action_type: "lead", value: 13 },
      { ad_account_id: "ca02", ad_id: "ad-2", date: "2026-10-04", action_type: "leadgen_grouped", value: 2 },
      { ad_account_id: "ca02", ad_id: "ad-2", date: "2026-10-04", action_type: "lead", value: 5 },
    ], {});

    expect(rows.map((row) => row.form_leads)).toEqual([7, 2]);
    expect(rows.reduce((sum, row) => sum + row.leads, 0)).toBe(9);
  });

  it("isola fatos de mesmo ad_id por UUID interno de conta no agregado global", () => {
    const result = aggregateMetaLeadTargets(
      [
        { ad_id: "duplicated-ad", ad_account_id: "account-1", date: "2026-10-04", attribution_window: "account_default" },
        { ad_id: "duplicated-ad", ad_account_id: "account-2", date: "2026-10-04", attribution_window: "account_default" },
      ],
      [
        { ad_account_id: "account-1", ad_id: "duplicated-ad", date: "2026-10-04", action_type: "onsite_conversion.lead_grouped", value: 7, attribution_window: "account_default" },
        { ad_account_id: "account-2", ad_id: "duplicated-ad", date: "2026-10-04", action_type: "onsite_conversion.lead_grouped", value: 15, attribution_window: "account_default" },
      ],
    );

    expect(result.dailyByAccount["account-1"]["2026-10-04"].total).toBe(7);
    expect(result.dailyByAccount["account-2"]["2026-10-04"].total).toBe(15);
    expect(result.totals.total).toBe(22);
  });

  it("não infere conta para ação sem UUID quando o mesmo ad_id aparece em duas contas", () => {
    const result = aggregateMetaLeadTargets(
      [
        { ad_id: "duplicated-ad", ad_account_id: "account-1", date: "2026-10-04", attribution_window: "account_default" },
        { ad_id: "duplicated-ad", ad_account_id: "account-2", date: "2026-10-04", attribution_window: "account_default" },
      ],
      [{ ad_id: "duplicated-ad", date: "2026-10-04", action_type: "onsite_conversion.lead_grouped", value: 15, attribution_window: "account_default" }],
    );
    expect(result.totals.total).toBe(0);
  });

  it("não trata lead auxiliar de campanha de mensagem como formulário", () => {
    expect(resolveMetaLeadActions({ lead: 9, "onsite_conversion.messaging_conversation_started_7d": 3 }, undefined, false, true))
      .toEqual({ forms: 0, site: 0, conversations: 3, total: 3 });
  });

  it("não confirma conversa sem destino de mensagem explícito", () => {
    expect(resolveMetaLeadActions({
      "onsite_conversion.messaging_conversation_started_7d": 9,
    })).toEqual({ forms: 0, site: 0, conversations: 0, total: 0 });
    expect(resolveMetaLeadActions({
      "onsite_conversion.messaging_conversation_started_7d": 9,
    }, undefined, false, true)).toEqual({ forms: 0, site: 0, conversations: 9, total: 9 });
  });

  it("não transforma conexões totais nem respostas em conversas iniciadas", () => {
    expect(resolveMetaLeadActions({
      "onsite_conversion.total_messaging_connection": 11,
      "onsite_conversion.messaging_conversation_replied_7d": 2,
    })).toEqual({ forms: 0, site: 0, conversations: 0, total: 0 });
  });

  it("usa apenas conversas iniciadas mesmo quando existem conexões totais e respostas", () => {
    expect(resolveMetaLeadActions({
      "onsite_conversion.messaging_conversation_started_7d": 2,
      "onsite_conversion.total_messaging_connection": 11,
      "onsite_conversion.messaging_conversation_replied_7d": 2,
    }, undefined, false, true)).toEqual({ forms: 0, site: 0, conversations: 2, total: 2 });
  });

  it("reconcilia o total do Ads Manager e exclui 28 eventos secundários do escopo de site", () => {
    const accountId = "account-ranniely";
    const actionDays = {
      "forms-ad": { "2026-09-29": { "onsite_conversion.lead_grouped": 128 } },
      "messaging-ad": { "2026-09-29": { "onsite_conversion.messaging_conversation_started_7d": 22 } },
      "non-website-ad": { "2026-09-29": {
        custom_site_lead: 28,
        lead: 28,
        omni_lead: 28,
        "onsite_conversion.total_messaging_connection": 28,
      } },
    };

    const scoped = aggregateMetaLeadActionDays(
      actionDays,
      { "forms-ad": accountId, "messaging-ad": accountId, "non-website-ad": accountId },
      { [accountId]: "custom_site_lead" },
      new Set([`${accountId}|forms-ad`, `${accountId}|messaging-ad`]),
      new Set([`${accountId}|messaging-ad`]),
    );

    expect(scoped.totals).toEqual({ forms: 128, site: 0, conversations: 22, total: 150 });
  });

  it("reconhece variantes de action_type sem somar aliases equivalentes", () => {
    expect(resolveMetaLeadActions({
      "leadgen.other": 4,
      "onsite_conversion.lead": 4,
      "onsite_conversion.messaging_conversation_started_7d_click": 2,
      "messaging_conversation_started_7d": 2,
    }, undefined, false, true)).toEqual({ forms: 0, site: 0, conversations: 2, total: 2 });
  });

  it("mantém a mesma regra de formulário, site e conversa no snapshot usado por MCP e IA", () => {
    const canonical = canonicalMetaLeads([
      { ad_id: "ad-1", ad_account_id: "account-1", date: "2026-10-04", leads: 0 },
    ], [
      { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-04", action_type: "leadgen.other", value: 3 },
      { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-04", action_type: "onsite_conversion.lead", value: 3 },
      { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-04", action_type: "offsite_conversion.fb_pixel_lead", value: 2 },
      { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-04", action_type: "onsite_conversion.messaging_conversation_started_7d_click", value: 4 },
      { ad_account_id: "account-1", ad_id: "ad-1", date: "2026-10-04", action_type: "messaging_conversation_started_7d", value: 4 },
    ], {}, undefined, new Set(["account-1|ad-1"]));

    expect(canonical[0]).toMatchObject({ form_leads: 0, site_leads: 0, conversations: 4, leads: 4 });
    expect(resolveMetaLeadActions({
      "leadgen.other": 3,
      "onsite_conversion.lead": 3,
      "offsite_conversion.fb_pixel_lead": 2,
      "onsite_conversion.messaging_conversation_started_7d_click": 4,
      "messaging_conversation_started_7d": 4,
    }, undefined, false, true)).toEqual({ forms: 0, site: 0, conversations: 4, total: 4 });
  });

  it("ignora lead de site retornado por pixel não configurado", () => {
    expect(resolveMetaLeadActions({ "offsite_conversion.fb_pixel_lead": 50, lead: 50 }))
      .toEqual({ forms: 0, site: 0, conversations: 0, total: 0 });
  });

  it("conta site somente quando o evento está explicitamente configurado", () => {
    expect(resolveMetaLeadActions({ "offsite_conversion.fb_pixel_lead": 15 }, "offsite_conversion.fb_pixel_lead"))
      .toEqual({ forms: 0, site: 0, conversations: 0, total: 0 });
    expect(resolveMetaLeadActions({ "offsite_conversion.fb_pixel_lead": 15 }, "offsite_conversion.fb_pixel_lead", true))
      .toEqual({ forms: 0, site: 15, conversations: 0, total: 15 });
  });

  it("não infere formulário quando Meta só retorna omni_lead agregado", () => {
    expect(resolveMetaLeadActions({ omni_lead: 15 }))
      .toEqual({ forms: 0, site: 0, conversations: 0, total: 0 });
  });

  it("soma formulário, site e conversa somente uma vez cada", () => {
    expect(resolveMetaLeadActions({
      "onsite_conversion.lead_grouped": 12,
      omni_lead: 12,
      "offsite_conversion.fb_pixel_lead": 4,
      "onsite_conversion.messaging_conversation_started_7d": 7,
      "onsite_conversion.messaging_conversation_started": 9,
    }, undefined, false, true)).toEqual({ forms: 12, site: 0, conversations: 7, total: 19 });
  });

  it("resolve site sem misturar com formulário ou lead auxiliar", () => {
    expect(resolveMetaLeadActions({ lead: 9, offsite_registration: 4 }, "offsite_registration", true))
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
      {},
      undefined,
      new Set(["account-1|ad-1"]),
    );

    expect(result.dailyByAccount["account-1"]["2026-10-04"]).toEqual({ forms: 7, site: 0, conversations: 1, total: 8 });
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
    })).toEqual({ resultType: "leads", value: 4 });
    expect(resolveMetaCampaignResult("OUTCOME_ENGAGEMENT", "CONVERSATIONS", {
      "onsite_conversion.messaging_conversation_started_7d": 12,
      "onsite_conversion.messaging_conversation_started": 20,
    })).toEqual({ resultType: "conversations", value: 12 });
  });
});
