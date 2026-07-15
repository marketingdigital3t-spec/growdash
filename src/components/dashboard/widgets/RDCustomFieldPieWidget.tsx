import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { useDashboard } from "@/contexts/DashboardContext";
import { useRDFieldConfigs, resolveBucket } from "@/hooks/useRDFieldConfigs";
import { useRDFieldDataAll } from "@/hooks/useRDFieldDataAll";

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(262, 83%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(180, 70%, 45%)",
  "hsl(330, 80%, 55%)",
  "hsl(50, 90%, 55%)",
];

const JAPP_REVENUE_ORDER = [
  "R$ 500 mil a R$ 1 milhão",
  "R$ 1 milhão a R$ 5 milhões",
  "R$ 5 milhões até R$ 10 milhões",
  "Acima de R$ 10 milhões",
];

const normalizeLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/:$/, "")
    .trim();

const JAPP_REVENUE_ORDER_MAP = new Map(
  JAPP_REVENUE_ORDER.map((label, index) => [normalizeLabel(label), index])
);

export function RDCustomFieldPieWidget() {
  const { adAccountId } = useDashboard();
  const { data: allConfigs = [] } = useRDFieldConfigs(adAccountId ?? null);
  const configs = useMemo(
    () => allConfigs.filter((c) => c.show_in_dashboard),
    [allConfigs],
  );
  const [fieldKey, setFieldKey] = useState<string>("");

  const cfg = configs.find((c) => c.key === fieldKey) ?? configs[0];
  const [mode, setMode] = useState<"leads" | "sales">("leads");
  const { data: fieldData } = useRDFieldDataAll(adAccountId ?? null, cfg?.key ?? null);
  const rdDeals = fieldData?.deals ?? [];
  const sales = fieldData?.sales ?? [];


  const { pieData, table } = useMemo(() => {
    if (!cfg) return { pieData: [], table: [] };
    const leadCounts: Record<string, number> = {};
    const saleCounts: Record<string, number> = {};

    for (const d of rdDeals) {
      const raw = d.custom_fields?.[cfg.key];
      const bucket = resolveBucket(cfg, raw);
      if (!bucket) continue;
      leadCounts[bucket] = (leadCounts[bucket] || 0) + 1;
    }
    for (const s of sales) {
      if (!s.rd_deal_id) continue;
      const raw = s.custom_fields?.[cfg.key];
      const bucket = resolveBucket(cfg, raw);
      if (!bucket) continue;
      saleCounts[bucket] = (saleCounts[bucket] || 0) + 1;
    }

    const buckets = new Set<string>([
      ...Object.keys(leadCounts),
      ...Object.keys(saleCounts),
      ...cfg.options.map((o) => o.label),
    ]);

    const data = Array.from(buckets).map((name) => ({
      name,
      leads: leadCounts[name] || 0,
      sales: saleCounts[name] || 0,
      value: mode === "leads" ? leadCounts[name] || 0 : saleCounts[name] || 0,
    }));

    const visible = data.filter((d) => d.value > 0);
    const totalLeads = data.reduce((s, d) => s + d.leads, 0);

    const optionOrder = cfg.options.map((o) => o.label);
    const isJappRevenueField = normalizeLabel(cfg.label).includes("faturamento [japp]");
    const parseRangeMin = (name: string): number => {
      const lower = name.toLowerCase();
      // Match all numbers in the string (handles "1.5", "1,5", "500")
      const nums = lower.match(/[\d]+(?:[.,]\d+)?/g)?.map((n) => parseFloat(n.replace(",", "."))) ?? [];
      if (nums.length === 0) return Number.MAX_SAFE_INTEGER;
      const first = nums[0];
      // Determine multiplier based on keywords
      let multiplier = 1;
      if (/milh[ãa]o|milh[õo]es/.test(lower)) multiplier = 1_000_000;
      else if (/mil\b/.test(lower)) multiplier = 1_000;
      return first * multiplier;
    };
    const orderIndex = (name: string) => {
      if (isJappRevenueField) {
        const fixedIndex = JAPP_REVENUE_ORDER_MAP.get(normalizeLabel(name));
        if (fixedIndex !== undefined) return fixedIndex;
      }

      const i = optionOrder.indexOf(name);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    // Prefer numeric range ordering when labels look like monetary ranges;
    // fall back to RD option order, then leads desc.
    const sortFn = (aName: string, bName: string, aTie: number, bTie: number) => {
      if (isJappRevenueField) {
        const oa = orderIndex(aName);
        const ob = orderIndex(bName);
        if (oa !== ob) return oa - ob;
        return bTie - aTie;
      }

      const va = parseRangeMin(aName);
      const vb = parseRangeMin(bName);
      if (va !== vb) return va - vb;
      const oa = orderIndex(aName);
      const ob = orderIndex(bName);
      if (oa !== ob) return oa - ob;
      return bTie - aTie;
    };

    const tableRows = data
      .filter((d) => d.leads > 0 || d.sales > 0)
      .map((d) => ({
        name: d.name,
        leads: d.leads,
        sales: d.sales,
        conv: d.leads > 0 ? (d.sales / d.leads) * 100 : 0,
        pct: totalLeads > 0 ? (d.leads / totalLeads) * 100 : 0,
      }))
      .sort((a, b) => sortFn(a.name, b.name, a.leads, b.leads));

    const sortedPie = [...visible].sort((a, b) =>
      sortFn(a.name, b.name, a.value, b.value)
    );

    return { pieData: sortedPie, table: tableRows };
  }, [cfg, rdDeals, sales, mode]);

  if (!adAccountId) {
    return (
      <Card className="h-full flex items-center justify-center text-sm text-muted-foreground p-6">
        Selecione uma conta para usar este widget.
      </Card>
    );
  }
  if (configs.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
        {allConfigs.length === 0 ? (
          <>Nenhum campo personalizado configurado.<br />Configure em Configurações → Campos personalizados do RD.</>
        ) : (
          <>Nenhum campo marcado para exibir no dashboard.<br />Ative "Exibir no dashboard" em Configurações → Campos personalizados do RD.</>
        )}
      </Card>
    );
  }

  const totalLeads = table.reduce((s, r) => s + r.leads, 0);
  const totalSales = table.reduce((s, r) => s + r.sales, 0);
  const overallConv = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <CardTitle className="text-sm font-medium">
            {cfg ? cfg.label : "Campo personalizado"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={cfg?.key ?? ""} onValueChange={setFieldKey}>
              <SelectTrigger className="h-7 w-[180px] text-xs">
                <SelectValue placeholder="Campo" />
              </SelectTrigger>
              <SelectContent>
                {configs.map((c) => (
                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs value={mode} onValueChange={(v: any) => setMode(v)}>
              <TabsList className="h-7">
                <TabsTrigger value="leads" className="h-5 text-xs">Leads</TabsTrigger>
                <TabsTrigger value="sales" className="h-5 text-xs">Vendas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
        <div className="min-h-[220px]">
          {pieData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Sem dados no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="45%"
                  outerRadius="80%"
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, _n, p: any) => {
                    const total = pieData.reduce((s, d) => s + d.value, 0);
                    const pct = total > 0 ? (v / total) * 100 : 0;
                    return [`${v} (${pct.toFixed(1)}%)`, p?.payload?.name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "hsl(var(--foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="min-h-[220px] overflow-auto">
          <table className="w-full min-w-[420px] text-sm text-foreground">
            <thead className="text-muted-foreground sticky top-0 bg-card">
              <tr className="text-left">
                <th className="py-2 font-medium">Faixa</th>
                <th className="py-2 font-medium text-right">Leads</th>
                <th className="py-2 font-medium text-right">Vendas</th>
                <th className="py-2 font-medium text-right">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.name} className="border-t border-border/60">
                  <td className="py-2 truncate max-w-[220px] text-foreground" title={r.name}>{r.name}</td>
                  <td className="py-2 text-right tabular-nums text-foreground">
                    {r.leads}{" "}
                    <span className="text-muted-foreground">({r.pct.toFixed(0)}%)</span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-foreground">{r.sales}</td>
                  <td className="py-2 text-right tabular-nums font-semibold text-foreground">
                    {r.conv.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {table.length > 0 && (
                <tr className="border-t border-border font-semibold text-foreground">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right tabular-nums">{totalLeads}</td>
                  <td className="py-2 text-right tabular-nums">{totalSales}</td>
                  <td className="py-2 text-right tabular-nums">{overallConv.toFixed(1)}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
