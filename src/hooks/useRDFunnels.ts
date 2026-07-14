import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RDFunnel {
  id: string;
  user_id: string;
  ad_account_id: string;
  name: string;
  expert_name: string | null;
  rd_funnel_id: string | null;
  utm_campaign_pattern: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useRDFunnels(adAccountId?: string) {
  return useQuery({
    queryKey: ["rd_funnels", adAccountId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("rd_funnels").select("*").order("created_at", { ascending: true });
      if (adAccountId) q = q.eq("ad_account_id", adAccountId);
      const { data, error } = await q;
      if (error) throw error;
      return data as RDFunnel[];
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
      if (error) throw error;
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
      if (error) throw error;
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
