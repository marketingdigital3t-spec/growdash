import type { EventClassWithCounts } from "@/hooks/useEventClasses";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import type { InsightRow } from "@/hooks/useInsights";

export const DECISION_ALERT_CONFIG = {
  classDaysLimit: 7,
  classMinimumPercent: 50,
  campaignSpendWithoutResult: 100,
  campaignDaysWithoutResult: 3,
  funnelMinimumConversion: 40,
  funnelStalledDays: 5,
} as const;

export type DecisionAlertSeverity = "critical" | "attention" | "observation" | "ok";
export type DecisionAlertAction = "review_class" | "review_campaign" | "review_funnel";
export interface DecisionAlert {
  id: string;
  severity: DecisionAlertSeverity;
  title: string;
  description: string;
  actionLabel: string;
  action: DecisionAlertAction;
  /** Ações que alteram campanhas/turmas nunca devem ser executadas sem revisão. */
  requiresConfirmation: boolean;
  href?: string;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export function buildDecisionAlerts({ classes = [], insights = [], analytics, today = new Date() }: {
  classes?: EventClassWithCounts[];
  insights?: InsightRow[];
  analytics?: FunnelAnalytics | null;
  today?: Date;
}): DecisionAlert[] {
  const alerts: DecisionAlert[] = [];
  for (const eventClass of classes) {
    if (eventClass.status === "cancelled" || eventClass.status === "finished") continue;
    const start = new Date(`${eventClass.date_start}T00:00:00`);
    const days = Math.ceil((start.getTime() - today.getTime()) / 86400000);
    const goal = Math.max(0, Number(eventClass.max_students || eventClass.max_people || 0));
    const sold = Math.max(0, Number(eventClass.studentCount || 0));
    const pct = goal > 0 ? (sold / goal) * 100 : null;
    if (days >= 0 && days <= DECISION_ALERT_CONFIG.classDaysLimit && goal > 0 && sold === 0) {
      alerts.push({ id: `class-zero-${eventClass.id}`, severity: "critical", title: `Risco de cancelamento: ${eventClass.title}`, description: `${brl.format(0)} em inscrições: 0 de ${goal} vagas preenchidas e faltam ${days} dia${days === 1 ? "" : "s"} para o início.`, actionLabel: "Abrir Agenda & Turmas", action: "review_class", requiresConfirmation: true, href: "/agenda-turmas" });
    } else if (days >= 0 && days <= DECISION_ALERT_CONFIG.classDaysLimit && pct !== null && pct < DECISION_ALERT_CONFIG.classMinimumPercent) {
      alerts.push({ id: `class-low-${eventClass.id}`, severity: "attention", title: `Venda insuficiente: ${eventClass.title}`, description: `${sold} de ${goal} vagas (${pct.toFixed(0)}%) com ${days} dia${days === 1 ? "" : "s"} restantes; abaixo da meta mínima de ${DECISION_ALERT_CONFIG.classMinimumPercent}%.`, actionLabel: "Revisar turma", action: "review_class", requiresConfirmation: true, href: "/agenda-turmas" });
    }
  }

  const byCampaign = new Map<string, { spend: number; leads: number; days: Set<string> }>();
  for (const row of insights) {
    const name = row.campaign_name || "Campanha sem nome";
    const current = byCampaign.get(name) || { spend: 0, leads: 0, days: new Set<string>() };
    current.spend += Number(row.spend || 0);
    current.leads += Number(row.leads || 0);
    current.days.add(row.date);
    byCampaign.set(name, current);
  }
  for (const [name, data] of byCampaign) {
    if (data.leads === 0 && data.spend >= DECISION_ALERT_CONFIG.campaignSpendWithoutResult && data.days.size >= DECISION_ALERT_CONFIG.campaignDaysWithoutResult) {
      alerts.push({ id: `campaign-zero-${name}`, severity: "critical", title: `Gasto sem retorno: ${name}`, description: `Investimento de ${brl.format(data.spend)} em ${data.days.size} dias sem nenhum resultado registrado.`, actionLabel: "Revisar campanha", action: "review_campaign", requiresConfirmation: true, href: "/trafego-pago?analise=alerts" });
    }
  }

  if (analytics) {
    const bottleneck = analytics.stageConversion.find((stage) => stage.rate < DECISION_ALERT_CONFIG.funnelMinimumConversion && stage.from && stage.to);
    if (bottleneck) {
      alerts.push({ id: `funnel-gap-${bottleneck.from}-${bottleneck.to}`, severity: "attention", title: `Gap detectado: ${bottleneck.from} → ${bottleneck.to}`, description: `A conversão está em ${bottleneck.rate.toFixed(1)}%, abaixo do mínimo de ${DECISION_ALERT_CONFIG.funnelMinimumConversion}%. Há ${analytics.agingBuckets.gt7} lead(s) parados há mais de 7 dias.`, actionLabel: "Abrir CRM", action: "review_funnel", requiresConfirmation: false, href: "/crm" });
    }
    const stalled = analytics.stages.find((stage) => !stage.is_won && !stage.is_lost && stage.avgDaysInStage >= DECISION_ALERT_CONFIG.funnelStalledDays);
    if (stalled) {
      alerts.push({ id: `funnel-stalled-${stalled.rd_stage_id}`, severity: "observation", title: `Leads parados em ${stalled.name}`, description: `${stalled.count} lead(s) permanecem nessa etapa há ${stalled.avgDaysInStage.toFixed(1)} dias em média.`, actionLabel: "Ver etapa no CRM", action: "review_funnel", requiresConfirmation: false, href: "/crm" });
    }
  }
  return alerts.sort((a, b) => ({ critical: 0, attention: 1, observation: 2, ok: 3 }[a.severity] - ({ critical: 0, attention: 1, observation: 2, ok: 3 }[b.severity])));
}
