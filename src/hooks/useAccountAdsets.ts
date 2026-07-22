import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AccountAdsetRow {
  id: string;
  campaign_id: string;
  status: string | null;
  destination_type: string | null;
}

/**
 * Fetches adsets for the visible ad account(s). Used to classify campaigns
 * by their configured destination_type (ON_AD, WEBSITE, MESSENGER, ...) —
 * a structural signal that exists even before any impression/lead is recorded.
 */
export function useAccountAdsets(adAccountId?: string) {
  return useQuery({
    queryKey: ["account-adsets", adAccountId ?? "all"],
    queryFn: async (): Promise<AccountAdsetRow[]> => {
      // Resolve campaign_ids scoped to the selected account(s) first,
      // because adsets table doesn't have ad_account_id.
      let campQ = (supabase as any).from("campaigns").select("id, ad_account_id");
      if (adAccountId) campQ = campQ.eq("ad_account_id", adAccountId);
      const { data: camps, error: e1 } = await campQ;
      if (e1) throw e1;
      const ids = (camps || []).map((c: any) => c.id);
      if (ids.length === 0) return [];

      const PAGE = 1000;
      const all: AccountAdsetRow[] = [];
      const CHUNK = 500;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("adsets")
            .select("id, campaign_id, status, destination_type")
            .in("campaign_id", chunk)
            .range(from, from + PAGE - 1);
          if (error) throw error;
          const rows = (data || []) as AccountAdsetRow[];
          all.push(...rows);
          if (rows.length < PAGE) break;
        }
      }
      return all;
    },
  });
}
