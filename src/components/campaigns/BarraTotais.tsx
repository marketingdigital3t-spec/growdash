import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TableCell, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type ResultMetric = "conversations" | "leads";

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
  return <TableCell style={{ width: column.width, minWidth: column.width, maxWidth: column.width, ...(stickyLeft === undefined ? {} : { left: stickyLeft }) }} className={cn("border-r border-primary/15 bg-card px-3 py-1 tabular-nums", column.type === "text" ? "text-left" : "text-right", stickyLeft !== undefined && "sticky z-20", divider && "border-r border-border shadow-[8px_0_14px_-14px_rgba(0,0,0,.22)]")}>
    {value && <strong className="block truncate text-sm font-semibold text-foreground">{value}</strong>}
    {detail && <span className="mt-0.5 block truncate text-[10px] font-medium leading-tight text-muted-foreground">{detail}</span>}
  </TableCell>;
}

function totalValue(key: string, totals: Totals, selectedResultTotal: number) {
  switch (key) {
    case "reach": return [integer.format(totals.reach), "Total"];
    case "impressions": return [integer.format(totals.impressions), "Total"];
    case "frequency": return [decimal(ratio(totals.impressions, totals.reach)), "Média"];
    case "linkClicks": return [integer.format(totals.linkClicks), "Total"];
    case "linkCpc": return [money.format(ratio(totals.spend, totals.linkClicks)), "Por clique no link"];
    case "uniqueLinkCtr": return [decimal(ratio(totals.uniqueLinkClicks, totals.reach, 100), "%"), "Taxa total"];
    case "cpm": return [money.format(ratio(totals.spend, totals.impressions, 1000)), "Por 1.000 impressões"];
    case "budget": return [money.format(totals.budget), "Orçamento somado"];
    case "cpl": return [money.format(ratio(totals.spend, selectedResultTotal)), "Por resultado"];
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
    case "conversion": return [decimal(ratio(totals.sales, selectedResultTotal, 100), "%"), "Taxa total"];
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
  const [resultMetric, setResultMetric] = useState<ResultMetric>("conversations");
  const selectedResultTotal = resultMetric === "conversations" ? totals.conversations : totals.formLeads;
  const visible = useMemo(() => columns.filter((column) => column.visible), [columns]);
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
  return <div ref={barRef} className="campaign-total-bar relative z-40 block h-14 min-h-14 w-full shrink-0 overflow-hidden border-t border-primary/30" aria-label="Totais das campanhas filtradas">
    <table className="w-full caption-bottom text-sm" style={{ tableLayout: "fixed", width: "max-content" }}><tbody><TableRow className="h-14 border-0 bg-transparent hover:bg-transparent">
      {visible.map((column) => {
        if (column.key === "check") return <TableCell key={column.key} style={{ width: column.width, minWidth: column.width, maxWidth: column.width, left: 0 }} className="sticky z-20 border-r border-primary/15 bg-card px-3 py-1" />;
        if (column.key === "delivery") return <TableCell key={column.key} style={{ width: column.width, minWidth: column.width, maxWidth: column.width, left: column.width * 0 + visible.find((item) => item.key === "check")!.width }} className="sticky z-20 border-r border-primary/15 bg-card px-3 py-1" />;
        if (column.key === "name") {
          const checkWidth = visible.find((item) => item.key === "check")!.width;
          const deliveryWidth = visible.find((item) => item.key === "delivery")!.width;
          return <TableCell key={column.key} style={{ width: column.width, minWidth: column.width, maxWidth: column.width, left: checkWidth + deliveryWidth }} className="sticky z-20 border-r border-border bg-card px-3 py-1 text-left shadow-[8px_0_14px_-14px_rgba(0,0,0,.22)]"><strong className="block truncate text-sm font-semibold text-foreground">Totais ({rows.length})</strong><span className="mt-0.5 block truncate text-[10px] font-medium leading-tight text-muted-foreground">Linhas visíveis após filtros e busca</span></TableCell>;
        }
        if (column.key === "leads") return <TableCell key={column.key} style={{ width: column.width, minWidth: column.width, maxWidth: column.width }} className="border-r border-primary/15 bg-card px-3 py-1 text-right tabular-nums"><Tooltip><TooltipTrigger asChild><span tabIndex={0} className="ml-auto block max-w-full rounded px-1 text-right outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/60"><strong className="block truncate text-sm font-semibold text-foreground">{integer.format(selectedResultTotal)}</strong></span></TooltipTrigger><TooltipContent><p>{integer.format(totals.conversations)} conversas iniciadas · {integer.format(totals.formLeads)} forms/site</p></TooltipContent></Tooltip><Select value={resultMetric} onValueChange={(value) => setResultMetric(value as ResultMetric)}><SelectTrigger aria-label="Métrica de resultado exibida" className="ml-auto mt-0.5 h-5 w-full max-w-[150px] border-0 bg-transparent px-1 text-[10px] font-medium text-muted-foreground shadow-none hover:bg-primary/10 focus:ring-1 focus:ring-primary/60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="conversations">Conversas iniciadas</SelectItem><SelectItem value="leads">Leads</SelectItem></SelectContent></Select></TableCell>;
        const [value, detail] = totalValue(column.key, totals, selectedResultTotal);
        return <TotalCell key={column.key} column={column} value={value} detail={detail} />;
      })}
    </TableRow></tbody></table>
  </div>;
}
