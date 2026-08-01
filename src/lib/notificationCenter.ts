import type { CampaignDiagnostic } from "@/hooks/useCampaignDiagnostics";

export type NotificationScope = "dashboard" | "campaigns" | "funnels" | "classes" | "system";
export type NotificationSeverity = "critical" | "warning" | "info";

export type GrowdashNotification = {
  id: string;
  title: string;
  description: string;
  severity: NotificationSeverity;
  scope: NotificationScope;
  href: string;
  adAccountId?: string | null;
  createdAt?: string | null;
};

export type NotificationPermissions = {
  isMaster: boolean;
  canDashboard: boolean;
  canCampaigns: boolean;
  canFunnels: boolean;
  canClasses: boolean;
  allowedAdAccounts: string[];
};

export function canSeeNotification(item: GrowdashNotification, permissions: NotificationPermissions) {
  if (permissions.isMaster) return true;
  const allowedByModule = item.scope === "dashboard" ? permissions.canDashboard
    : item.scope === "campaigns" ? permissions.canCampaigns
      : item.scope === "funnels" ? permissions.canFunnels
        : item.scope === "classes" ? permissions.canClasses
          : false;
  if (!allowedByModule) return false;
  if (!item.adAccountId) return true;
  return permissions.allowedAdAccounts.includes(item.adAccountId);
}

export function filterNotifications(items: GrowdashNotification[], permissions: NotificationPermissions) {
  return items.filter((item) => canSeeNotification(item, permissions));
}

export function campaignNotifications(rows: CampaignDiagnostic[]): GrowdashNotification[] {
  return rows
    .filter((row) => ["critical", "warning", "observation"].includes(row.status))
    .map((row) => ({
      id: `campaign:${row.id}:${row.status}`,
      title: row.status === "critical" ? "Campanha crítica" : row.status === "warning" ? "Campanha requer atenção" : "Campanha em observação",
      description: `${row.name}: ${row.reasons[0] || row.summary}`,
      severity: row.status === "critical" ? "critical" : row.status === "warning" ? "warning" : "info",
      scope: "campaigns",
      href: `/campanhas?aba=campaigns&analise=alerts&conta=${encodeURIComponent(row.accountId)}`,
      adAccountId: row.accountId,
      createdAt: row.lastActivatedAt,
    }));
}
