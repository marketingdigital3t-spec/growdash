import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { withRequestTimeout } from "@/lib/resilience";

const fallbackPlans = [
  {
    code: "starter",
    name: "Starter",
    monthly_price: 97,
    description: "Operação enxuta para validar a gestão.",
    sort_order: 1,
    entitlements: {
      ad_accounts: 2,
      users: 2,
      ai_credits: 150,
      automations: 3,
      whatsapp_reports: 100,
      storage_bytes: 5368709120,
    },
  },
  {
    code: "growth",
    name: "Growth",
    monthly_price: 197,
    description: "Crescimento com mais contas, IA e histórico.",
    sort_order: 2,
    entitlements: {
      ad_accounts: 6,
      users: 5,
      ai_credits: 600,
      automations: 15,
      whatsapp_reports: 500,
      storage_bytes: 26843545600,
    },
  },
  {
    code: "scale",
    name: "Scale",
    monthly_price: 397,
    description: "Operação avançada para equipes e unidades.",
    sort_order: 3,
    entitlements: {
      ad_accounts: 15,
      users: 12,
      ai_credits: 2000,
      automations: 50,
      whatsapp_reports: 2000,
      storage_bytes: 107374182400,
    },
  },
  {
    code: "agency",
    name: "Agency",
    monthly_price: 797,
    description: "Alto volume com limites ampliados.",
    sort_order: 4,
    entitlements: {
      ad_accounts: 40,
      users: 30,
      ai_credits: 6000,
      automations: 150,
      whatsapp_reports: 6000,
      storage_bytes: 536870912000,
    },
  },
];

function schemaIsPending(error: { code?: string; message?: string } | null) {
  return (
    !!error &&
    (error.code === "PGRST202" ||
      error.code === "42P01" ||
      /does not exist|schema cache/i.test(error.message ?? ""))
  );
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
    retry: false,
    // A fundação do workspace não muda durante a navegação normal. Cachear evita
    // reexecutar o bootstrap e três consultas a cada troca de módulo.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<WorkspaceFoundation> => withRequestTimeout((async () => {
      const cacheKey = `growdash:workspace:${user!.id}`;
      const cached = (): WorkspaceFoundation | null => {
        try {
          const raw = localStorage.getItem(cacheKey);
          if (!raw) return null;
          const value = JSON.parse(raw) as WorkspaceFoundation;
          return value?.id && !value.id.startsWith("legacy-") ? value : null;
        } catch {
          return null;
        }
      };
      try {
        const { data: workspaceId, error: bootstrapError } = await withRequestTimeout(
          (supabase as any).rpc("ensure_current_workspace"),
        );
        if (bootstrapError) {
          throw bootstrapError;
        }

        const { data: workspace, error: workspaceError } = await withRequestTimeout(
          (supabase as any)
            .from("workspaces")
            .select("id, name, currency, timezone")
            .eq("id", workspaceId)
            .single(),
        );
        const { data: membership, error: memberError } = await withRequestTimeout(
          (supabase as any)
            .from("workspace_members")
            .select("role")
            .eq("workspace_id", workspaceId)
            .eq("user_id", user!.id)
            .single(),
        );
        const { data: units, error: unitsError } = await withRequestTimeout(
          (supabase as any)
            .from("business_units")
            .select("id, workspace_id, kind, name, is_active")
            .eq("workspace_id", workspaceId)
            .eq("is_active", true)
            .order("kind"),
        );

        if (workspaceError) throw workspaceError;
        if (memberError) throw memberError;
        if (unitsError) throw unitsError;
        const foundation = { ...workspace, role: membership.role, units: units ?? [] };
        try {
          localStorage.setItem(cacheKey, JSON.stringify(foundation));
        } catch {
          /* cache é apenas uma otimização segura */
        }
        return foundation;
      } catch (err: any) {
        // Do not invent a legacy owner workspace after an authorization or
        // network error. A fabricated owner role can make a removed member
        // appear to have access while requests are failing. React Query keeps
        // the last successful value itself; otherwise surface the failure.
        console.warn("Workspace bootstrap failed:", err);
        const previous = cached();
        if (previous) return previous;
        throw err;
      }
    })(), 10_000),
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
      try {
        const { data, error } = await (supabase as any)
          .from("workspace_subscriptions")
          .select("workspace_id, plan_code, status, trial_ends_at, current_period_ends_at")
          .eq("workspace_id", workspaceId)
          .single();
        if (error) {
          throw error;
        }
        return data;
      } catch (err) {
        console.warn("Failsafe subscription loaded:", err);
        return {
          workspace_id: workspaceId,
          plan_code: "starter",
          status: "configuring",
          trial_ends_at: null,
          current_period_ends_at: null,
        };
      }
    },
  });
}
