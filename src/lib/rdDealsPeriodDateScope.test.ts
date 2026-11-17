import { describe, expect, it } from "vitest";

interface RDDealLite {
  id: string;
  rd_deal_id: string;
  win: boolean | null;
  lead_created_at: string | null;
  closed_at: string | null;
  stage_updated_at: string | null;
  rd_stage_name: string | null;
}

/**
 * Simula a lógica de filtragem do useRDDealsForPeriod:
 * - Query 1: deals não-won filtrados por lead_created_at
 * - Query 2: deals won filtrados por closed_at
 * - Query 3: deals sem closed_at filtrados por stage_updated_at
 */
function dealsInPeriod(deals: RDDealLite[], startDate: string, endDate: string): RDDealLite[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const inRange = (iso: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= start.getTime() && t <= end.getTime();
  };

  const wonInPeriod = deals.filter((d) => d.win === true && inRange(d.closed_at));
  const openOrLostInPeriod = deals.filter(
    (d) => d.win !== true && inRange(d.lead_created_at),
  );
  const noClosedInPeriod = deals.filter(
    (d) => d.closed_at === null && d.win !== true && inRange(d.stage_updated_at),
  );

  const seen = new Set<string>();
  const result: RDDealLite[] = [];
  for (const d of [...wonInPeriod, ...openOrLostInPeriod, ...noClosedInPeriod]) {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      result.push(d);
    }
  }
  return result;
}

describe("RD deals period date scope", () => {
  it("won deal closed in period but created before period is included", () => {
    const deals: RDDealLite[] = [
      {
        id: "d1",
        rd_deal_id: "rd-1",
        win: true,
        lead_created_at: "2026-10-01T10:00:00-03:00",
        closed_at: "2026-11-15T10:00:00-03:00",
        stage_updated_at: "2026-11-15T10:00:00-03:00",
        rd_stage_name: "Venda",
      },
    ];

    const result = dealsInPeriod(deals, "2026-11-01", "2026-11-30");
    expect(result).toHaveLength(1);
    expect(result[0].rd_deal_id).toBe("rd-1");
  });

  it("won deal created and closed in period is included", () => {
    const deals: RDDealLite[] = [
      {
        id: "d2",
        rd_deal_id: "rd-2",
        win: true,
        lead_created_at: "2026-11-05T10:00:00-03:00",
        closed_at: "2026-11-10T10:00:00-03:00",
        stage_updated_at: "2026-11-10T10:00:00-03:00",
        rd_stage_name: "Venda",
      },
    ];

    const result = dealsInPeriod(deals, "2026-11-01", "2026-11-30");
    expect(result).toHaveLength(1);
    expect(result[0].rd_deal_id).toBe("rd-2");
  });

  it("open deal created in period is included", () => {
    const deals: RDDealLite[] = [
      {
        id: "d3",
        rd_deal_id: "rd-3",
        win: false,
        lead_created_at: "2026-11-15T10:00:00-03:00",
        closed_at: null,
        stage_updated_at: "2026-11-15T10:00:00-03:00",
        rd_stage_name: "Em Conversa",
      },
    ];

    const result = dealsInPeriod(deals, "2026-11-01", "2026-11-30");
    expect(result).toHaveLength(1);
    expect(result[0].rd_deal_id).toBe("rd-3");
  });

  it("won deal closed outside period is NOT included even if created in period", () => {
    const deals: RDDealLite[] = [
      {
        id: "d4",
        rd_deal_id: "rd-4",
        win: true,
        lead_created_at: "2026-11-05T10:00:00-03:00",
        closed_at: "2026-12-15T10:00:00-03:00",
        stage_updated_at: "2026-12-15T10:00:00-03:00",
        rd_stage_name: "Venda",
      },
    ];

    const result = dealsInPeriod(deals, "2026-11-01", "2026-11-30");
    expect(result).toHaveLength(0);
  });

  it("deduplicates deals that match multiple queries", () => {
    const deals: RDDealLite[] = [
      {
        id: "d5",
        rd_deal_id: "rd-5",
        win: true,
        lead_created_at: "2026-11-10T10:00:00-03:00",
        closed_at: "2026-11-15T10:00:00-03:00",
        stage_updated_at: "2026-11-15T10:00:00-03:00",
        rd_stage_name: "Venda",
      },
    ];

    const result = dealsInPeriod(deals, "2026-11-01", "2026-11-30");
    expect(result).toHaveLength(1);
  });
});
