import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useCampaignDiagnostics } from "@/hooks/useCampaignDiagnostics";
import { usePermissions } from "@/hooks/usePermissions";
import { useSmartAlertPreferences } from "@/hooks/useSmartAlertPreferences";
import { useWorkspace } from "@/hooks/useWorkspace";
import { campaignNotifications, filterNotifications, filterNotificationsByPreferences, type GrowdashNotification } from "@/lib/notificationCenter";

function readKey(userId?: string, workspaceId?: string) {
  return `growdash:notifications:read:${userId || "anonymous"}:${workspaceId || "legacy"}`;
}

function loadRead(userId?: string, workspaceId?: string) {
  try {
    return new Set<string>(JSON.parse(window.localStorage.getItem(readKey(userId, workspaceId)) || "[]"));
  } catch {
    return new Set<string>();
  }
}

export function useNotificationCenter() {
  const { user } = useAuth();
  const { data: workspace } = useWorkspace();
  const permissions = usePermissions();
  const smartAlerts = useSmartAlertPreferences();
  const { data: accounts = [] } = useAdAccounts();
  const { data: diagnostics = [], isLoading } = useCampaignDiagnostics();
  const [read, setRead] = useState<Set<string>>(() => loadRead(user?.id, workspace?.id));

  useEffect(() => setRead(loadRead(user?.id, workspace?.id)), [user?.id, workspace?.id]);

  const items = useMemo(() => {
    const accountAlerts: GrowdashNotification[] = accounts.flatMap((account) => {
      const result: GrowdashNotification[] = [];
      const balance = account.remaining_balance == null ? null : Number(account.remaining_balance);
      const budget = account.daily_budget == null ? null : Number(account.daily_budget);
      if (balance != null && balance <= 0) {
        result.push({ id: `budget:${account.id}:empty`, title: "Orçamento esgotado", description: `${account.name} está sem saldo informado para manter os anúncios ativos.`, severity: "critical", scope: "campaigns", href: `/campanhas?aba=budget&conta=${encodeURIComponent(account.id)}`, kind: "low_budget", adAccountId: account.id, accountName: account.name });
      } else if (balance != null && budget && balance / budget <= 3) {
        result.push({ id: `budget:${account.id}:low`, title: "Orçamento baixo", description: `${account.name} possui autonomia estimada de ${Math.max(0, Math.floor(balance / budget))} dia(s).`, severity: "warning", scope: "campaigns", href: `/campanhas?aba=budget&conta=${encodeURIComponent(account.id)}`, kind: "low_budget", adAccountId: account.id, accountName: account.name });
      }
      if (account.connection_status === "error" || account.last_sync_error) {
        result.push({ id: `sync:${account.id}:${account.last_sync_error_code || "error"}`, title: "Falha de sincronização", description: `${account.name}: ${account.last_sync_error || "a integração precisa ser revisada."}`, severity: "critical", scope: "campaigns", href: "/saude-dos-dados", kind: "sync_error", adAccountId: account.id, accountName: account.name, createdAt: account.last_sync_attempt_at });
      }
      if (account.oauth_health_status && ["expired", "revoked", "invalid", "error"].includes(account.oauth_health_status)) {
        result.push({ id: `oauth:${account.id}:${account.oauth_health_status}`, title: "Acesso Meta precisa ser renovado", description: `${account.name} perdeu autorização ou possui token expirado.`, severity: "critical", scope: "campaigns", href: "/integracoes?tab=paid", kind: "oauth", adAccountId: account.id, accountName: account.name, createdAt: account.oauth_checked_at });
      }
      return result;
    });
    const all = [...accountAlerts, ...campaignNotifications(diagnostics)];
    const permitted = filterNotifications(all, {
      isMaster: permissions.isMaster,
      canDashboard: permissions.canDashboard,
      canCampaigns: permissions.canCampaigns,
      canFunnels: permissions.canFunnels,
      canClasses: permissions.canClasses,
      canViewAllAccounts: permissions.canAdmin,
      allowedAdAccounts: permissions.allowedAdAccounts,
    });
    return filterNotificationsByPreferences(permitted, smartAlerts.preferences).sort((a, b) => {
      const weight = { critical: 0, warning: 1, info: 2 } as const;
      return weight[a.severity] - weight[b.severity];
    });
  }, [accounts, diagnostics, permissions, smartAlerts.preferences]);

  function persist(next: Set<string>) {
    setRead(next);
    window.localStorage.setItem(readKey(user?.id, workspace?.id), JSON.stringify(Array.from(next)));
  }

  return {
    items,
    unread: items.filter((item) => !read.has(item.id)),
    isLoading,
    preferences: smartAlerts.preferences,
    isRead: (id: string) => read.has(id),
    markRead: (id: string) => persist(new Set(read).add(id)),
    markAllRead: () => persist(new Set([...read, ...items.map((item) => item.id)])),
  };
}
