import { useState } from "react";
import { Pencil, Check, X, BarChart3, Filter } from "lucide-react";
import { DateFilterBar } from "@/components/dashboard/DateFilterBar";
import { FunnelChartView } from "@/components/funnel/FunnelChartView";
import { useDateFilter } from "@/hooks/useDateFilter";
import { useInsights } from "@/hooks/useInsights";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useCampaigns } from "@/hooks/useCampaigns";
import { aggregateMetrics } from "@/lib/metrics";
import { Button } from "@/components/ui/button";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/AnimatedNumber";

const FUNNEL_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(238, 60%, 60%)",
  "hsl(255, 55%, 58%)",
  "hsl(38, 85%, 55%)",
  "hsl(25, 90%, 55%)",
  "hsl(142, 60%, 50%)",
  "hsl(152, 55%, 45%)",
  "hsl(162, 50%, 42%)",
];

interface FunnelStep {
  label: string;
  numValue: number;
  isCurrency?: boolean;
  decimals?: number;
  secondaryLabel?: string;
  secondaryNumValue?: number;
  secondaryCurrency?: boolean;
  secondaryDecimals?: number;
  widthPercent: number;
  color: string;
  editable?: boolean;
}

function formatCurrency(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(v: number) {
  return v.toLocaleString("pt-BR");
}

function EditableValue({
  value,
  onSave,
  isCurrency,
}: {
  value: string;
  onSave: (val: string) => void;
  isCurrency?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(""); setEditing(true); }}
        className="p-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        title="Editar"
      >
        <Pencil className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {isCurrency && <span className="text-xs text-muted-foreground">R$</span>}
      <input
        autoFocus
        type="number"
        step="any"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-24 h-7 rounded border border-input bg-background px-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        onClick={() => { onSave(draft); setEditing(false); }}
        className="p-1 rounded hover:bg-emerald-500/10 text-emerald-600 transition-colors"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setEditing(false)}
        className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const Funnel = () => {
  const [viewMode, setViewMode] = useState<"funnel" | "chart">("funnel");
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const { preset, setPreset, customRange, setCustomRange, startDate, endDate } = useDateFilter();
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const { data: adAccounts = [] } = useAdAccounts();
  const { data: campaigns = [] } = useCampaigns(selectedAccount === "all" ? undefined : selectedAccount);
  const hasAccountSelected = selectedAccount !== "all";

  const { data: insights = [], isLoading, refetch } = useInsights({
    adAccountId: hasAccountSelected ? selectedAccount : undefined,
    campaignIds: selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined,
    startDate,
    endDate,
    enabled: hasAccountSelected,
  });

  const [manualSales, setManualSales] = useState<number | null>(null);
  const [manualRevenue, setManualRevenue] = useState<number | null>(null);

  const metrics = aggregateMetrics(insights);

  const totalClicks = insights.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = insights.reduce((s, r) => s + r.impressions, 0);
  const totalReach = insights.reduce((s, r) => s + r.reach, 0);

  const cpc = totalClicks > 0 ? metrics.totalSpend / totalClicks : 0;
  const cpv = totalReach > 0 ? metrics.totalSpend / totalReach : 0;

  const salesValue = manualSales ?? 0;
  const revenueValue = manualRevenue ?? 0;
  const cpa = salesValue > 0 ? metrics.totalSpend / salesValue : 0;
  const roas = metrics.totalSpend > 0 ? revenueValue / metrics.totalSpend : 0;

  const steps: FunnelStep[] = [
    { label: "VALOR GASTO", numValue: metrics.totalSpend, isCurrency: true, widthPercent: 100, color: FUNNEL_COLORS[0] },
    { label: "IMPRESSÕES", numValue: totalImpressions, decimals: 0, secondaryLabel: "CPM", secondaryNumValue: metrics.avgCPM, secondaryCurrency: true, widthPercent: 90, color: FUNNEL_COLORS[1] },
    { label: "CLIQUES", numValue: totalClicks, decimals: 0, secondaryLabel: "CPC", secondaryNumValue: cpc, secondaryCurrency: true, widthPercent: 78, color: FUNNEL_COLORS[2] },
    { label: "VISITAS TOTAIS", numValue: totalReach, decimals: 0, secondaryLabel: "CPV", secondaryNumValue: cpv, secondaryCurrency: true, widthPercent: 66, color: FUNNEL_COLORS[3] },
    { label: "LEADS (MQL+SQL)", numValue: metrics.totalLeads, decimals: 0, secondaryLabel: "CPLMQL", secondaryNumValue: metrics.avgCPL, secondaryCurrency: true, widthPercent: 54, color: FUNNEL_COLORS[4] },
    { label: "LEADS (SQL)", numValue: metrics.totalLeads, decimals: 0, secondaryLabel: "CPL", secondaryNumValue: metrics.avgCPL, secondaryCurrency: true, widthPercent: 42, color: FUNNEL_COLORS[5] },
    { label: "VENDAS", numValue: salesValue, decimals: 0, secondaryLabel: "CPA", secondaryNumValue: cpa, secondaryCurrency: true, widthPercent: 30, color: FUNNEL_COLORS[6], editable: true },
    { label: "RECEITA", numValue: revenueValue, isCurrency: true, secondaryLabel: "ROAS", secondaryNumValue: roas, secondaryDecimals: 2, widthPercent: 18, color: FUNNEL_COLORS[7], editable: true },
  ];

  return (
    <MotionPage className="space-y-6">
      <MotionItem>
        <h1 className="text-2xl font-bold">Funil de Conversão</h1>
        <p className="text-sm text-muted-foreground mt-1">Desempenho de campanhas em formato de funil</p>
      </MotionItem>

      <MotionItem>
        <DateFilterBar
          preset={preset}
          onPresetChange={setPreset}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          startDate={startDate}
          endDate={endDate}
          adAccounts={adAccounts.map((a) => ({ id: a.id, name: a.name }))}
          selectedAccount={selectedAccount}
          onAccountChange={(id) => { setSelectedAccount(id); setSelectedCampaignIds([]); }}
          campaigns={campaigns?.map((c) => ({ id: c.id, name: c.name })) || []}
          selectedCampaignIds={selectedCampaignIds}
          onCampaignIdsChange={setSelectedCampaignIds}
          onRefresh={() => refetch()}
          isRefreshing={isLoading}
        />
      </MotionItem>

      <MotionItem>
        <div className="rounded-xl border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold">Desempenho de campanhas</h2>
            <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
              <Button variant={viewMode === "funnel" ? "default" : "ghost"} size="sm" className="h-7 px-3 text-xs" onClick={() => setViewMode("funnel")}>
                <Filter className="h-3.5 w-3.5 mr-1" /> Funil
              </Button>
              <Button variant={viewMode === "chart" ? "default" : "ghost"} size="sm" className="h-7 px-3 text-xs" onClick={() => setViewMode("chart")}>
                <BarChart3 className="h-3.5 w-3.5 mr-1" /> Gráfico
              </Button>
            </div>
          </div>

          {viewMode === "chart" ? (
            <FunnelChartView
              insights={insights}
              totalSpend={metrics.totalSpend}
              totalImpressions={totalImpressions}
              totalClicks={totalClicks}
              totalReach={totalReach}
              totalLeads={metrics.totalLeads}
              salesValue={salesValue}
              revenueValue={revenueValue}
            />
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden sm:flex flex-col gap-1">
                {steps.map((step, i) => (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
                    className="relative flex items-stretch"
                    style={{ minHeight: "62px" }}
                  >
                    <motion.div
                      className="rounded-r-lg flex-shrink-0"
                      style={{ minWidth: "12px", backgroundColor: step.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${step.widthPercent * 0.32}%` }}
                      transition={{ duration: 0.5, delay: i * 0.05 + 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                    />
                    <div className="w-2 flex-shrink-0" />
                    <div className="relative flex-1 flex items-center gap-6 rounded-lg border bg-card shadow-sm px-6 py-3.5 z-10 overflow-visible">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase whitespace-nowrap">{step.label}</p>
                        <p className="text-xl font-bold text-foreground mt-1 whitespace-nowrap">
                          <AnimatedNumber value={step.numValue} prefix={step.isCurrency ? "R$ " : ""} decimals={step.decimals ?? 2} duration={600} />
                        </p>
                      </div>
                      {step.secondaryLabel && (
                        <div className="text-right flex-shrink-0 border-l border-border pl-5">
                          <p className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase whitespace-nowrap">{step.secondaryLabel}</p>
                          <p className="text-lg font-bold text-foreground mt-1 whitespace-nowrap">
                            <AnimatedNumber value={step.secondaryNumValue!} prefix={step.secondaryCurrency ? "R$ " : ""} decimals={step.secondaryDecimals ?? 2} duration={600} />
                          </p>
                        </div>
                      )}
                      {step.editable && (
                        <div className="flex-shrink-0">
                          <EditableValue
                            value={String(step.numValue)}
                            isCurrency={step.label === "RECEITA"}
                            onSave={(val) => {
                              const num = parseFloat(val) || 0;
                              if (step.label === "VENDAS") setManualSales(num > 0 ? num : null);
                              if (step.label === "RECEITA") setManualRevenue(num > 0 ? num : null);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Mobile */}
              <div className="flex sm:hidden flex-col gap-0">
                {steps.map((step, i) => {
                  const barWidth = step.widthPercent;
                  const isExpanded = expandedStep === step.label;
                  return (
                    <motion.div
                      key={step.label}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
                      className="relative"
                      style={{ minHeight: "52px" }}
                    >
                      <motion.div
                        className="absolute left-0 top-0 bottom-0 rounded-r-md"
                        style={{ minWidth: "16px", backgroundColor: step.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth * 0.7}%` }}
                        transition={{ duration: 0.45, delay: i * 0.04 + 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2 rounded-md border bg-card shadow-sm px-3 py-2 z-10 min-w-0 cursor-pointer transition-all duration-300 ease-in-out"
                        style={{ right: "8px", left: isExpanded ? "8px" : `${barWidth * 0.7 + 3}%` }}
                        onClick={() => setExpandedStep(isExpanded ? null : step.label)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-medium text-muted-foreground tracking-wide uppercase truncate">{step.label}</p>
                          <p className="text-sm font-bold text-foreground mt-0.5 truncate">
                            <AnimatedNumber value={step.numValue} prefix={step.isCurrency ? "R$ " : ""} decimals={step.decimals ?? 2} duration={600} />
                          </p>
                        </div>
                        {step.secondaryLabel && (
                          <div className="text-right flex-shrink-0 border-l border-border pl-2">
                            <p className="text-[9px] font-medium text-muted-foreground tracking-wide">{step.secondaryLabel}</p>
                            <p className="text-xs font-semibold text-foreground mt-0.5">
                              <AnimatedNumber value={step.secondaryNumValue!} prefix={step.secondaryCurrency ? "R$ " : ""} decimals={step.secondaryDecimals ?? 2} duration={600} />
                            </p>
                          </div>
                        )}
                        {step.editable && isExpanded && (
                          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <EditableValue
                              value={String(step.numValue)}
                              isCurrency={step.label === "RECEITA"}
                              onSave={(val) => {
                                const num = parseFloat(val) || 0;
                                if (step.label === "VENDAS") setManualSales(num > 0 ? num : null);
                                if (step.label === "RECEITA") setManualRevenue(num > 0 ? num : null);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </MotionItem>
    </MotionPage>
  );
};

export default Funnel;
