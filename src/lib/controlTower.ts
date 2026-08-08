import type { CampaignDiagnostic, DiagSeverity } from "@/hooks/useCampaignDiagnostics";

export type ControlTowerStatus = "route" | "attention" | "deviation" | "emergency";

export type ControlTowerAccountInput = {
  id: string;
  name: string;
  remaining_balance?: number | null;
  daily_budget?: number | null;
  connection_status?: string | null;
  last_sync_error?: string | null;
  oauth_health_status?: string | null;
};

export type ControlTowerDiagnostic = Pick<CampaignDiagnostic,
  "id" | "name" | "accountId" | "accountName" | "isActive" | "spend" | "leads" | "cpl" |
  "effectiveTargetCpl" | "minSpendThreshold" | "status" | "trend" | "reasons" | "summary"
>;

export type ControlTowerSaleInput = {
  ad_account_id: string | null;
  net_revenue: number | null;
  status?: string | null;
};

export type ControlTowerAccount = {
  id: string;
  name: string;
  status: ControlTowerStatus;
  healthScore: number;
  campaigns: number;
  activeCampaigns: number;
  spend: number;
  leads: number;
  cpl: number;
  revenue: number;
  roas: number;
  runwayDays: number | null;
  riskImpact: number;
  opportunityScore: number;
  opportunityReason: string;
  integration: "connected" | "attention" | "offline";
  forecast: string;
  primaryCause: string;
  nextAction: string;
  nextActionHref: string;
  diagnostics: ControlTowerDiagnostic[];
};

export type ControlTowerException = {
  id: string;
  causeKey: string;
  accountId: string;
  accountName: string;
  severity: "critical" | "warning" | "info";
  impact: number;
  title: string;
  why: string;
  nextAction: string;
  href: string;
};

export type ControlTowerModel = {
  accounts: ControlTowerAccount[];
  exceptions: ControlTowerException[];
  totals: {
    accounts: number;
    route: number;
    attention: number;
    deviation: number;
    emergency: number;
    riskImpact: number;
  };
};

const severityWeight: Record<DiagSeverity, number> = {
  critical: 4,
  warning: 2,
  observation: 1,
  initial: 0,
  healthy: 0,
  inactive: 1,
};

const statusRank: Record<ControlTowerStatus, number> = {
  emergency: 0,
  deviation: 1,
  attention: 2,
  route: 3,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isRevenueStatus(status: string | null | undefined) {
  return String(status || "").toLocaleLowerCase("pt-BR") === "confirmed";
}

function hasIntegrationIssue(account: ControlTowerAccountInput) {
  const connection = String(account.connection_status || "").toLocaleLowerCase("pt-BR");
  const oauth = String(account.oauth_health_status || "").toLocaleLowerCase("pt-BR");
  return Boolean(account.last_sync_error) || ["error", "failed", "offline", "disconnected"].includes(connection) || ["expired", "revoked", "invalid", "error"].includes(oauth);
}

function isLowBudget(runwayDays: number | null) {
  return runwayDays !== null && runwayDays <= 3;
}

function diagnosticRiskImpact(row: ControlTowerDiagnostic) {
  if (!(row.status === "critical" || row.status === "warning" || row.status === "observation")) return 0;
  const expectedSpend = safeNumber(row.effectiveTargetCpl) * safeNumber(row.leads);
  return Math.max(0, safeNumber(row.spend) - expectedSpend);
}

function accountStatus(args: {
  integrationIssue: boolean;
  lowBudget: boolean;
  diagnostics: ControlTowerDiagnostic[];
  riskImpact: number;
}) : ControlTowerStatus {
  const critical = args.diagnostics.some((row) => row.status === "critical");
  const worsening = args.diagnostics.some((row) => row.trend === "worsening" && row.isActive);
  if (args.integrationIssue || (critical && args.riskImpact > 0)) return "emergency";
  if (critical || worsening) return "deviation";
  if (args.lowBudget || args.diagnostics.some((row) => row.status === "warning" || row.status === "observation")) return "attention";
  return "route";
}

function healthScore(args: {
  status: ControlTowerStatus;
  diagnostics: ControlTowerDiagnostic[];
  runwayDays: number | null;
  integrationIssue: boolean;
}) {
  const penalty = args.diagnostics.reduce((total, row) => total + severityWeight[row.status] * 9, 0);
  const trendPenalty = args.diagnostics.filter((row) => row.trend === "worsening").length * 8;
  const budgetPenalty = args.runwayDays !== null && args.runwayDays <= 3 ? (args.runwayDays <= 0 ? 35 : 18) : 0;
  const integrationPenalty = args.integrationIssue ? 28 : 0;
  const statusPenalty = args.status === "emergency" ? 12 : args.status === "deviation" ? 6 : 0;
  return clamp(100 - penalty - trendPenalty - budgetPenalty - integrationPenalty - statusPenalty);
}

function buildNextAction(args: {
  account: ControlTowerAccountInput;
  diagnostics: ControlTowerDiagnostic[];
  integrationIssue: boolean;
  runwayDays: number | null;
  status: ControlTowerStatus;
}) {
  if (args.integrationIssue) return {
    cause: "Torre sem sinal",
    action: "Renovar a integração e executar uma sincronização confirmada.",
    href: "/integracoes",
  };
  if (isLowBudget(args.runwayDays)) return {
    cause: "Combustível baixo",
    action: `Repor orçamento antes de ${args.runwayDays === 0 ? "interromper as campanhas" : `restarem ${Math.floor(args.runwayDays!)} dia(s)`}.`,
    href: "/campanhas?aba=budget",
  };
  const critical = args.diagnostics.find((row) => row.status === "critical");
  if (critical) return {
    cause: critical.reasons[0] || "Desvio de rota detectado",
    action: `Abrir a análise da campanha “${critical.name}” e pausar ou corrigir o pior conjunto antes de aumentar a verba.`,
    href: `/campanhas?aba=campaigns&analise=alerts&conta=${encodeURIComponent(args.account.id)}`,
  };
  const warning = args.diagnostics.find((row) => row.status === "warning" || row.status === "observation");
  if (warning) return {
    cause: warning.reasons[0] || "Atenção operacional",
    action: `Revisar a tendência da campanha “${warning.name}” e acompanhar o CPL no próximo ciclo.`,
    href: `/campanhas?aba=campaigns&analise=alerts&conta=${encodeURIComponent(args.account.id)}`,
  };
  return {
    cause: args.status === "route" ? "Em rota, altitude estável" : "Monitorar o próximo ciclo",
    action: "Manter a operação monitorada e revisar o plano no próximo fechamento.",
    href: "/campanhas",
  };
}

function buildException(account: ControlTowerAccount, causeKey: string, severity: ControlTowerException["severity"], title: string, why: string, nextAction: string, impact: number, href: string): ControlTowerException {
  return {
    id: `tower:${account.id}:${causeKey}`,
    causeKey,
    accountId: account.id,
    accountName: account.name,
    severity,
    impact: Math.max(0, impact),
    title,
    why,
    nextAction,
    href,
  };
}

export function buildControlTowerModel(
  accounts: ControlTowerAccountInput[],
  diagnostics: ControlTowerDiagnostic[],
  sales: ControlTowerSaleInput[] = [],
): ControlTowerModel {
  const diagnosticsByAccount = new Map<string, ControlTowerDiagnostic[]>();
  diagnostics.forEach((row) => {
    const current = diagnosticsByAccount.get(row.accountId) || [];
    current.push(row);
    diagnosticsByAccount.set(row.accountId, current);
  });
  const revenueByAccount = new Map<string, number>();
  sales.filter((sale) => sale.ad_account_id && isRevenueStatus(sale.status)).forEach((sale) => {
    const id = sale.ad_account_id!;
    revenueByAccount.set(id, (revenueByAccount.get(id) || 0) + safeNumber(sale.net_revenue));
  });

  const rows = accounts.map((account): ControlTowerAccount => {
    const accountDiagnostics = diagnosticsByAccount.get(account.id) || [];
    const spend = accountDiagnostics.reduce((total, row) => total + safeNumber(row.spend), 0);
    const leads = accountDiagnostics.reduce((total, row) => total + safeNumber(row.leads), 0);
    const revenue = revenueByAccount.get(account.id) || 0;
    const cpl = leads > 0 ? spend / leads : 0;
    const roas = spend > 0 ? revenue / spend : 0;
    const balance = account.remaining_balance == null ? null : safeNumber(account.remaining_balance);
    const budget = account.daily_budget == null ? null : safeNumber(account.daily_budget);
    const runwayDays = balance !== null && budget !== null && budget > 0 ? Math.max(0, balance / budget) : null;
    const riskImpact = accountDiagnostics.reduce((total, row) => total + diagnosticRiskImpact(row), 0);
    const integrationIssue = hasIntegrationIssue(account);
    const status = accountStatus({ integrationIssue, lowBudget: isLowBudget(runwayDays), diagnostics: accountDiagnostics, riskImpact });
    const score = healthScore({ status, diagnostics: accountDiagnostics, runwayDays, integrationIssue });
    const action = buildNextAction({ account, diagnostics: accountDiagnostics, integrationIssue, runwayDays, status });
    const activeCampaigns = accountDiagnostics.filter((row) => row.isActive).length;
    const healthyShare = accountDiagnostics.length ? accountDiagnostics.filter((row) => row.status === "healthy" || row.status === "initial").length / accountDiagnostics.length : 0;
    const opportunityScore = clamp((activeCampaigns ? 25 : 0) + healthyShare * 35 + (leads > 0 ? 20 : 0) + (roas > 1 ? Math.min(20, roas * 5) : 0));
    const opportunityReason = accountDiagnostics.length === 0
      ? "Sem dados de campanha suficientes para estimar potencial."
      : opportunityScore >= 70
        ? "Operação saudável com espaço para escalar com controle."
        : opportunityScore >= 40
          ? "Há sinais de crescimento, mas valide o desvio antes de aumentar a verba."
          : "Priorize a correção operacional antes de buscar expansão.";
    const forecast = accountDiagnostics.some((row) => row.trend === "worsening" && row.isActive)
      ? "A tendência atual pode levar a conta abaixo da meta nos próximos 4 dias."
      : accountDiagnostics.some((row) => row.trend === "improving")
        ? "A tendência recente é de melhora; mantenha o acompanhamento diário."
        : "Sem sinal estatístico suficiente para uma previsão confiável.";
    return {
      id: account.id,
      name: account.name,
      status,
      healthScore: score,
      campaigns: accountDiagnostics.length,
      activeCampaigns,
      spend,
      leads,
      cpl,
      revenue,
      roas,
      runwayDays,
      riskImpact,
      opportunityScore,
      opportunityReason,
      integration: integrationIssue ? "offline" : account.oauth_health_status === "unchecked" ? "attention" : "connected",
      forecast,
      primaryCause: action.cause,
      nextAction: action.action,
      nextActionHref: action.href,
      diagnostics: accountDiagnostics,
    };
  });

  const sorted = [...rows].sort((a, b) => statusRank[a.status] - statusRank[b.status] || b.riskImpact - a.riskImpact || a.name.localeCompare(b.name, "pt-BR"));
  const exceptions = sorted.flatMap((account) => {
    const firstCritical = account.diagnostics.find((row) => row.status === "critical");
    if (account.integration === "offline") return [buildException(account, "integration", "critical", "Torre sem sinal", "A integração está expirada, revogada ou com falha de sincronização.", account.nextAction, account.riskImpact, "/integracoes")];
    if (account.runwayDays !== null && account.runwayDays <= 3) return [buildException(account, "budget", account.runwayDays <= 0 ? "critical" : "warning", "Combustível baixo", `A autonomia estimada é de ${Math.floor(account.runwayDays)} dia(s) com o orçamento diário informado.`, account.nextAction, account.runwayDays <= 0 ? Math.max(account.riskImpact, account.spend) : account.riskImpact, "/campanhas?aba=budget")];
    if (firstCritical) return [buildException(account, `campaign:${firstCritical.id}`, "critical", "Desvio de rota detectado", firstCritical.reasons[0] || firstCritical.summary, account.nextAction, diagnosticRiskImpact(firstCritical), account.nextActionHref)];
    const warning = account.diagnostics.find((row) => row.status === "warning" || row.status === "observation");
    if (warning) return [buildException(account, `campaign:${warning.id}`, "warning", "Atenção operacional", warning.reasons[0] || warning.summary, account.nextAction, diagnosticRiskImpact(warning), account.nextActionHref)];
    return [];
  });

  return {
    accounts: sorted,
    exceptions: exceptions.sort((a, b) => ({ critical: 0, warning: 1, info: 2 }[a.severity] - ({ critical: 0, warning: 1, info: 2 }[b.severity]) || b.impact - a.impact)),
    totals: {
      accounts: rows.length,
      route: rows.filter((row) => row.status === "route").length,
      attention: rows.filter((row) => row.status === "attention").length,
      deviation: rows.filter((row) => row.status === "deviation").length,
      emergency: rows.filter((row) => row.status === "emergency").length,
      riskImpact: rows.reduce((total, row) => total + row.riskImpact, 0),
    },
  };
}
