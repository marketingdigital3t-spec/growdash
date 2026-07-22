import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FunnelRecord {
  id: string;
  user_id: string;
  name: string;
  nodes: any[];
  connections: any[];
  funnel_type: "blank" | "linked";
  ad_account_id: string | null;
  campaign_ids: string[];
  created_at: string;
  updated_at: string;
}

export function useFunnels() {
  return useQuery({
    queryKey: ["funnels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funnels")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as FunnelRecord[];
    },
  });
}

export function useFunnel(id: string | null) {
  return useQuery({
    queryKey: ["funnel", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from("funnels")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as FunnelRecord;
    },
    enabled: !!id,
  });
}

export function useCreateFunnel() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async ({
      name,
      nodes,
      connections,
      funnel_type = "blank",
      ad_account_id,
      campaign_ids,
    }: {
      name: string;
      nodes: any[];
      connections: any[];
      funnel_type?: "blank" | "linked";
      ad_account_id?: string | null;
      campaign_ids?: string[];
    }) => {
      const { data, error } = await (supabase as any)
        .from("funnels")
        .insert({
          user_id: session!.user.id,
          name,
          nodes: nodes as any,
          connections: connections as any,
          funnel_type,
          ad_account_id: ad_account_id || null,
          campaign_ids: campaign_ids || [],
        })
        .select()
        .single();
      if (error) throw error;
      return data as FunnelRecord;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["funnels"] }),
  });
}

export function useUpdateFunnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, nodes, connections }: { id: string; name?: string; nodes?: any[]; connections?: any[] }) => {
      const update: any = {};
      if (name !== undefined) update.name = name;
      if (nodes !== undefined) update.nodes = nodes;
      if (connections !== undefined) update.connections = connections;
      const { data, error } = await (supabase as any)
        .from("funnels")
        .update(update)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as FunnelRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["funnels"] });
      queryClient.invalidateQueries({ queryKey: ["funnel", data.id] });
    },
  });
}

export function useDeleteFunnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("funnels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["funnels"] }),
  });
}
