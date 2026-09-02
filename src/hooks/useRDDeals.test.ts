import { describe, expect, it } from "vitest";
import { computeFunnelAnalytics, dedupeRDDeals, shouldApplyRDDateRange, type RDDeal, type FunnelStage } from "./useRDDeals";

describe("RD deals date scope", () => {
  it("keeps a selected period scoped to its creation or closing dates", () => {
    expect(shouldApplyRDDateRange(false)).toBe(true);
  });

  it("does not discard old active deals when the funnel asks for full history", () => {
    expect(shouldApplyRDDateRange(true)).toBe(false);
  });

  it("deduplicates the same RD deal kept by more than one sync snapshot", () => {
    const base = {
      rd_funnel_id: "funnel-a", rd_stage_id: "stage-1", rd_stage_name: "Lead Novo", rd_stage_order: 1,
      deal_owner_name: null, rd_product_name: null, stage_bucket: "lead" as const, win: false, lost_reason: null,
      amount_total: 0, utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null,
      utm_id: null, lead_state: null, lead_city: null, lead_created_at: "2026-08-01T12:00:00Z", stage_updated_at: null, closed_at: null,
    };
    const rows = dedupeRDDeals([
      { ...base, id: "old", rd_deal_id: "deal-1", updated_at: "2026-08-01T12:00:00Z" },
      { ...base, id: "new", rd_deal_id: "deal-1", amount_total: 15000, updated_at: "2026-08-02T12:00:00Z" },
    ] as RDDeal[]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "new", amount_total: 15000 });
  });

  it("consolidates equal stages from different connected funnels into one pipeline", () => {
    const stages: FunnelStage[] = [
      { rd_funnel_id: "aluna", rd_stage_id: "a-lead", name: "Lead Novo", order: 1, is_won: false, is_lost: false },
      { rd_funnel_id: "modelo", rd_stage_id: "m-lead", name: "Leads novos", order: 1, is_won: false, is_lost: false },
      { rd_funnel_id: "aluna", rd_stage_id: "a-sale", name: "Venda Realizada", order: 9, is_won: true, is_lost: false },
      { rd_funnel_id: "modelo", rd_stage_id: "m-sale", name: "Venda Realizada", order: 9, is_won: true, is_lost: false },
    ];
    const deal = (id: string, funnel: string, stageId: string, stageName: string, win = false): RDDeal => ({
      id, rd_deal_id: id, rd_funnel_id: funnel, rd_stage_id: stageId, rd_stage_name: stageName, rd_stage_order: win ? 9 : 1,
      deal_owner_name: null, rd_product_name: null, stage_bucket: win ? "client" : "lead", win, lost_reason: null, amount_total: win ? 15000 : 0,
      utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, utm_id: null,
      lead_state: null, lead_city: null, lead_created_at: "2026-08-01T12:00:00Z", stage_updated_at: null, closed_at: win ? "2026-08-02T12:00:00Z" : null,
    });
    const analytics = computeFunnelAnalytics([
      deal("a-1", "aluna", "a-lead", "Lead Novo"),
      deal("m-1", "modelo", "m-lead", "Leads novos"),
      deal("a-2", "aluna", "a-sale", "Venda Realizada", true),
      deal("m-2", "modelo", "m-sale", "Venda Realizada", true),
    ], stages);

    expect(analytics.stages.map((stage) => [stage.name, stage.count])).toEqual([
      ["Novos leads", 2],
      ["Vendas ganhas", 2],
    ]);
    expect(analytics.stageConversion).toHaveLength(1);
    expect(analytics.stageConversion[0].label).toBe("Novos leads → Vendas ganhas");
  });

  it("does not create an advancement pair from stages that belong to different funnels", () => {
    const stages: FunnelStage[] = [
      { rd_funnel_id: "a", rd_stage_id: "a-lead", name: "Lead novo", order: 1, is_won: false, is_lost: false },
      { rd_funnel_id: "a", rd_stage_id: "a-contact", name: "Em atendimento", order: 2, is_won: false, is_lost: false },
      { rd_funnel_id: "a", rd_stage_id: "a-won", name: "Venda realizada", order: 3, is_won: true, is_lost: false },
      { rd_funnel_id: "b", rd_stage_id: "b-lead", name: "Lead novo", order: 1, is_won: false, is_lost: false },
      { rd_funnel_id: "b", rd_stage_id: "b-opportunity", name: "Oportunidade", order: 2, is_won: false, is_lost: false },
      { rd_funnel_id: "b", rd_stage_id: "b-won", name: "Venda realizada", order: 3, is_won: true, is_lost: false },
    ];
    const deal = (id: string, funnel: string, stageId: string, stageName: string): RDDeal => ({
      id, rd_deal_id: id, rd_funnel_id: funnel, rd_stage_id: stageId, rd_stage_name: stageName, rd_stage_order: 2,
      deal_owner_name: null, rd_product_name: null, stage_bucket: "lead", win: false, lost_reason: null, amount_total: 0,
      utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, utm_id: null,
      lead_state: "SP", lead_city: null, lead_created_at: "2026-08-01T12:00:00Z", stage_updated_at: null, closed_at: null,
    });
    const analytics = computeFunnelAnalytics([
      deal("a-1", "a", "a-contact", "Em atendimento"),
      deal("b-1", "b", "b-opportunity", "Oportunidade"),
    ], stages);
    const labels = analytics.stageConversion.map((stage) => stage.label);
    expect(labels).toContain("Novos leads → Em atendimento");
    expect(labels).toContain("Novos leads → Oportunidades");
    expect(labels).not.toContain("Em atendimento → Oportunidades");
  });

  it("keeps advancement pairs in the RD stage order instead of alphabetical label order", () => {
    const stages: FunnelStage[] = [
      { rd_funnel_id: "one", rd_stage_id: "lead", name: "Novos leads", order: 1, is_won: false, is_lost: false },
      { rd_funnel_id: "one", rd_stage_id: "contact", name: "Em atendimento", order: 2, is_won: false, is_lost: false },
      { rd_funnel_id: "one", rd_stage_id: "opportunity", name: "Oportunidades", order: 3, is_won: false, is_lost: false },
      { rd_funnel_id: "one", rd_stage_id: "won", name: "Venda realizada", order: 4, is_won: true, is_lost: false },
    ];
    const deal = (id: string, stageId: string): RDDeal => ({
      id, rd_deal_id: id, rd_funnel_id: "one", rd_stage_id: stageId, rd_stage_name: stageId, rd_stage_order: 1,
      deal_owner_name: null, rd_product_name: null, stage_bucket: "lead", win: stageId === "won", lost_reason: null, amount_total: 0,
      utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, utm_id: null,
      lead_state: null, lead_city: null, lead_created_at: "2026-08-01T12:00:00Z", stage_updated_at: null, closed_at: null,
    });
    const analytics = computeFunnelAnalytics([
      deal("one", "lead"),
      deal("two", "contact"),
      deal("three", "opportunity"),
      deal("four", "won"),
    ], stages);

    expect(analytics.stageConversion.map((stage) => stage.label)).toEqual([
      "Novos leads → Em atendimento",
      "Em atendimento → Oportunidades",
      "Oportunidades → Vendas ganhas",
    ]);
  });

  it("separates Stand By reasons from lost-deal reasons", () => {
    const stages: FunnelStage[] = [
      { rd_funnel_id: "one", rd_stage_id: "standby", name: "Stand By", order: 3, is_won: false, is_lost: false },
      { rd_funnel_id: "one", rd_stage_id: "lost", name: "Perdida", order: 9, is_won: false, is_lost: true },
    ];
    const deal = (id: string, stageId: string, stageName: string, bucket: RDDeal["stage_bucket"], reason: string): RDDeal => ({
      id, rd_deal_id: id, rd_funnel_id: "one", rd_stage_id: stageId, rd_stage_name: stageName, rd_stage_order: 1,
      deal_owner_name: null, rd_product_name: null, stage_bucket: bucket, win: false, lost_reason: reason, amount_total: 0,
      utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, utm_id: null,
      lead_state: null, lead_city: null, lead_created_at: "2026-08-01T12:00:00Z", stage_updated_at: null, closed_at: null,
    });
    const analytics = computeFunnelAnalytics([
      deal("waiting", "standby", "Stand By", "lead", "Aguardando retorno"),
      deal("lost", "lost", "Perdida", "lost", "Sem orçamento"),
    ], stages);
    expect(analytics.standbyReasons).toEqual([{ reason: "Aguardando retorno", count: 1, pct: 100 }]);
    expect(analytics.lostReasons).toEqual([{ reason: "Sem orçamento", count: 1, pct: 100 }]);
  });
});
