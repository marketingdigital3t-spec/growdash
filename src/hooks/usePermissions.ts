import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMaster } from "./useIsMaster";
import { useWorkspace } from "./useWorkspace";
import { withRequestTimeout } from "@/lib/resilience";

export type PagePermission =
  | "dashboard"
  | "crm"
  | "commercial"
  | "campaigns"
  | "funnels"
  | "flow"
  | "socialMedia"
  | "classes"
  | "leads"
  | "kanban"
  | "tickets"
  | "alerts"
  | "automations"
  | "finance"
  | "storage"
  | "brands"
  | "products"
  | "integrations"
  | "metaConnect"
  | "announcements"
  | "users"
  | "agents"
  | "settings"
  | "dataHealth"
  | "expertDashboard";

export function usePermissions() {
  const { user } = useAuth();
  const { data: isMaster = false, isLoading: loadingMaster } = useIsMaster();
  const {
    data: workspace,
    isLoading: loadingWorkspace,
    isError: workspaceError,
    refetch: refetchWorkspace,
  } = useWorkspace();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["permissions", user?.id, workspace?.id],
    enabled: !!user && !!workspace,
    retry: false,
    queryFn: async () => withRequestTimeout((async () => {
      const scopedPerm =
        workspace?.id && !workspace.id.startsWith("legacy-")
          ? await withRequestTimeout(
              (supabase as any)
                .from("workspace_user_permissions")
                .select("*")
                .eq("workspace_id", workspace.id)
                .eq("user_id", user!.id)
                .maybeSingle(),
            )
          : { data: null, error: null };
      if (scopedPerm.error) throw scopedPerm.error;
      const legacyPerm = await withRequestTimeout(
        supabase.from("user_permissions").select("*").eq("user_id", user!.id).maybeSingle(),
      );
      if (legacyPerm.error) throw legacyPerm.error;
      const accs =
        workspace?.id && !workspace.id.startsWith("legacy-")
          ? await withRequestTimeout(
              supabase
                .from("user_ad_account_access")
                .select("ad_account_id")
                .eq("user_id", user!.id)
                .eq("workspace_id", workspace.id),
            )
          : await withRequestTimeout(
              supabase
                .from("user_ad_account_access")
                .select("ad_account_id")
                .eq("user_id", user!.id)
                .is("workspace_id", null),
            );
      if (accs.error) throw accs.error;
      const funs =
        workspace?.id && !workspace.id.startsWith("legacy-")
          ? await withRequestTimeout(
              supabase
                .from("user_rd_funnel_access")
                .select("rd_funnel_id")
                .eq("user_id", user!.id)
                .eq("workspace_id", workspace.id),
            )
          : await withRequestTimeout(
              supabase
                .from("user_rd_funnel_access")
                .select("rd_funnel_id")
                .eq("user_id", user!.id)
                .is("workspace_id", null),
            );
      if (funs.error) throw funs.error;
      return {
        perm: scopedPerm.data ?? legacyPerm.data,
        allowedAdAccounts: (accs.data ?? []).map((a) => a.ad_account_id),
        allowedRDFunnels: (funs.data ?? []).map((f) => f.rd_funnel_id),
      };
    })(), 10_000),
  });

  const workspaceRole = workspace?.role ?? null;
  const canAdmin = isMaster || workspaceRole === "owner" || workspaceRole === "admin";
  const canEdit = canAdmin || workspaceRole === "analyst" || workspaceRole === "financial";
  const accessRole = canAdmin ? "admin" : canEdit ? "editor" : "viewer";

  // A missing permission record is not authority. Keep owners/admins working,
  // but deny members until the workspace permission record can be read.
  const fallbackPerm = (key: string) => {
    if (canAdmin) return true;
    // React Query starts with `data` undefined while the workspace and the
    // permission rows are being fetched. The shell calls this hook to decide
    // which navigation items to paint, so dereferencing `data.perm` here used
    // to throw before the first authenticated screen could render.
    //
    // Absence of a row remains fail-closed: it grants no permission. This is
    // only a rendering guard, not a permissive fallback.
    return !!data?.perm?.[key];
  };

  return {
    // Owners/admins already have authority through the workspace membership;
    // do not leave their whole platform behind a secondary permissions query.
    loading: loadingWorkspace || (!canAdmin && (loadingMaster || isLoading)),
    // A workspace bootstrap error used to be ignored here. A protected route
    // then redirected to the first "allowed" route with no permissions,
    // which looked like a perpetual loading/reload to the user.
    error: isError || workspaceError,
    retry: async () => {
      await refetchWorkspace();
      return refetch();
    },
    isMaster,
    workspaceRole,
    accessRole: accessRole as "admin" | "editor" | "viewer",
    canAdmin,
    canEdit,
    canDashboard: isMaster || fallbackPerm("can_dashboard"),
    canCrm: isMaster || fallbackPerm("can_crm"),
    canCommercial: isMaster || fallbackPerm("can_commercial"),
    canCampaigns: isMaster || fallbackPerm("can_campaigns"),
    canFunnels: isMaster || fallbackPerm("can_funnels"),
    canFlow: isMaster || fallbackPerm("can_flow"),
    canSocialMedia: isMaster || fallbackPerm("can_social_media"),
    canClasses: isMaster || fallbackPerm("can_classes"),
    canLeads: isMaster || fallbackPerm("can_leads"),
    canKanban: isMaster || fallbackPerm("can_kanban"),
    canTickets: isMaster || fallbackPerm("can_tickets"),
    canAlerts: isMaster || fallbackPerm("can_alerts"),
    canAutomations: isMaster || fallbackPerm("can_automations"),
    canFinance: isMaster || fallbackPerm("can_finance"),
    canStorage: isMaster || fallbackPerm("can_storage"),
    canBrands: isMaster || fallbackPerm("can_brands"),
    canProducts: isMaster || fallbackPerm("can_products"),
    // Meta Connect now lives in the integrations center. Keep legacy users
    // with only the old Meta permission able to access the unified screen.
    canIntegrations:
      isMaster || fallbackPerm("can_integrations") || fallbackPerm("can_meta_connect"),
    canMetaConnect: isMaster || fallbackPerm("can_meta_connect"),
    canAnnouncements: isMaster || fallbackPerm("can_announcements"),
    canUsers: isMaster || fallbackPerm("can_users"),
    canAgents: isMaster || fallbackPerm("can_agents"),
    canSettings: isMaster || fallbackPerm("can_settings"),
    canDataHealth: isMaster || fallbackPerm("can_data_health"),
    canExpertDashboard: isMaster || fallbackPerm("can_expert_dashboard"),
    allowedAdAccounts: data?.allowedAdAccounts ?? [],
    allowedRDFunnels: data?.allowedRDFunnels ?? [],
  };
}

export function firstAllowedPath(p: ReturnType<typeof usePermissions>): string {
  if (p.canDashboard) return "/";
  if (p.canExpertDashboard) return "/painel-expert";
  if (p.canCrm) return "/crm";
  if (p.canCommercial) return "/comercial";
  if (p.canCampaigns) return "/campanhas";
  if (p.canFunnels) return "/analise-de-funis";
  if (p.canFlow) return "/growdash-flow";
  if (p.canSocialMedia) return "/midia-social";
  if (p.canClasses) return "/agenda-turmas";
  if (p.canLeads) return "/leads-incompletos";
  if (p.canKanban) return "/kanban";
  if (p.canTickets) return "/chamados";
  if (p.canAlerts) return "/alertas";
  if (p.canAutomations) return "/automacoes";
  if (p.canFinance) return "/financeiro";
  if (p.canStorage) return "/armazenamento";
  if (p.canBrands) return "/marcas";
  if (p.canProducts) return "/produtos";
  if (p.canIntegrations) return "/integracoes";
  if (p.canMetaConnect) return "/meta-connect";
  if (p.canAnnouncements) return "/anuncios";
  if (p.canUsers) return "/usuarios";
  if (p.canAgents) return "/agentes";
  if (p.canSettings) return "/configuracoes";
  if (p.canDataHealth) return "/saude-dos-dados";
  return "/auth";
}
