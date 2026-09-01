import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, EyeOff, OctagonAlert, Radar, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { EventClassWithCounts } from "@/hooks/useEventClasses";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import type { InsightRow } from "@/hooks/useInsights";
import { buildDecisionAlerts, type DecisionAlert, type DecisionAlertSeverity } from "@/lib/decisionAlerts";
import { FunnelAutoInsights } from "@/components/funnel-analysis/FunnelAutoInsights";

const columns: Array<{ severity: DecisionAlertSeverity; label: string; className: string; Icon: typeof AlertTriangle }> = [
  { severity: "critical", label: "Crítico", className: "border-red-500/35 bg-red-500/[.06] text-red-500", Icon: OctagonAlert },
  { severity: "attention", label: "Atenção", className: "border-amber-500/35 bg-amber-500/[.06] text-amber-500", Icon: AlertTriangle },
  { severity: "observation", label: "Observação", className: "border-orange-500/35 bg-orange-500/[.06] text-orange-500", Icon: Radar },
  { severity: "ok", label: "Bom", className: "border-emerald-500/35 bg-emerald-500/[.06] text-emerald-500", Icon: CheckCircle2 },
];

function AlertCard({ alert, selected, onSelect, onDismiss }: { alert: DecisionAlert; selected: boolean; onSelect: () => void; onDismiss: () => void }) {
  return <article className={`rounded-lg border bg-background/35 p-3 transition-colors ${selected ? "border-primary/70 ring-1 ring-primary/35" : "border-border/60"}`}>
    <button type="button" className="w-full text-left" onClick={onSelect} aria-pressed={selected}>
      <h4 className="text-xs font-bold text-foreground">{alert.title}</h4>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{alert.description}</p>
    </button>
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <Button asChild size="sm" variant="outline" className="h-7 text-[10px]"><Link to={alert.href || "/analise-de-funis"}>{alert.actionLabel}<ExternalLink className="ml-1 h-3 w-3" /></Link></Button>
      <span className="text-[9px] font-semibold text-muted-foreground" title={alert.requiresConfirmation ? "Qualquer alteração exige confirmação antes de ser enviada." : "Ação de análise, sem alteração automática."}>
        {alert.requiresConfirmation ? "confirmação necessária" : "somente análise"}
      </span>
      <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={onDismiss}><EyeOff className="mr-1 h-3 w-3" />Ignorar</Button>
    </div>
  </article>;
}

export function DecisionAlertsPanel({ classes, insights, analytics }: { classes?: EventClassWithCounts[]; insights?: InsightRow[]; analytics?: FunnelAnalytics | null }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const alerts = useMemo(() => buildDecisionAlerts({ classes, insights, analytics }), [analytics, classes, insights]);
  const visible = alerts.filter((alert) => !dismissed.has(alert.id));
  const selectedAlert = visible.find((alert) => alert.id === selectedId) || visible[0] || null;
  return <section className="rounded-2xl border border-primary/25 bg-card/70 p-4" aria-labelledby="decision-alerts-title">
    <header className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-primary">Radar de anomalias</p><h2 id="decision-alerts-title" className="mt-1 text-base font-black">Alertas de decisão e ações sugeridas</h2><p className="mt-1 text-xs text-muted-foreground">Sinais baseados nos dados reais para decidir onde agir antes de perder dinheiro.</p></div><Button type="button" size="sm" variant="ghost" className="shrink-0 text-xs" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed}><SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />{collapsed ? "Expandir" : "Minimizar"}<ChevronDown className={`ml-1 h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} /></Button></header>
    {!collapsed && <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{columns.map(({ severity, label, className, Icon }) => { const items = visible.filter((alert) => alert.severity === severity); return <section key={severity} className={`min-w-0 rounded-xl border p-2.5 ${className}`} aria-labelledby={`decision-column-${severity}`}><div className="mb-2 flex items-center justify-between gap-2"><h3 id={`decision-column-${severity}`} className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide"><Icon className="h-3.5 w-3.5" />{label}</h3><span className="rounded-full border border-current/30 px-1.5 py-0.5 text-[10px] font-bold">{items.length}</span></div><div className="grid gap-2">{items.length ? items.map((alert) => <AlertCard key={alert.id} alert={alert} selected={selectedAlert?.id === alert.id} onSelect={() => setSelectedId(alert.id)} onDismiss={() => { setDismissed((current) => new Set(current).add(alert.id)); if (selectedId === alert.id) setSelectedId(null); }} />) : <p className="rounded-lg border border-dashed border-current/25 px-2 py-4 text-center text-[10px] opacity-75">Nenhum sinal nesta categoria.</p>}</div></section>; })}</div>
      {selectedAlert && <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-primary/30 bg-primary/[.05] p-3" aria-labelledby="selected-decision-solution">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-primary">Problema selecionado</p>
          <h3 className="mt-1 text-sm font-black" id="selected-decision-solution">{selectedAlert.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{selectedAlert.description}</p>
          <p className="mt-3 text-[10px] font-black uppercase tracking-[.14em] text-emerald-500">Solução recomendada</p>
          <p className="mt-1 text-xs text-foreground">{selectedAlert.actionLabel}. Abra a ação para revisar os dados e confirmar a decisão.</p>
          <Button asChild size="sm" className="mt-3 h-8 text-xs"><Link to={selectedAlert.href || "/analise-de-funis"}>{selectedAlert.actionLabel}<ExternalLink className="ml-1.5 h-3 w-3" /></Link></Button>
        </section>
        {analytics && <div className="min-w-0"><FunnelAutoInsights a={analytics} compact /></div>}
      </div>}
      {!selectedAlert && analytics && <div className="mt-3"><FunnelAutoInsights a={analytics} compact /></div>}
      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-[10px] text-muted-foreground"><span>{visible.length ? `${visible.length} alerta${visible.length === 1 ? "" : "s"} requer${visible.length === 1 ? "" : "em"} acompanhamento.` : "Nenhuma anomalia encontrada na seleção atual."}</span><span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />Ações agrupadas por prioridade</span></div>
    </>}
  </section>;
}
