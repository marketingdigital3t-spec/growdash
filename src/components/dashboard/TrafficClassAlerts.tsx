import { AlertTriangle, ArrowRight, CalendarClock, PauseCircle } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { EventClassWithCounts } from "@/hooks/useEventClasses";
import type { InsightRow } from "@/hooks/useInsights";

type Props = { classes: EventClassWithCounts[]; insights: InsightRow[] };

function textFor(eventClass: EventClassWithCounts) {
  return [eventClass.title, eventClass.location, eventClass.rd_funnel_name, eventClass.sources.map((source) => source.funnel_name).join(" ")]
    .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
}

/** Flags paid traffic whose offer does not match an imminent class. */
export function TrafficClassAlerts({ classes, insights }: Props) {
  const today = new Date();
  const alerts = classes.flatMap((eventClass) => {
    if (["cancelled", "finished"].includes(eventClass.status)) return [];
    const days = differenceInCalendarDays(parseISO(eventClass.date_start), today);
    if (days < 0 || days > 21) return [];
    const classText = textFor(eventClass);
    const classIsGluteo = /gl[uú]teo|gl[uú]tea/.test(classText);
    if (!classIsGluteo) return [];
    const breastRows = insights.filter((row) => /seio|seios|mama/.test(row.campaign_name.toLocaleLowerCase("pt-BR")));
    const spend = breastRows.reduce((sum, row) => sum + Number(row.spend || 0), 0);
    const leads = breastRows.reduce((sum, row) => sum + Number(row.leads || 0), 0);
    const clicks = breastRows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
    if (spend <= 0 || leads > 0 || clicks <= 0) return [];
    return [{ eventClass, days, spend, clicks }];
  });
  if (alerts.length === 0) return null;

  return <section className="traffic-class-alerts" aria-label="Alertas de alinhamento entre turmas e tráfego">
    <header><span className="traffic-class-alert-icon"><AlertTriangle /></span><div><p>Alerta de alinhamento de oferta</p><h2>Tráfego sem demanda para turma próxima</h2></div><span className="traffic-class-alert-count">{alerts.length} alerta{alerts.length > 1 ? "s" : ""}</span></header>
    <div className="traffic-class-alert-list">{alerts.map(({ eventClass, days, spend, clicks }) => <article key={eventClass.id}>
      <div className="traffic-class-alert-main"><CalendarClock /><div><strong>{eventClass.title}</strong><span>{days === 0 ? "Hoje" : `Em ${days} dias`} · foco identificado: glúteo</span></div></div>
      <p className="traffic-class-alert-copy">Há <b>R$ {spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b> investidos em campanhas de seios, com <b>{clicks.toLocaleString("pt-BR")} cliques e nenhum lead</b> no período selecionado. Como essa turma não oferece seios, revise a campanha antes de manter o orçamento.</p>
      <div className="traffic-class-alert-action"><PauseCircle /> Prioridade: pausar ou realocar o orçamento de seios <ArrowRight /></div>
    </article>)}</div>
  </section>;
}
