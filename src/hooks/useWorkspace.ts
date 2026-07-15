import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const fallbackPlans = [
  { code: "starter", name: "Starter", monthly_price: 97, description: "Operação enxuta para validar a gestão.", sort_order: 1, entitlements: { ad_accounts: 2, users: 2, ai_credits: 150, automations: 3, whatsapp_reports: 100, storage_bytes: 5368709120 } },
  { code: "growth", name: "Growth", monthly_price: 197, description: "Crescimento com mais contas, IA e histórico.", sort_order: 2, entitlements: { ad_accounts: 6, users: 5, ai_credits: 600, automations: 15, whatsapp_reports: 500, storage_bytes: 26843545600 } },
  { code: "scale", name: "Scale", monthly_price: 397, description: "Operação avançada para equipes e unidades.", sort_order: 3, entitlements: { ad_accounts: 15, users: 12, ai_credits: 2000, automations: 50, whatsapp_reports: 2000, storage_bytes: 107374182400 } },
  { code: "agency", name: "Agency", monthly_price: 797, description: "Alto volume com limites ampliados.", sort_order: 4, entitlements: { ad_accounts: 40, users: 30, ai_credits: 6000, automations: 150, whatsapp_reports: 6000, storage_bytes: 536870912000 } },
];

function schemaIsPending(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === "PGRST202" || error.code === "42P01" || /does not exist|schema cache/i.test(error.message ?? ""));
}

export interface WorkspaceUnit {
  id: string;
  workspace_id: string;
  kind: "infoproduto" | "saas";
  name: string;
  is_active: boolean;
}

export interface WorkspaceFoundation {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  role: string;
  units: WorkspaceUnit[];
}

export function useWorkspace() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["workspace", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<WorkspaceFoundation> => {
      const { data: workspaceId, error: bootstrapError } = await (supabase as any)
        .rpc("ensure_current_workspace");
      if (bootstrapError) {
        if (schemaIsPending(bootstrapError)) return {
          id: `legacy-${user!.id}`,
          name: user!.user_metadata?.full_name || user!.email?.split("@")[0] || "Growdash",
          currency: "BRL",
          timezone: "America/Sao_Paulo",
          role: "owner",
          units: [
            { id: "legacy-infoproduto", workspace_id: `legacy-${user!.id}`, kind: "infoproduto", name: "Infoproduto", is_active: true },
            { id: "legacy-saas", workspace_id: `legacy-${user!.id}`, kind: "saas", name: "SaaS", is_active: true },
          ],
        };
        throw bootstrapError;
      }

      const [{ data: workspace, error: workspaceError }, { data: membership, error: memberError }, { data: units, error: unitsError }] = await Promise.all([
        (supabase as any).from("workspaces").select("id, name, currency, timezone").eq("id", workspaceId).single(),
        (supabase as any).from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user!.id).single(),
        (supabase as any).from("business_units").select("id, workspace_id, kind, name, is_active").eq("workspace_id", workspaceId).eq("is_active", true).order("kind"),
      ]);

      if (workspaceError) throw workspaceError;
      if (memberError) throw memberError;
      if (unitsError) throw unitsError;
      return { ...workspace, role: membership.role, units: units ?? [] };
    },
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ["plan-catalog"],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("plan_catalog")
        .select("code, name, monthly_price, description, entitlements, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (error) {
        if (schemaIsPending(error)) return fallbackPlans;
        throw error;
      }
      return data ?? fallbackPlans;
    },
  });
}

export function useWorkspaceSubscription(workspaceId?: string) {
  return useQuery({
    queryKey: ["workspace-subscription", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("workspace_subscriptions")
        .select("workspace_id, plan_code, status, trial_ends_at, current_period_ends_at")
        .eq("workspace_id", workspaceId)
        .single();
      if (error) {
        if (schemaIsPending(error)) return { workspace_id: workspaceId, plan_code: "starter", status: "configuring", trial_ends_at: null, current_period_ends_at: null };
        throw error;
      }
      return data;
    },
  });
}
