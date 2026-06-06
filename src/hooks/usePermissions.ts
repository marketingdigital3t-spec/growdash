import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMaster } from "./useIsMaster";

export type PagePermission =
  | "dashboard"
  | "campaigns"
  | "funnels"
  | "classes"
  | "crm"
  | "commercial"
  | "leads"
  | "alerts"
  | "users"
  | "integrations"
  | "announcements"
  | "automations";

export function usePermissions() {
  const { user } = useAuth();
  const { data: isMaster = false, isLoading: loadingMaster } = useIsMaster();

  const { data, isLoading } = useQuery({
    queryKey: ["permissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [perm, accs, funs] = await Promise.all([
        supabase.from("user_permissions").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("user_ad_account_access").select("ad_account_id").eq("user_id", user!.id),
        supabase.from("user_rd_funnel_access").select("rd_funnel_id").eq("user_id", user!.id),
      ]);
      return {
        perm: perm.data as Record<string, boolean | string> | null,
        allowedAdAccounts: (accs.data ?? []).map((a) => a.ad_account_id),
        allowedRDFunnels: (funs.data ?? []).map((f) => f.rd_funnel_id),
      };
    },
  });

  const isAuthenticated = !!user;
  const p = data?.perm as any;
  const can = (key: string) => isMaster || !!p?.[key];

  return {
    loading: loadingMaster || isLoading,
    isMaster,
    canDashboard: isAuthenticated,
    canCampaigns: can("can_campaigns"),
    canFunnels: can("can_funnels"),
    canClasses: can("can_classes"),
    canCRM: can("can_crm"),
    canCommercial: can("can_commercial"),
    canLeads: can("can_leads"),
    canAlerts: can("can_alerts"),
    canUsers: can("can_users"),
    canIntegrations: can("can_integrations"),
    canAnnouncements: can("can_announcements"),
    canAutomations: can("can_automations"),
    allowedAdAccounts: data?.allowedAdAccounts ?? [],
    allowedRDFunnels: data?.allowedRDFunnels ?? [],
  };
}

export function firstAllowedPath(p: ReturnType<typeof usePermissions>): string {
  if (p.canDashboard) return "/";
  if (p.canCampaigns) return "/campaigns";
  if (p.canFunnels) return "/funnels";
  if (p.canCRM) return "/crm";
  if (p.canCommercial) return "/commercial";
  if (p.canClasses) return "/classes";
  return "/";
}
