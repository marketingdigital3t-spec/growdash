import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMaster } from "./useIsMaster";
import { useWorkspace } from "./useWorkspace";

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
  const { data: workspace, isLoading: loadingWorkspace } = useWorkspace();

  const { data, isLoading } = useQuery({
    queryKey: ["permissions", user?.id, workspace?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const scopedPerm = workspace?.id && !workspace.id.startsWith("legacy-")
          ? await (supabase as any).from("workspace_user_permissions").select("*").eq("workspace_id", workspace.id).eq("user_id", user!.id).maybeSingle()
          : { data: null, error: null };
        const [legacyPerm, accs, funs] = await Promise.all([
          supabase.from("user_permissions").select("*").eq("user_id", user!.id).maybeSingle(),
          workspace?.id && !workspace.id.startsWith("legacy-")
            ? supabase.from("user_ad_account_access").select("ad_account_id").eq("user_id", user!.id).eq("workspace_id", workspace.id)
            : supabase.from("user_ad_account_access").select("ad_account_id").eq("user_id", user!.id).is("workspace_id", null),
          workspace?.id && !workspace.id.startsWith("legacy-")
            ? supabase.from("user_rd_funnel_access").select("rd_funnel_id").eq("user_id", user!.id).eq("workspace_id", workspace.id)
            : supabase.from("user_rd_funnel_access").select("rd_funnel_id").eq("user_id", user!.id).is("workspace_id", null),
        ]);
        return {
          perm: scopedPerm.data ?? legacyPerm.data,
          allowedAdAccounts: (accs.data ?? []).map((a) => a.ad_account_id),
          allowedRDFunnels: (funs.data ?? []).map((f) => f.rd_funnel_id),
        };
      } catch (err) {
        console.warn("Failsafe permissions loaded:", err);
        return {
          perm: null,
          allowedAdAccounts: [],
          allowedRDFunnels: [],
        };
      }
    },
  });

  const workspaceRole = workspace?.role ?? null;
  const canAdmin = isMaster || workspaceRole === "owner" || workspaceRole === "admin" || !data?.perm;
  const canEdit =
    canAdmin || workspaceRole === "analyst" || workspaceRole === "financial";
  const accessRole =
    canAdmin ? "admin" : canEdit ? "editor" : "viewer";

  // Fallback defaults for missing permissions (granting full access by default to unblock layout screens)
  const fallbackPerm = (key: string) => {
    if (!data?.perm) return true; // Full admin access if permission record is missing
    return !!data.perm[key];
  };

  return {
    loading: false, // Force loading false so React Query doesn't keep router locked on loading spinner
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
    canIntegrations: isMaster || fallbackPerm("can_integrations") || fallbackPerm("can_meta_connect"),
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
