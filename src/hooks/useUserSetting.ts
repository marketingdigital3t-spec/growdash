import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type LeadActionScope = "native_form" | "landing_page";

export interface AccountLeadActions {
  native: string[];
  lp: string[];
}

/** Reads the per-account lead-action map, split by scope (native form vs landing page). */
export function useAccountLeadActions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["account-lead-actions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Record<string, AccountLeadActions>> => {
      const { data, error } = await (supabase as any)
        .from("account_lead_action" as any)
        .select("ad_account_id, lp_lead_action, scope");
      if (error) throw error;
      const map: Record<string, AccountLeadActions> = {};
      for (const r of (data || []) as any[]) {
        if (!map[r.ad_account_id]) map[r.ad_account_id] = { native: [], lp: [] };
        const bucket = r.scope === "native_form" ? "native" : "lp";
        map[r.ad_account_id][bucket].push(r.lp_lead_action);
      }
      return map;
    },
  });
}

export function useUpdateAccountLeadAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      adAccountId,
      scope,
      values,
    }: {
      adAccountId: string;
      scope: LeadActionScope;
      values: string[];
    }) => {
      // Replace strategy: delete all rows in that scope, then insert the new set.
      const { error: delErr } = await (supabase as any)
        .from("account_lead_action" as any)
        .delete()
        .eq("ad_account_id", adAccountId)
        .eq("scope", scope);
      if (delErr) throw delErr;
      if (values.length > 0) {
        const rows = values.map((v) => ({
          ad_account_id: adAccountId,
          lp_lead_action: v,
          scope,
        }));
        const { error } = await (supabase as any).from("account_lead_action" as any).insert(rows as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-lead-actions"] });
    },
  });
}

/** Resolves the lead-action list for a specific account + scope (no global fallback). */
export function resolveLeadActions(
  accountId: string | null | undefined,
  perAccount: Record<string, AccountLeadActions> | undefined,
  scope: LeadActionScope = "landing_page",
): string[] {
  if (!accountId) return [];
  const entry = perAccount?.[accountId];
  if (!entry) return [];
  return scope === "native_form" ? entry.native : entry.lp;
}
