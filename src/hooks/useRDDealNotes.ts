import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RDDealNote = {
  id: string;
  rd_deal_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  source: "rd" | "growdash";
  activity_type?: string;
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
      const local = ((data ?? []) as Omit<RDDealNote, "source">[]).map((item) => ({ ...item, source: "growdash" as const }));
      const { data: deal, error: dealError } = await (supabase as any)
        .from("rd_deals")
        .select("rd_connection_id, rd_deal_id")
        .eq("id", dealId)
        .maybeSingle();
      if (dealError || !deal?.rd_connection_id || !deal?.rd_deal_id) return local;
      try {
        const result = await supabase.functions.invoke("rd-list-deal-activities", {
          body: { rd_connection_id: deal.rd_connection_id, rd_deal_id: deal.rd_deal_id },
        });
        if (result.error || !Array.isArray(result.data?.activities)) return local;
        const remote = result.data.activities as RDDealNote[];
        const merged = [...remote, ...local];
        const seen = new Set<string>();
        return merged
          .filter((item) => {
            const key = `${String(item.body || "").trim().toLocaleLowerCase()}|${String(item.created_at || "").slice(0, 16)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } catch {
        return local;
      }
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
