import { describe, expect, it } from "vitest";
import { buildCoreAccountSummaries } from "./agentCore";

const account = { id: "account-1", name: "Conta principal", target_cpl: 50 };
const insight = {
  ad_id: "ad-1",
  date: "2026-08-08",
  spend: 1_000,
  impressions: 50_000,
  reach: 31_000,
  clicks: 1_250,
  ctr: 2.5,
  cpm: 20,
  frequency: 1.6,
  leads: 25,
  cpl: 40,
  conversion_rate: 2,
  efficiency_rate: 80,
  health_score: 82,
  ad_name: "Criativo A",
  adset_name: "Conjunto A",
  campaign_name: "Captação Escala",
  campaign_objective: "OUTCOME_LEADS",
  campaign_status: "ACTIVE",
  campaign_id: "campaign-1",
  ad_account_id: account.id,
};

describe("buildCoreAccountSummaries", () => {
  it("keeps traffic inside the operational core and exposes account strategy metrics", () => {
    const [summary] = buildCoreAccountSummaries("traffic", { accounts: [account], insights: [insight] });

    expect(summary.spend).toBe(1_000);
    expect(summary.cpl).toBe(40);
    expect(summary.activeCampaigns).toBe(1);
    expect(summary.topCampaign).toBe("Captação Escala");
    expect(summary.topObjective).toBe("Geração de leads");
    expect(summary.strategyDetail).toContain("Captação Escala");
  });

  it("flags media spend without leads as a conversion recovery strategy", () => {
    const [summary] = buildCoreAccountSummaries("traffic", {
      accounts: [account],
      insights: [{ ...insight, leads: 0, spend: 180 }],
    });

    expect(summary.health).toBe("critical");
    expect(summary.strategy).toBe("Recuperação de conversão");
  });

  it("reconciles finance and commercial data without inventing sellers", () => {
    const sale = {
      id: "sale-1",
      user_id: "user-1",
      product_id: null,
      ad_account_id: account.id,
      campaign_ids: [],
      sale_date: "2026-08-08",
      gross_revenue: 4_500,
      net_revenue: 4_000,
      tax_amount: 500,
      refund_amount: 0,
      chargeback_amount: 0,
      payment_method: "pix",
      status: "confirmed",
      quantity: 2,
      notes: null,
      lead_state: null,
      lead_formation: null,
      contact_name: null,
      contact_phone: null,
      contact_email: null,
      lead_city: null,
      lead_entry_date: null,
      adset_id: null,
      ad_id: null,
      rd_deal_id: null,
      rd_campaign_name: null,
      rd_product_name: null,
      rd_funnel_id: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      manual_platform: null,
      matched_campaign_id: null,
      match_method: null,
      manual_campaign_id: null,
      manual_adset_id: null,
      manual_ad_id: null,
      manual_override: false,
      workspace_id: null,
      business_unit_id: null,
      source_provider: null,
      source_record_id: null,
      source_closed_at: null,
      attribution_confidence: null,
      attribution_reason: null,
      created_at: "2026-08-08T12:00:00Z",
      updated_at: "2026-08-08T12:00:00Z",
    };
    const [summary] = buildCoreAccountSummaries("finance", { accounts: [account], insights: [insight], sales: [sale] });

    expect(summary.revenue).toBe(4_000);
    expect(summary.sales).toBe(2);
    expect(summary.ticket).toBe(2_000);
    expect(summary.roas).toBe(4);
    expect(summary.topSeller).toBeNull();
  });

  it("uses real automation schedules per account", () => {
    const [summary] = buildCoreAccountSummaries("automations", {
      accounts: [account],
      schedules: [{ id: "schedule-1", ad_account_id: account.id, name: "Resumo diário", enabled: true, next_run_at: null, last_status: "sent" }],
    });

    expect(summary.activeSchedules).toBe(1);
    expect(summary.strategy).toBe("Playbooks automatizados ativos");
  });
});
