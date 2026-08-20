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
    mutationFn: async ({ dealId, authorId, authorName, body }: { dealId: string; authorId: string; authorName: string; body: string }) => {
      const { error } = await (supabase as any).from("rd_deal_notes").insert({
        rd_deal_id: dealId,
        author_id: authorId,
        author_name: authorName,
        body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["rd_deal_notes", variables.dealId] });
    },
  });
}
