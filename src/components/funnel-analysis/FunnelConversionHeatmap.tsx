import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RDDeal } from "@/hooks/useRDDeals";

const periods = ["Madrugada", "Manhã", "Tarde", "Noite"] as const;
const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
function periodOf(date: Date) { const hour = date.getHours(); return hour >= 5 && hour < 12 ? "Manhã" : hour >= 12 && hour < 18 ? "Tarde" : hour >= 18 ? "Noite" : "Madrugada"; }

export function FunnelConversionHeatmap({ closedDeals }: { closedDeals: RDDeal[] }) {
  const matrix = new Map<string, number>();
  closedDeals.forEach((deal) => { if (!deal.closed_at) return; const date = new Date(deal.closed_at); if (!Number.isNaN(date.getTime())) matrix.set(`${date.getDay()}-${periodOf(date)}`, (matrix.get(`${date.getDay()}-${periodOf(date)}`) ?? 0) + 1); });
  const max = Math.max(1, ...Array.from(matrix.values()));
  const best = Array.from(matrix.entries()).map(([key, conversions]) => { const [weekday, period] = key.split("-"); return { weekday: Number(weekday), period, conversions }; }).sort((x, y) => y.conversions - x.conversions)[0];
  return <Card className="gd-analysis-card gd-analysis-card-compact bg-card/60 border-border/40"><CardHeader className="pb-3"><CardTitle className="text-base">9. Melhor combinação de dia e horário</CardTitle><p className="text-xs font-normal text-muted-foreground">Intensidade baseada em vendas confirmadas; passe o mouse para ler a combinação.</p></CardHeader><CardContent className="pt-0"><div className="overflow-x-auto"><div className="w-full max-w-[860px] min-w-[520px]"><div className="grid grid-cols-[76px_repeat(7,minmax(0,1fr))] gap-1.5 text-center text-[10px] text-muted-foreground"><span>Horário</span>{weekdays.map((day) => <span key={day}>{day.slice(0, 3)}</span>)}{periods.map((period) => <><span key={`${period}-label`} className="flex h-12 items-center justify-end pr-2 text-[11px] text-foreground">{period}</span>{weekdays.map((day, weekday) => { const value = matrix.get(`${weekday}-${period}`) ?? 0; const alpha = value ? 0.16 + (value / max) * 0.72 : 0.04; return <div key={`${period}-${weekday}`} title={`${day} · ${period}: ${value} venda(s)`} className="grid h-12 place-items-center rounded-md border border-primary/10 font-bold text-foreground transition hover:ring-2 hover:ring-primary/60" style={{ backgroundColor: `hsl(var(--primary) / ${alpha})` }}>{value || "—"}</div>; })}</> )}</div></div></div><p className="mt-3 text-xs text-muted-foreground">{best?.conversions ? <>Pico atual: <b className="text-foreground">{weekdays[best.weekday]} · {best.period}</b> com {best.conversions} venda(s).</> : "Ainda não há vendas suficientes no período para identificar um pico."}</p></CardContent></Card>;
}
