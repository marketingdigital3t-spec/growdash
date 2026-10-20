import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { withRequestTimeout } from "@/lib/resilience";
import { readLocalCache, writeLocalCache } from "@/lib/localCache";

export interface RDFunnel {
  id: string;
  user_id: string;
  ad_account_id: string | null;
  rd_connection_id?: string | null;
  name: string;
  expert_name: string | null;
  rd_funnel_id: string | null;
  utm_campaign_pattern: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useRDFunnels(adAccountId?: string, enabled = true, adAccountIds?: string[]) {
  const { user } = useAuth();
  const cacheKey = user?.id ? `growdash:rd-funnels:${user.id}:${adAccountId ?? "all"}:${adAccountIds?.slice().sort().join(",") ?? ""}` : "";
  const cachedFunnels = readLocalCache<RDFunnel[]>(cacheKey);
  return useQuery({
    // Do not retain a previous user's funnels while the session changes.
    queryKey: ["rd_funnels", user?.id ?? "anonymous", adAccountId ?? "all", adAccountIds?.slice().sort().join(",") ?? ""],
    enabled: enabled && !!user,
    // A 503/PGRST002 means PostgREST cannot reach the database. Retrying the
    // same request immediately only doubles the visible loading delay; the
    // manual action and reconnect listener remain available for recovery.
    retry: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    placeholderData: cachedFunnels,
    queryFn: async () => {
      let q = supabase.from("rd_funnels").select("*").order("created_at", { ascending: true });
      if (adAccountId) q = q.eq("ad_account_id", adAccountId);
      else if (adAccountIds?.length) q = q.in("ad_account_id", adAccountIds);
      const { data, error } = await withRequestTimeout(q, 15_000);
      if (error) throw error;
      const result = data as RDFunnel[];
      writeLocalCache(cacheKey, result);
      return result;
    },
  });
}

export function useCreateRDFunnel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<RDFunnel, "id" | "user_id" | "created_at" | "updated_at" | "is_active"> & { is_active?: boolean }) => {
      const { data, error } = await supabase
        .from("rd_funnels")
        .insert({ ...input, user_id: user!.id, is_active: input.is_active ?? true })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("Este funil do RD já está vinculado e ativo em outra conexão. Desative o vínculo atual antes de ativá-lo aqui.");
        throw error;
      }
      return data as RDFunnel;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rd_funnels"] }),
  });
}

export function useUpdateRDFunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<RDFunnel> & { id: string }) => {
      const { data, error } = await supabase.from("rd_funnels").update(input).eq("id", id).select().single();
      if (error) {
        if (error.code === "23505") throw new Error("Este funil do RD já está ativo em outra conexão. O vínculo ativo atual foi preservado para evitar duplicação.");
        throw error;
      }
      return data as RDFunnel;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rd_funnels"] }),
  });
}

export function useDeleteRDFunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rd_funnels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rd_funnels"] }),
  });
}

export function useImportRDFunnels() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ connectionId, pipelines }: { connectionId: string; pipelines: Array<{ id: string; name: string }> }) => {
      if (!user) throw new Error("Sessão não encontrada.");
      const { data: existing, error: existingError } = await supabase
        .from("rd_funnels")
        .select("id,rd_funnel_id,rd_connection_id")
        .eq("user_id", user.id);
      if (existingError) throw existingError;
      const known = new Set((existing ?? []).map((funnel) => funnel.rd_funnel_id).filter(Boolean));
      for (const funnel of existing ?? []) {
        if (funnel.rd_funnel_id && funnel.rd_connection_id === null && pipelines.some((pipeline) => pipeline.id === funnel.rd_funnel_id)) {
          const { error } = await supabase.from("rd_funnels").update({ rd_connection_id: connectionId, ad_account_id: null }).eq("id", funnel.id);
          if (error) throw error;
        }
      }
      const rows = pipelines
        .filter((pipeline) => pipeline.id && !known.has(pipeline.id))
        .map((pipeline) => ({
          user_id: user.id,
          ad_account_id: null,
          rd_connection_id: connectionId,
          name: pipeline.name,
          expert_name: null,
          rd_funnel_id: pipeline.id,
          utm_campaign_pattern: null,
          is_active: true,
        }));
      if (rows.length) {
        const { error } = await supabase.from("rd_funnels").insert(rows);
        if (error) throw error;
      }
      return { imported: rows.length, total: pipelines.length };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rd_funnels"] }),
  });
}
