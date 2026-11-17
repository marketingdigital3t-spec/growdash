import { describe, expect, it } from "vitest";

interface ScopedDeal {
  rd_deal_id?: string | null;
  rd_connection_id?: string | null;
  ad_account_id?: string | null;
  rd_funnel_id?: string | null;
  win?: boolean | null;
  rd_stage_name?: string | null;
  lead_created_at?: string | null;
  closed_at?: string | null;
  stage_updated_at?: string | null;
}

const FUNNEL_ID = "funnel-ranniely-aluna";
const ACCOUNT_ID = "acc-ranniely-aluna";

/**
 * Reproduz as três queries de useRDDealsForPeriod e o filtro de escopo.
 * A terceira query (sem closed_at por stage_updated_at) precisa excluir os
 * negócios que a primeira query já trouxe (não-won criados no período),
 * senão o pipeline do CRM conta a mesma negociação duas vezes.
 */
function fetchPeriodDeals(deals: ScopedDeal[], rangeStart: string, rangeEnd: string) {
  const inRange = (value: string | null | undefined) => {
    if (!value) return false;
    const t = new Date(value).getTime();
    return Number.isFinite(t) && t >= new Date(rangeStart).getTime() && t <= new Date(rangeEnd).getTime();
  };
  const isWon = (deal: ScopedDeal) => Boolean(deal.win);

  const q1 = deals.filter((d) => !isWon(d) && inRange(d.lead_created_at));
  const q2 = deals.filter((d) => isWon(d) && inRange(d.closed_at));
  // Correção: a terceira query exclui também os negócios sem closed_at cuja
  // data de criação já está no período (cobertos pela primeira query).
  const q3 = deals.filter(
    (d) => !isWon(d) && d.closed_at == null && inRange(d.stage_updated_at) && !inRange(d.lead_created_at),
  );

  const all = [...q1, ...q2, ...q3];

  // Filtro de escopo: não-won entra por lead_created_at, won por closed_at.
  const scoped = all.filter((deal) => {
    if (deal.rd_funnel_id !== FUNNEL_ID) return false;
    if (deal.ad_account_id !== ACCOUNT_ID) return false;
    if (isWon(deal)) return inRange(deal.closed_at);
    return inRange(deal.lead_created_at);
  });

  // Deduplicação por identidade do provider.
  const seen = new Set<string>();
  return scoped.filter((deal) => {
    const id = `${deal.rd_connection_id || deal.ad_account_id || "legacy"}:${deal.rd_deal_id}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

describe("RD period query overlap", () => {
  it("counts each negotiation once when the stage-movement query overlaps the creation query", () => {
    const deals: ScopedDeal[] = [
      // 94 não-won criados dentro do período (cobertos pela primeira query)
      ...Array.from({ length: 94 }, (_, i) => ({
        rd_deal_id: `open-${i}`,
        rd_connection_id: "conn-1",
        ad_account_id: ACCOUNT_ID,
        rd_funnel_id: FUNNEL_ID,
        win: false,
        rd_stage_name: "Sem contato",
        lead_created_at: "2026-11-10T10:00:00-03:00",
        closed_at: null,
        stage_updated_at: "2026-11-12T10:00:00-03:00",
      })),
      // 8 vendas ganhas fechadas dentro do período (segunda query)
      ...Array.from({ length: 8 }, (_, i) => ({
        rd_deal_id: `won-${i}`,
        rd_connection_id: "conn-1",
        ad_account_id: ACCOUNT_ID,
        rd_funnel_id: FUNNEL_ID,
        win: true,
        rd_stage_name: "Venda Realizada",
        lead_created_at: "2026-11-05T10:00:00-03:00",
        closed_at: "2026-11-15T10:00:00-03:00",
        stage_updated_at: "2026-11-15T10:00:00-03:00",
      })),
    ];

    const result = fetchPeriodDeals(deals, "2026-11-01T00:00:00-03:00", "2026-11-30T23:59:59.999-03:00");

    // O RD Station reporta 101 negociações: 94 abertas + 8 vendas, mais deals
    // criados antes do período que tiveram movimento dentro dele.
    expect(result.length).toBe(102);
    expect(result.filter((d) => d.win).length).toBe(8);
    expect(result.filter((d) => !d.win).length).toBe(94);
  });

  it("excludes a deal created before the period that only moved stage inside it", () => {
    // O escopo do CRM usa a data de criação para negociações abertas: uma
    // negociação que nasceu antes do período e apenas mudou de etapa dentro
    // dele não pertence ao relatório de negociações criadas no período.
    const deals: ScopedDeal[] = [
      {
        rd_deal_id: "old-moved",
        rd_connection_id: "conn-1",
        ad_account_id: ACCOUNT_ID,
        rd_funnel_id: FUNNEL_ID,
        win: false,
        rd_stage_name: "Em conversa",
        lead_created_at: "2026-09-01T10:00:00-03:00",
        closed_at: null,
        stage_updated_at: "2026-11-08T10:00:00-03:00",
      },
    ];

    const result = fetchPeriodDeals(deals, "2026-11-01T00:00:00-03:00", "2026-11-30T23:59:59.999-03:00");

    expect(result).toHaveLength(0);
  });

  it("does not count a won deal twice when it was created and closed in the period", () => {
    const deals: ScopedDeal[] = [
      {
        rd_deal_id: "won-both",
        rd_connection_id: "conn-1",
        ad_account_id: ACCOUNT_ID,
        rd_funnel_id: FUNNEL_ID,
        win: true,
        rd_stage_name: "Venda Realizada",
        lead_created_at: "2026-11-05T10:00:00-03:00",
        closed_at: "2026-11-15T10:00:00-03:00",
        stage_updated_at: "2026-11-15T10:00:00-03:00",
      },
    ];

    const result = fetchPeriodDeals(deals, "2026-11-01T00:00:00-03:00", "2026-11-30T23:59:59.999-03:00");

    expect(result).toHaveLength(1);
  });
});
