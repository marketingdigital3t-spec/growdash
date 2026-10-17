import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RDDealNote = {
  id: string;
  rd_deal_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export function useRDDealNotes(dealId: string | null) {
  return useQuery({
    queryKey: ["rd_deal_notes", dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<RDDealNote[]> => {
      const { data, error } = await (supabase as any)
        .from("rd_deal_notes")
        .select("id, rd_deal_id, author_id, author_name, body, created_at")
        .eq("rd_deal_id", dealId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RDDealNote[];
    },
  });
}

export function useCreateRDDealNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, rdConnectionId, rdProviderDealId, body }: { dealId: string; rdConnectionId: string; rdProviderDealId: string; body: string }) => {
      const { data, error } = await supabase.functions.invoke("rd-add-deal-note", {
        body: {
          rd_connection_id: rdConnectionId,
          rd_deal_id: rdProviderDealId,
          body: body.trim(),
          correlation_id: crypto.randomUUID(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["rd_deal_notes", variables.dealId] });
    },
  });
}
