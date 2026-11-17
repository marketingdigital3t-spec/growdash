import { describe, expect, it } from "vitest";

interface InsightRow {
  spend: number;
  form_leads: number | null;
  site_leads: number | null;
  conversations: number | null;
  campaign: { id: string; name: string; objective: string | null };
}

function detectCampaignsWithSpendNoLeads(rows: InsightRow[], since: string) {
  const thirtyDaysAgo = new Date(since);
  const byCampaign = new Map<string, { name: string; objective: string; spend: number; leads: number }>();

  for (const r of rows) {
    const dateOk = true; // rows already filtered by date in query
    const c = r.campaign;
    if (!c) continue;
    const cur = byCampaign.get(c.id) || { name: c.name, objective: c.objective || "—", spend: 0, leads: 0 };
    cur.spend += Number(r.spend || 0);
    cur.leads +=
      Math.max(0, Number(r.form_leads || 0)) +
      Math.max(0, Number(r.site_leads || 0)) +
      Math.max(0, Number(r.conversations || 0));
    byCampaign.set(c.id, cur);
  }

  return Array.from(byCampaign.values())
    .filter((c) => c.spend > 50 && c.leads === 0)
    .sort((a, b) => b.spend - a.spend);
}

describe("spend-no-leads detection", () => {
  it("detects campaigns with spend > 50 and zero leads", () => {
    const rows: InsightRow[] = [
      { spend: 100, form_leads: 0, site_leads: 0, conversations: 0, campaign: { id: "c1", name: "Campanha A", objective: "TRAFFIC" } },
      { spend: 200, form_leads: 0, site_leads: 0, conversations: 0, campaign: { id: "c2", name: "Campanha B", objective: "CONVERSION" } },
      { spend: 30, form_leads: 0, site_leads: 0, conversations: 0, campaign: { id: "c3", name: "Campanha C", objective: "AWARENESS" } },
      { spend: 80, form_leads: 2, site_leads: 0, conversations: 0, campaign: { id: "c4", name: "Campanha D", objective: "LEADS" } },
    ];

    const offenders = detectCampaignsWithSpendNoLeads(rows, "2026-10-18");

    expect(offenders).toHaveLength(2);
    expect(offenders.map((o) => o.name)).toContain("Campanha A");
    expect(offenders.map((o) => o.name)).toContain("Campanha B");
  });

  it("excludes campaigns with spend <= 50", () => {
    const rows: InsightRow[] = [
      { spend: 40, form_leads: 0, site_leads: 0, conversations: 0, campaign: { id: "c1", name: "Campanha Baixo", objective: "TRAFFIC" } },
    ];

    expect(detectCampaignsWithSpendNoLeads(rows, "2026-10-18")).toHaveLength(0);
  });

  it("excludes campaigns that have at least one lead", () => {
    const rows: InsightRow[] = [
      { spend: 100, form_leads: 1, site_leads: 0, conversations: 0, campaign: { id: "c1", name: "Campanha Com Lead", objective: "LEADS" } },
    ];

    expect(detectCampaignsWithSpendNoLeads(rows, "2026-10-18")).toHaveLength(0);
  });

  it("aggregates multiple insight rows per campaign", () => {
    const rows: InsightRow[] = [
      { spend: 30, form_leads: 0, site_leads: 0, conversations: 0, campaign: { id: "c1", name: "Campanha Agregada", objective: "TRAFFIC" } },
      { spend: 30, form_leads: 0, site_leads: 0, conversations: 0, campaign: { id: "c1", name: "Campanha Agregada", objective: "TRAFFIC" } },
    ];

    const offenders = detectCampaignsWithSpendNoLeads(rows, "2026-10-18");

    expect(offenders).toHaveLength(1);
    expect(offenders[0].spend).toBe(60);
  });
});
