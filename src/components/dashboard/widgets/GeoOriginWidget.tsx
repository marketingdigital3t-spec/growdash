import { useMemo, useState } from "react";
import { Users, CheckCircle2, Percent, MapPin, DollarSign, ShoppingCart, TrendingUp, AlertCircle, Lightbulb, ListChecks } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Cell } from "recharts";
import { BrazilMap } from "@/components/dashboard/BrazilMap";
import { LeadsAuditSheet } from "@/components/dashboard/LeadsAuditSheet";
import { useDashboard } from "@/contexts/DashboardContext";
import { useLeadsByState, UF_TO_NAME, type StateRow } from "@/hooks/useLeadsByState";

type Mode = "leads" | "sales";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}
function fmtNum(v: number) { return v.toLocaleString("pt-BR"); }
function fmtPct(v: number) { return `${v.toFixed(1).replace(".", ",")}%`; }

function KpiCard({ icon: Icon, title, value, footer, scheme }: { icon: any; title: string; value: string; footer: string; scheme: "blue" | "green" | "violet" | "emerald" }) {
  const bg = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-teal-50 text-teal-600",
  }[scheme];
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`h-9 w-9 rounded-full flex items-center justify-center ${bg}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          <p className="text-xl font-bold mt-0.5">{value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{footer}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function GeoOriginWidget() {
  const { startDate, endDate, adAccountId } = useDashboard();
  const [mode, setMode] = useState<Mode>("leads");
  const [auditOpen, setAuditOpen] = useState(false);
  const { data, isLoading } = useLeadsByState({ startDate, endDate, adAccountId });
  const rows: StateRow[] = data?.rows || [];
  const hasRegionData = data?.hasRegionData ?? false;

  const totals = useMemo(() => {
    const t = rows.reduce(
      (acc, r) => {
        acc.leads += r.leads;
        acc.spend += r.spend;
        acc.sales += r.sales;
        acc.revenue += r.revenue;
        return acc;
      },
      { leads: 0, spend: 0, sales: 0, revenue: 0 }
    );
    // Real lead total comes from canonical coverage (meta_leads count), not from UF-grouped rows
    const realLeads = data?.coverage?.total ?? t.leads;
    return {
      ...t,
      leads: realLeads,
      cpl: realLeads > 0 ? t.spend / realLeads : 0,
      cpa: t.sales > 0 ? t.spend / t.sales : 0,
      conv_rate: realLeads > 0 ? (t.sales / realLeads) * 100 : 0,
      ticket_medio: t.sales > 0 ? t.revenue / t.sales : 0,
      activeStates: rows.filter((r) => (mode === "leads" ? r.leads > 0 : r.sales > 0)).length,
    };
  }, [rows, mode, data?.coverage?.total]);


  const mapData = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.uf] = mode === "leads" ? r.leads : r.sales;
    return m;
  }, [rows, mode]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => (mode === "leads" ? b.leads - a.leads : b.sales - a.sales));
  }, [rows, mode]);

  const barData = sortedRows.slice(0, 7).map((r) => ({
    name: UF_TO_NAME[r.uf] || r.uf,
    value: mode === "leads" ? r.sales : r.revenue,
  }));

  const insightTop = sortedRows[0];
  const colorScheme = mode === "leads" ? "brand" : "green";
  const accentBar = mode === "leads" ? "hsl(142, 71%, 45%)" : "hsl(142, 71%, 45%)";

  // Empty / explanation state
  const showLeadsEmpty = mode === "leads" && !isLoading && !hasRegionData && totals.leads === 0;
  const showSalesEmpty = mode === "sales" && !isLoading && totals.sales === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Origem geográfica
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <AlertCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      <strong>Leads</strong> vêm do Meta (formulário instantâneo + conversão na LP) com breakdown por estado.{" "}
                      <strong>Vendas</strong> vêm do RD Station (campo "Estado" do contato).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "leads" ? "Origem dos leads e custo por estado" : "Distribuição de vendas e receita por estado"}
            </p>
          </div>
          <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as Mode)} size="sm">
            <ToggleGroupItem value="leads" aria-label="Leads">Leads</ToggleGroupItem>
            <ToggleGroupItem value="sales" aria-label="Vendas">Vendas</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPIs */}
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="gd-auto-grid-compact gap-3"
        >
          {mode === "leads" ? (
            <>
              <KpiCard icon={Users} scheme="blue" title="Leads totais" value={fmtNum(totals.leads)} footer="100% do período" />
              <KpiCard icon={CheckCircle2} scheme="green" title="Conversões" value={fmtNum(totals.sales)} footer="100% do período" />
              <KpiCard icon={Percent} scheme="violet" title="Taxa de conversão" value={fmtPct(totals.conv_rate)} footer="Média do período" />
              <KpiCard icon={MapPin} scheme="emerald" title="Estados ativos" value={String(totals.activeStates)} footer="De 27 estados" />
            </>
          ) : (
            <>
              <KpiCard icon={ShoppingCart} scheme="green" title="Vendas totais" value={fmtNum(totals.sales)} footer="100% do período" />
              <KpiCard icon={DollarSign} scheme="emerald" title="Receita total" value={fmtBRL(totals.revenue)} footer="Líquida do período" />
              <KpiCard icon={TrendingUp} scheme="violet" title="Ticket médio" value={fmtBRL(totals.ticket_medio)} footer="Por venda" />
              <KpiCard icon={MapPin} scheme="blue" title="Estados c/ venda" value={String(totals.activeStates)} footer="De 27 estados" />
            </>
          )}
        </motion.div>

        {/* Mapa + tabela */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div key={`map-${mode}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
            {showLeadsEmpty || showSalesEmpty ? (
              <Card className="h-full">
                <CardContent className="h-full min-h-[260px] flex flex-col items-center justify-center text-center gap-2 px-6">
                  <AlertCircle className="h-7 w-7 text-muted-foreground" />
                  <p className="text-sm font-medium">Sem dados por estado neste período</p>
                  <p className="text-xs text-muted-foreground max-w-md">
                    {mode === "leads"
                      ? 'O detalhamento por estado vem do Meta (breakdown "região"). Vá em Configurações → "Backfill 2026" e rode a sincronização para popular o histórico de todas as contas.'
                      : "Nenhuma venda com estado preenchido foi recebida do RD Station. Verifique se o campo \"Estado\" está sendo enviado no contato."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <BrazilMap
                data={mapData}
                colorScheme={colorScheme}
                metricLabel={mode === "leads" ? "leads" : "vendas"}
                title={mode === "leads" ? "Leads por estado" : "Vendas por estado"}
                subtitle={`${(mode === "leads" ? totals.leads : totals.sales).toLocaleString("pt-BR")} ${mode === "leads" ? "leads" : "vendas"} em ${totals.activeStates} estados`}
                source={mode === "leads" ? data?.source : undefined}
                coverage={mode === "leads" ? data?.coverage : undefined}
              />
            )}
          </motion.div>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                  Todos os estados ({sortedRows.filter((r) => (mode === "leads" ? r.leads > 0 : r.sales > 0)).length})
                </CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">Ordenado por {mode === "leads" ? "leads" : "vendas"} decrescente</p>
              </div>
              {mode === "leads" && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAuditOpen(true)}>
                  <ListChecks className="h-3 w-3 mr-1" /> Auditar leads
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[680px] text-xs">
                  <thead className="sticky top-0 bg-background z-10">
                    <tr className="text-muted-foreground border-b">
                      <th className="text-left font-medium py-2 px-3">#</th>
                      <th className="text-left font-medium py-2 px-3">Estado</th>
                      {mode === "leads" ? (
                        <>
                          <th className="text-right font-medium py-2 px-3">Leads</th>
                          <th className="text-right font-medium py-2 px-3">CPL</th>
                          <th className="text-right font-medium py-2 px-3">Conv.</th>
                          <th className="text-right font-medium py-2 px-3">CPA</th>
                          <th className="text-right font-medium py-2 px-3">Tx. conv.</th>
                        </>
                      ) : (
                        <>
                          <th className="text-right font-medium py-2 px-3">Vendas</th>
                          <th className="text-right font-medium py-2 px-3">Receita</th>
                          <th className="text-right font-medium py-2 px-3">Ticket</th>
                          <th className="text-right font-medium py-2 px-3">% rec.</th>
                          <th className="text-right font-medium py-2 px-3">CPA</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.filter((r) => (mode === "leads" ? r.leads > 0 : r.sales > 0)).length === 0 && (
                      <tr><td colSpan={7} className="text-center text-muted-foreground py-6">Sem dados</td></tr>
                    )}
                    {sortedRows
                      .filter((r) => (mode === "leads" ? r.leads > 0 : r.sales > 0))
                      .map((r, i) => (
                      <tr key={r.uf} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2 px-3">
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${mode === "leads" ? "bg-blue-500" : "bg-emerald-500"}`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium">{UF_TO_NAME[r.uf] || r.uf}</td>
                        {mode === "leads" ? (
                          <>
                            <td className="text-right py-2 px-3">{fmtNum(r.leads)}</td>
                            <td className="text-right py-2 px-3">{r.leads > 0 ? fmtBRL(r.cpl) : "—"}</td>
                            <td className="text-right py-2 px-3">{fmtNum(r.sales)}</td>
                            <td className="text-right py-2 px-3">{r.sales > 0 ? fmtBRL(r.cpa) : "—"}</td>
                            <td className="text-right py-2 px-3">{r.leads > 0 ? fmtPct(r.conv_rate) : "—"}</td>
                          </>
                        ) : (
                          <>
                            <td className="text-right py-2 px-3">{fmtNum(r.sales)}</td>
                            <td className="text-right py-2 px-3">{fmtBRL(r.revenue)}</td>
                            <td className="text-right py-2 px-3">{r.sales > 0 ? fmtBRL(r.ticket_medio) : "—"}</td>
                            <td className="text-right py-2 px-3">{totals.revenue > 0 ? fmtPct((r.revenue / totals.revenue) * 100) : "—"}</td>
                            <td className="text-right py-2 px-3">{r.sales > 0 ? fmtBRL(r.cpa) : "—"}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <LeadsAuditSheet
          open={auditOpen}
          onOpenChange={setAuditOpen}
          adAccountId={adAccountId}
          startDate={startDate}
          endDate={endDate}
        />

        {/* Bar chart + insight */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {mode === "leads" ? "Conversões por estado" : "Receita por estado"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 16, right: 8, bottom: 8, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => mode === "leads" ? String(v) : `R$${(v / 1000).toFixed(0)}k`} />
                    <RTooltip formatter={(v: any) => mode === "leads" ? fmtNum(Number(v)) : fmtBRL(Number(v))} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {barData.map((_, i) => <Cell key={i} fill={accentBar} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50/60 border-emerald-100">
            <CardContent className="p-4 flex items-start gap-3 h-full">
              <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-emerald-900">Insight</p>
                {insightTop ? (
                  <p className="text-emerald-800 mt-1 leading-relaxed">
                    <strong>{UF_TO_NAME[insightTop.uf] || insightTop.uf}</strong>{" "}
                    {mode === "leads"
                      ? `lidera em volume de leads (${fmtNum(insightTop.leads)}) com CPL de ${fmtBRL(insightTop.cpl)}.`
                      : `responde por ${totals.revenue > 0 ? fmtPct((insightTop.revenue / totals.revenue) * 100) : "0%"} da receita do período (${fmtBRL(insightTop.revenue)}).`}
                  </p>
                ) : (
                  <p className="text-emerald-800/70 mt-1">Sem dados suficientes para gerar insight.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
