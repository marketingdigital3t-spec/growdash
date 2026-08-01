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
  | "dataHealth";

export function usePermissions() {
  const { user } = useAuth();
  const { data: isMaster = false, isLoading: loadingMaster } = useIsMaster();
  const { data: workspace, isLoading: loadingWorkspace } = useWorkspace();

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

  const workspaceRole = workspace?.role ?? null;
  const canAdmin = isMaster || workspaceRole === "owner" || workspaceRole === "admin";
  const canEdit =
    canAdmin || workspaceRole === "analyst" || workspaceRole === "financial";
  const accessRole =
    canAdmin ? "admin" : canEdit ? "editor" : "viewer";

  return {
    loading: loadingMaster || loadingWorkspace || isLoading,
    isMaster,
    workspaceRole,
    accessRole: accessRole as "admin" | "editor" | "viewer",
    canAdmin,
    canEdit,
    canDashboard: isMaster || !!data?.perm?.can_dashboard,
    canCrm: isMaster || !!data?.perm?.can_crm,
    canCommercial: isMaster || !!data?.perm?.can_commercial,
    canCampaigns: isMaster || !!data?.perm?.can_campaigns,
    canFunnels: isMaster || !!data?.perm?.can_funnels,
    canFlow: isMaster || !!data?.perm?.can_flow,
    canSocialMedia: isMaster || !!data?.perm?.can_social_media,
    canClasses: isMaster || !!data?.perm?.can_classes,
    canLeads: isMaster || !!data?.perm?.can_leads,
    canKanban: isMaster || !!data?.perm?.can_kanban,
    canTickets: isMaster || !!data?.perm?.can_tickets,
    canAlerts: isMaster || !!data?.perm?.can_alerts,
    canAutomations: isMaster || !!data?.perm?.can_automations,
    canFinance: isMaster || !!data?.perm?.can_finance,
    canStorage: isMaster || !!data?.perm?.can_storage,
    canBrands: isMaster || !!data?.perm?.can_brands,
    canProducts: isMaster || !!data?.perm?.can_products,
    canIntegrations: isMaster || !!data?.perm?.can_integrations,
    canMetaConnect: isMaster || !!data?.perm?.can_meta_connect,
    canAnnouncements: isMaster || !!data?.perm?.can_announcements,
    canUsers: isMaster || !!data?.perm?.can_users,
    canAgents: isMaster || !!data?.perm?.can_agents,
    canSettings: isMaster || !!data?.perm?.can_settings,
    canDataHealth: isMaster || !!data?.perm?.can_data_health,
    allowedAdAccounts: data?.allowedAdAccounts ?? [],
    allowedRDFunnels: data?.allowedRDFunnels ?? [],
  };
}

export function firstAllowedPath(p: ReturnType<typeof usePermissions>): string {
  if (p.canDashboard) return "/";
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
