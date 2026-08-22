import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type CampaignTotalColumn = {
  key: string;
  label: string;
  type: "text" | "number" | "currency" | "percentage" | "ratio";
  width: number;
  visible: boolean;
};

type CampaignLike = Record<string, unknown> & {
  results?: { total?: number; leadCount?: number; conversations?: number };
};

type Totals = {
  budget: number; spend: number; impressions: number; reach: number; clicks: number;
  linkClicks: number; uniqueLinkClicks: number; results: number; formLeads: number;
  conversations: number; sales: number; revenue: number; profit: number;
  landingPageViews: number; checkouts: number; metaPurchases: number; metaPurchaseValue: number;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const safe = (value: unknown) => Math.max(0, Number(value) || 0);
const ratio = (numerator: number, denominator: number, multiplier = 1) => denominator > 0 ? numerator / denominator * multiplier : 0;
const decimal = (value: number, suffix = "") => `${value.toFixed(2).replace(".", ",")}${suffix}`;

function getTotals(rows: CampaignLike[]): Totals {
  return rows.reduce<Totals>((total, row) => {
    const resultTotal = safe(row.results?.total ?? row.leads);
    const formLeads = safe(row.results?.leadCount ?? row.leads);
    const spend = safe(row.spend);
    return {
      budget: total.budget + safe(row.budget), spend: total.spend + spend,
      impressions: total.impressions + safe(row.impressions), reach: total.reach + safe(row.reach),
      clicks: total.clicks + safe(row.clicks), linkClicks: total.linkClicks + safe(row.linkClicks),
      uniqueLinkClicks: total.uniqueLinkClicks + safe(row.uniqueLinkClicks), results: total.results + resultTotal,
      formLeads: total.formLeads + formLeads, conversations: total.conversations + safe(row.results?.conversations),
      sales: total.sales + safe(row.salesCount), revenue: total.revenue + safe(row.revenue),
      profit: total.profit + safe(row.profit), landingPageViews: total.landingPageViews + safe(row.landingPageViews),
      checkouts: total.checkouts + safe(row.checkouts), metaPurchases: total.metaPurchases + safe(row.metaPurchases),
      metaPurchaseValue: total.metaPurchaseValue + safe(row.metaPurchaseRoas) * spend,
    };
  }, { budget: 0, spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, uniqueLinkClicks: 0, results: 0, formLeads: 0, conversations: 0, sales: 0, revenue: 0, profit: 0, landingPageViews: 0, checkouts: 0, metaPurchases: 0, metaPurchaseValue: 0 });
}

function TotalCell({ column, value, detail, stickyLeft, divider }: { column: CampaignTotalColumn; value?: string; detail?: string; stickyLeft?: number; divider?: boolean }) {
  return <TableCell style={{ width: column.width, minWidth: column.width, maxWidth: column.width, ...(stickyLeft === undefined ? {} : { left: stickyLeft }) }} className={cn("border-r border-primary/15 bg-[#0a0a09] px-3 py-1 tabular-nums dark:bg-[#070706]", column.type === "text" ? "text-left" : "text-right", stickyLeft !== undefined && "sticky z-20", divider && "border-r border-border shadow-[8px_0_14px_-14px_rgba(0,0,0,.9)]")}>
    {value && <strong className="block truncate text-sm font-semibold text-foreground">{value}</strong>}
    {detail && <span className="mt-0.5 block truncate text-[10px] font-medium leading-tight text-muted-foreground">{detail}</span>}
  </TableCell>;
}

function totalValue(key: string, totals: Totals) {
  switch (key) {
    case "reach": return [integer.format(totals.reach), "Total"];
    case "impressions": return [integer.format(totals.impressions), "Total"];
    case "frequency": return [decimal(ratio(totals.impressions, totals.reach)), "Média"];
    case "linkClicks": return [integer.format(totals.linkClicks), "Total"];
    case "linkCpc": return [money.format(ratio(totals.spend, totals.linkClicks)), "Por clique no link"];
    case "uniqueLinkCtr": return [decimal(ratio(totals.uniqueLinkClicks, totals.reach, 100), "%"), "Taxa total"];
    case "cpm": return [money.format(ratio(totals.spend, totals.impressions, 1000)), "Por 1.000 impressões"];
    case "budget": return [money.format(totals.budget), "Orçamento somado"];
    case "cpl": return [money.format(ratio(totals.spend, totals.results)), "Por resultado"];
    case "spend": return [money.format(totals.spend), "Total usado"];
    case "landingPageViews": return [integer.format(totals.landingPageViews), "Total"];
    case "costPerLandingPageView": return [money.format(ratio(totals.spend, totals.landingPageViews)), "Por visualização"];
    case "checkouts": return [integer.format(totals.checkouts), "Total"];
    case "costPerCheckout": return [money.format(ratio(totals.spend, totals.checkouts)), "Por finalização"];
    case "metaPurchases": return [integer.format(totals.metaPurchases), "Total"];
    case "metaCostPerPurchase": return [money.format(ratio(totals.spend, totals.metaPurchases)), "Por compra"];
    case "metaPurchaseRoas": return [decimal(ratio(totals.metaPurchaseValue, totals.spend), "x"), "Retorno total"];
    case "clicks": return [integer.format(totals.clicks), "Total"];
    case "cpc": return [money.format(ratio(totals.spend, totals.clicks)), "Por clique"];
    case "ctr": return [decimal(ratio(totals.clicks, totals.impressions, 100), "%"), "Taxa total"];
    case "conversion": return [decimal(ratio(totals.sales, totals.results, 100), "%"), "Taxa total"];
    case "sales": return [integer.format(totals.sales), "Total"];
    case "cpa": return [money.format(ratio(totals.spend, totals.sales)), "Por venda"];
    case "revenue": return [money.format(totals.revenue), "Valor total"];
    case "roas": return [decimal(ratio(totals.revenue, totals.spend), "x"), "Retorno total"];
    case "profit": return [money.format(totals.profit), "Total"];
    case "roi": return [decimal(ratio(totals.profit, totals.spend, 100), "%"), "Retorno total"];
    default: return ["—", undefined];
  }
}

export function BarraTotais({ rows, columns, scrollContainerRef }: { rows: CampaignLike[]; columns: CampaignTotalColumn[]; scrollContainerRef: RefObject<HTMLDivElement | null> }) {
  const totals = useMemo(() => getTotals(rows), [rows]);
  const visible = useMemo(() => columns.filter((column) => column.visible), [columns]);
  const leadingColumns = useMemo(() => visible.filter((column) => column.key === "check" || column.key === "delivery" || column.key === "name"), [visible]);
  const leadingWidth = useMemo(() => leadingColumns.reduce((sum, column) => sum + column.width, 0), [leadingColumns]);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const source = scrollContainerRef.current;
    const bar = barRef.current;
    if (!source || !bar) return;
    const syncHorizontalScroll = () => { bar.scrollLeft = source.scrollLeft; };
    syncHorizontalScroll();
    source.addEventListener("scroll", syncHorizontalScroll, { passive: true });
    return () => source.removeEventListener("scroll", syncHorizontalScroll);
  }, [scrollContainerRef]);

  // This is deliberately not a second scroll area. The campaigns viewport is
  // the single source of horizontal scrolling; assigning scrollLeft below
  // mirrors that offset while this footer itself remains permanently visible.
  return <div ref={barRef} className="campaign-total-bar block h-16 min-h-16 shrink-0 overflow-hidden border-t border-primary/30 bg-[#0a0a09] shadow-[0_-10px_24px_-18px_rgba(255,193,7,.55)]" aria-label="Totais das campanhas filtradas">
    <table className="w-full caption-bottom text-sm" style={{ tableLayout: "fixed", width: "max-content" }}><tbody><TableRow className="h-16 border-0 bg-[#0a0a09] hover:bg-[#0a0a09] dark:bg-[#070706] dark:hover:bg-[#070706]">
      {visible.map((column) => {
        if (column.key === "check") return <TableCell key="campaign-results-summary" style={{ width: leadingWidth, minWidth: leadingWidth, maxWidth: leadingWidth, left: 0 }} className="sticky z-20 border-r border-primary/15 bg-[#0a0a09] px-3 py-1 text-left shadow-[8px_0_14px_-14px_rgba(0,0,0,.9)] dark:bg-[#070706]">
          <strong className="block truncate text-sm font-semibold text-foreground">Resultados de {rows.length} campanhas</strong>
          <span className="mt-0.5 block truncate text-[10px] font-medium leading-tight text-muted-foreground">Totais do período e filtros</span>
        </TableCell>;
        if (column.key === "delivery" || column.key === "name") return null;
        if (column.key === "leads") return <TableCell key={column.key} style={{ width: column.width, minWidth: column.width, maxWidth: column.width }} className="border-r border-primary/15 bg-[#0a0a09] px-3 py-1 text-right tabular-nums dark:bg-[#070706]"><Tooltip><TooltipTrigger asChild><button type="button" className="ml-auto block max-w-full rounded px-1 text-right hover:bg-primary/10"><strong className="block truncate text-sm font-semibold text-foreground">{integer.format(totals.results)} leads</strong><span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">Ver composição</span></button></TooltipTrigger><TooltipContent><p>{integer.format(totals.conversations)} conversas iniciadas · {integer.format(totals.formLeads)} forms/site</p></TooltipContent></Tooltip></TableCell>;
        const [value, detail] = totalValue(column.key, totals);
        return <TotalCell key={column.key} column={column} value={value} detail={detail} />;
      })}
    </TableRow></tbody></table>
  </div>;
}
