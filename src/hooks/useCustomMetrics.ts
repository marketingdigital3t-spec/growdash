import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CustomMetricKind = "count" | "cost_per" | "rate";
export type CustomMetricFormat = "number" | "currency" | "percent";

export interface CustomMetric {
  id: string;
  user_id: string;
  name: string;
  kind: CustomMetricKind;
  numerator_action: string | null;
  denominator_action: string | null;
  denominator_field: string | null;
  format: CustomMetricFormat;
  is_default_lead: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export function useCustomMetrics() {
  return useQuery({
    queryKey: ["custom_metrics"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("custom_metrics" as any)
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CustomMetric[];
    },
  });
}

export function useUpsertCustomMetric() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (m: Partial<CustomMetric> & { name: string; kind: CustomMetricKind }) => {
      if (!user) throw new Error("Not authenticated");
      const payload: any = { ...m, user_id: user.id };
      // If marking as default lead, unset others first
      if (payload.is_default_lead) {
        await (supabase as any)
          .from("custom_metrics" as any)
          .update({ is_default_lead: false } as any)
          .eq("user_id", user.id)
          .neq("id", payload.id ?? "00000000-0000-0000-0000-000000000000");
      }
      if (payload.id) {
        const { error } = await (supabase as any).from("custom_metrics" as any).update(payload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("custom_metrics" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_metrics"] }),
  });
}

export function useDeleteCustomMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("custom_metrics" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_metrics"] }),
  });
}

export interface ActionEntry { action_type: string; count: number; total: number }

/** Catálogo de action_types já vistos nas contas do usuário (com contagem de eventos). */
export function useAvailableActions() {
  return useQuery({
    queryKey: ["available_actions"],
    queryFn: async (): Promise<ActionEntry[]> => {
      const { data, error } = await (supabase as any)
        .from("insight_actions" as any)
        .select("action_type, value")
        .limit(50000);
      if (error) throw error;
      const map = new Map<string, { count: number; total: number }>();
      for (const r of (data || []) as any[]) {
        const ex = map.get(r.action_type) || { count: 0, total: 0 };
        ex.count += 1;
        ex.total += Number(r.value || 0);
        map.set(r.action_type, ex);
      }
      return Array.from(map.entries())
        .map(([action_type, v]) => ({ action_type, ...v }))
        .sort((a, b) => b.total - a.total);
    },
  });
}

/** Catálogo de action_types por conta (mapeado via ads → adsets → campaigns → ad_accounts). */
export function useActionsByAccount() {
  return useQuery({
    queryKey: ["actions_by_account"],
    queryFn: async (): Promise<Record<string, ActionEntry[]>> => {
      const [campaignsRes, adsetsRes, adsRes, actionsRes] = await Promise.all([
        (supabase as any).from("campaigns").select("id, ad_account_id"),
        (supabase as any).from("adsets").select("id, campaign_id"),
        (supabase as any).from("ads").select("id, adset_id"),
        (supabase as any).from("insight_actions" as any).select("ad_id, action_type, value").limit(100000),
      ]);
      if (campaignsRes.error) throw campaignsRes.error;
      if (adsetsRes.error) throw adsetsRes.error;
      if (adsRes.error) throw adsRes.error;
      if (actionsRes.error) throw actionsRes.error;

      const campaignToAccount = new Map<string, string>();
      for (const c of (campaignsRes.data || []) as any[]) campaignToAccount.set(c.id, c.ad_account_id);
      const adsetToAccount = new Map<string, string>();
      for (const s of (adsetsRes.data || []) as any[]) {
        const acc = campaignToAccount.get(s.campaign_id);
        if (acc) adsetToAccount.set(s.id, acc);
      }
      const adToAccount = new Map<string, string>();
      for (const a of (adsRes.data || []) as any[]) {
        const acc = adsetToAccount.get(a.adset_id);
        if (acc) adToAccount.set(a.id, acc);
      }

      const perAccount = new Map<string, Map<string, { count: number; total: number }>>();
      for (const r of (actionsRes.data || []) as any[]) {
        const acc = adToAccount.get(r.ad_id);
        if (!acc) continue;
        let m = perAccount.get(acc);
        if (!m) { m = new Map(); perAccount.set(acc, m); }
        const ex = m.get(r.action_type) || { count: 0, total: 0 };
        ex.count += 1;
        ex.total += Number(r.value || 0);
        m.set(r.action_type, ex);
      }

      const out: Record<string, ActionEntry[]> = {};
      for (const [acc, m] of perAccount.entries()) {
        out[acc] = Array.from(m.entries())
          .map(([action_type, v]) => ({ action_type, ...v }))
          .sort((a, b) => b.total - a.total);
      }
      return out;
    },
  });
}

/** Nome amigável para action_types conhecidos do Meta. */
export function friendlyActionLabel(action_type: string): string {
  const map: Record<string, string> = {
    "lead": "Lead (agregado)",
    "onsite_conversion.lead_grouped": "Lead (formulário instantâneo)",
    "offsite_conversion.fb_pixel_lead": "Lead (pixel — LP)",
    "offsite_conversion.fb_pixel_complete_registration": "Cadastro completo (pixel)",
    "offsite_conversion.fb_pixel_view_content": "Visualização de conteúdo (pixel)",
    "onsite_conversion.messaging_conversation_started_7d": "Mensagem iniciada (7d)",
    "landing_page_view": "Visualização de página (LP view)",
    "page_engagement": "Engajamento na página",
    "post_engagement": "Engajamento no post",
    "video_view": "Visualização de vídeo",
    "link_click": "Clique no link",
    "complete_registration": "Cadastro completo",
    "view_content": "Visualização de conteúdo",
    "purchase": "Compra",
  };
  if (map[action_type]) return map[action_type];
  if (action_type.startsWith("offsite_conversion.custom.")) {
    return `Conversão personalizada · ${action_type.split(".").pop()}`;
  }
  return action_type;
}

/** Calcula o valor de uma métrica customizada a partir de totais agregados. */
export function computeCustomMetric(
  metric: CustomMetric,
  totals: { spend: number; impressions: number; clicks: number; actions: Record<string, number> },
): number {
  const num = metric.numerator_action ? totals.actions[metric.numerator_action] || 0 : 0;
  if (metric.kind === "count") return num;
  if (metric.kind === "cost_per") return num > 0 ? totals.spend / num : 0;
  if (metric.kind === "rate") {
    let den = 0;
    if (metric.denominator_field === "impressions") den = totals.impressions;
    else if (metric.denominator_field === "clicks") den = totals.clicks;
    else if (metric.denominator_field === "spend") den = totals.spend;
    else if (metric.denominator_action) den = totals.actions[metric.denominator_action] || 0;
    return den > 0 ? (num / den) * 100 : 0;
  }
  return 0;
}
