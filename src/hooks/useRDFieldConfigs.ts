import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type RDFieldType = "enum" | "number";
export type RDFieldSource = "deal" | "contact" | "both";

export interface RDFieldOption {
  label: string;
  value?: string;          // for enum: canonical value
  min?: number | null;     // for number: range
  max?: number | null;
}

export interface RDFieldConfig {
  id: string;
  user_id: string;
  ad_account_id: string;
  key: string;
  label: string;
  rd_source: RDFieldSource;
  rd_field_label: string;
  rd_field_aliases: string[];
  field_type: RDFieldType;
  options: RDFieldOption[];
  show_in_dashboard: boolean;
  created_at: string;
  updated_at: string;
}

export function useRDFieldConfigs(adAccountId?: string | null) {
  return useQuery({
    queryKey: ["rd_field_configs", adAccountId ?? "all"],
    enabled: !!adAccountId,
    queryFn: async () => {
      let q = (supabase as any).from("rd_field_configs" as any).select("*").order("created_at");
      if (adAccountId) q = q.eq("ad_account_id", adAccountId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data as any[]) ?? []) as RDFieldConfig[];
    },
  });
}

export function useSaveRDFieldConfig() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<RDFieldConfig> & { ad_account_id: string }) => {
      if (input.id) {
        const { id, user_id, created_at, updated_at, ...rest } = input as any;
        const { error } = await (supabase as any).from("rd_field_configs" as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const payload = { ...input, user_id: session!.user.id };
        const { error } = await (supabase as any).from("rd_field_configs" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rd_field_configs"] }),
  });
}

export function useDeleteRDFieldConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("rd_field_configs" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rd_field_configs"] }),
  });
}

/** Resolve which bucket a raw RD value falls into for a given config. */
export function resolveBucket(cfg: RDFieldConfig, raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  if (cfg.field_type === "enum") {
    const norm = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const match = cfg.options.find((o) => {
      const candidates = [o.label, o.value].filter(Boolean) as string[];
      return candidates.some(
        (c) => c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === norm,
      );
    });
    return match?.label ?? raw;
  }
  // number: parse digits
  const digits = raw.replace(/[^\d]/g, "");
  const n = digits ? Number(digits) : NaN;
  if (!Number.isFinite(n)) {
    // text-only number field (e.g. "Acima de R$ 10 milhões") — match by label
    const norm = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const match = cfg.options.find(
      (o) => o.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === norm,
    );
    return match?.label ?? raw;
  }
  const match = cfg.options.find(
    (o) => (o.min == null || n >= o.min) && (o.max == null || n <= o.max),
  );
  return match?.label ?? "Outros";
}
