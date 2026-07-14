import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMaster } from "./useIsMaster";

export type PagePermission = "dashboard" | "campaigns" | "funnels" | "classes";

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
        perm: perm.data,
        allowedAdAccounts: (accs.data ?? []).map((a) => a.ad_account_id),
        allowedRDFunnels: (funs.data ?? []).map((f) => f.rd_funnel_id),
      };
    },
  });

  return {
    loading: loadingMaster || isLoading,
    isMaster,
    canDashboard: isMaster || !!data?.perm?.can_dashboard,
    canCampaigns: isMaster || !!data?.perm?.can_campaigns,
    canFunnels: isMaster || !!data?.perm?.can_funnels,
    canClasses: isMaster || !!data?.perm?.can_classes,
    allowedAdAccounts: data?.allowedAdAccounts ?? [],
    allowedRDFunnels: data?.allowedRDFunnels ?? [],
  };
}

export function firstAllowedPath(p: ReturnType<typeof usePermissions>): string {
  if (p.canDashboard) return "/";
  if (p.canCampaigns) return "/campaigns";
  if (p.canFunnels) return "/funnels";
  if (p.canClasses) return "/classes";
  return "/auth";
}
