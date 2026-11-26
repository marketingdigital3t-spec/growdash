import type { CampaignDiagnostic } from "@/hooks/useCampaignDiagnostics";
import { isSmartAlertEnabled, type SmartAlertKind, type SmartAlertPreferences } from "@/lib/smartAlerts";

export type NotificationScope = "dashboard" | "campaigns" | "funnels" | "classes" | "system";
export type NotificationSeverity = "critical" | "warning" | "info";

export type GrowdashNotification = {
  id: string;
  title: string;
  description: string;
  severity: NotificationSeverity;
  scope: NotificationScope;
  href: string;
  kind?: SmartAlertKind;
  adAccountId?: string | null;
  accountName?: string | null;
  createdAt?: string | null;
};

export type NotificationPermissions = {
  isMaster: boolean;
  canDashboard: boolean;
  canCampaigns: boolean;
  canFunnels: boolean;
  canClasses: boolean;
  canViewAllAccounts: boolean;
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
  if (permissions.canViewAllAccounts) return true;
  return permissions.allowedAdAccounts.includes(item.adAccountId);
}

export function filterNotifications(items: GrowdashNotification[], permissions: NotificationPermissions) {
  return items.filter((item) => canSeeNotification(item, permissions));
}

export function filterNotificationsByPreferences(items: GrowdashNotification[], preferences: SmartAlertPreferences) {
  return items.filter((item) => isSmartAlertEnabled(item.kind, preferences));
}

export function campaignNotifications(rows: CampaignDiagnostic[]): GrowdashNotification[] {
  return rows
    .filter((row) => ["critical", "warning", "observation"].includes(row.status))
    .map((row) => {
      const stoppedConverting = row.isActive && row.leads === 0 && row.spend >= Math.max(row.minSpendThreshold, row.effectiveTargetCpl);
      const cplRise = row.leads > 0 && row.cpl > row.effectiveTargetCpl * 1.15;
      const kind: SmartAlertKind = stoppedConverting ? "no_conversion" : cplRise ? "cpl_rise" : "campaign";
      const title = stoppedConverting ? "Campanha parou de converter" : cplRise ? "CPL subiu" : row.status === "critical" ? "Campanha crítica" : row.status === "warning" ? "Campanha requer atenção" : "Campanha em observação";
      return {
        id: `campaign:${row.id}:${row.status}:${kind}`,
        title,
        description: `${row.name}: ${row.reasons[0] || row.summary}`,
        severity: row.status === "critical" ? "critical" as const : row.status === "warning" ? "warning" as const : "info" as const,
        scope: "campaigns" as const,
        href: `/campanhas?aba=campaigns&analise=alerts&conta=${encodeURIComponent(row.accountId)}`,
        kind,
        adAccountId: row.accountId,
        accountName: row.accountName,
        createdAt: row.lastActivatedAt,
      };
    });
}
