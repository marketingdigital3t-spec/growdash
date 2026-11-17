import { describe, expect, it } from "vitest";
import { businessDateKey } from "@/lib/businessDate";
import { saoPauloDayBounds, isCanonicalWonDeal } from "@/lib/canonicalMetrics";

interface Deal {
  rd_deal_id?: string | null;
  win?: boolean | null;
  rd_stage_name?: string | null;
  stage_bucket?: string | null;
  lost_reason?: string | null;
  lead_created_at?: string | null;
  closed_at?: string | null;
  stage_updated_at?: string | null;
}

function isLostDeal(deal: Deal): boolean {
  return deal.stage_bucket === "lost" || deal.stage_bucket === "disqualified" || Boolean(deal.lost_reason);
}

/**
 * Regra do pipeline do CRM (espelho do RD Station):
 * - Negócios terminais (ganhos ou perdidos) pertencem ao período pela data
 *   de fechamento (closed_at).
 * - Negócios em aberto pertencem ao período pela data de criação
 *   (lead_created_at).
 */
export function dealBelongsToBoardPeriod(deal: Deal, startDate: Date, endDate: Date): boolean {
  const bounds = saoPauloDayBounds(startDate, endDate);
  const start = bounds.start.getTime();
  const end = bounds.end.getTime();
  const inRange = (value: string | null | undefined) => {
    if (!value) return false;
    const t = new Date(value).getTime();
    return Number.isFinite(t) && t >= start && t <= end;
  };

  const won = isCanonicalWonDeal(deal);
  const lost = isLostDeal(deal);
  if (won || lost) return inRange(deal.closed_at);
  return inRange(deal.lead_created_at);
}

describe("CRM board date scope by column type", () => {
  const start = new Date("2026-11-01T00:00:00-03:00");
  const end = new Date("2026-11-30T00:00:00-03:00");

  it("includes a won deal closed in the period even if created earlier", () => {
    const deal: Deal = {
      rd_deal_id: "won-1",
      win: true,
      rd_stage_name: "Venda Realizada",
      stage_bucket: "client",
      lead_created_at: "2026-10-16T12:47:32-03:00",
      closed_at: "2026-11-16T13:22:17-03:00",
      stage_updated_at: "2026-11-16T13:22:17-03:00",
    };
    expect(dealBelongsToBoardPeriod(deal, start, end)).toBe(true);
  });

  it("excludes a won deal created in the period but closed outside it", () => {
    const deal: Deal = {
      rd_deal_id: "won-2",
      win: true,
      rd_stage_name: "Venda Realizada",
      stage_bucket: "client",
      lead_created_at: "2026-11-05T10:00:00-03:00",
      closed_at: "2026-12-15T10:00:00-03:00",
      stage_updated_at: "2026-12-15T10:00:00-03:00",
    };
    expect(dealBelongsToBoardPeriod(deal, start, end)).toBe(false);
  });

  it("includes an open deal created in the period", () => {
    const deal: Deal = {
      rd_deal_id: "open-1",
      win: false,
      rd_stage_name: "Sem contato",
      stage_bucket: "lead",
      lead_created_at: "2026-11-15T10:00:00-03:00",
      closed_at: null,
      stage_updated_at: "2026-11-15T10:00:00-03:00",
    };
    expect(dealBelongsToBoardPeriod(deal, start, end)).toBe(true);
  });

  it("excludes an open deal created before the period", () => {
    const deal: Deal = {
      rd_deal_id: "open-2",
      win: false,
      rd_stage_name: "Em conversa",
      stage_bucket: "lead",
      lead_created_at: "2026-09-01T10:00:00-03:00",
      closed_at: null,
      stage_updated_at: "2026-11-08T10:00:00-03:00",
    };
    expect(dealBelongsToBoardPeriod(deal, start, end)).toBe(false);
  });

  it("includes a lost deal closed in the period", () => {
    const deal: Deal = {
      rd_deal_id: "lost-1",
      win: false,
      rd_stage_name: "Perdido",
      stage_bucket: "lost",
      lead_created_at: "2026-10-01T10:00:00-03:00",
      closed_at: "2026-11-05T10:00:00-03:00",
      stage_updated_at: "2026-11-05T10:00:00-03:00",
    };
    expect(dealBelongsToBoardPeriod(deal, start, end)).toBe(true);
  });

  it("uses business day boundaries in Sao Paulo time", () => {
    const deal: Deal = {
      rd_deal_id: "edge-1",
      win: true,
      rd_stage_name: "Venda Realizada",
      stage_bucket: "client",
      lead_created_at: "2026-10-31T23:00:00-03:00",
      closed_at: "2026-11-01T00:30:00-03:00",
      stage_updated_at: "2026-11-01T00:30:00-03:00",
    };
    expect(dealBelongsToBoardPeriod(deal, start, end)).toBe(true);
    expect(businessDateKey(new Date("2026-11-01T00:30:00-03:00"))).toBe("2026-11-01");
  });
});
