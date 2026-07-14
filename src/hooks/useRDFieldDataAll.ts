import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RDDealForField {
  id: string;
  win: boolean;
  custom_fields: Record<string, string> | null;
}

export interface SaleForField {
  id: string;
  rd_deal_id: string | null;
  custom_fields: Record<string, string> | null;
}

async function fetchAllPaged<T>(
  build: (from: number, to: number) => any,
): Promise<T[]> {
  const PAGE = 1000;
  const MAX = 30;
  let all: T[] = [];
  for (let p = 0; p < MAX; p++) {
    const from = p * PAGE;
    const to = from + PAGE - 1;
    const { data, error } = await build(from, to);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    all = all.concat(batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

/**
 * Fetches ALL rd_deals + sales for the account that have the given custom field key
 * populated. Ignores date filters — used by the RD custom-field pie widget which
 * needs to reflect the universe of leads (not the dashboard period).
 */
export function useRDFieldDataAll(adAccountId: string | null | undefined, fieldKey: string | null | undefined) {
  return useQuery({
    queryKey: ["rd_field_data_all", adAccountId ?? "none", fieldKey ?? "none"],
    enabled: !!adAccountId && !!fieldKey,
    queryFn: async () => {
      const acc = adAccountId!;
      const key = fieldKey!;
      const path = `custom_fields->>${key}`;

      const deals = await fetchAllPaged<RDDealForField>((from, to) =>
        supabase
          .from("rd_deals")
          .select("id, win, custom_fields")
          .eq("ad_account_id", acc)
          .not(path, "is", null)
          .order("id", { ascending: true })
          .range(from, to),
      );

      // Sales: those with the field populated directly + those linked to one of the deals
      const dealIds = deals.map((d) => d.id);
      const salesByField = await fetchAllPaged<SaleForField>((from, to) =>
        supabase
          .from("sales")
          .select("id, rd_deal_id, custom_fields")
          .eq("ad_account_id", acc)
          .not(path, "is", null)
          .order("id", { ascending: true })
          .range(from, to),
      );

      let salesByDeal: SaleForField[] = [];
      if (dealIds.length > 0) {
        // chunk IN to avoid URL limits
        const CHUNK = 200;
        for (let i = 0; i < dealIds.length; i += CHUNK) {
          const slice = dealIds.slice(i, i + CHUNK);
          const { data, error } = await supabase
            .from("sales")
            .select("id, rd_deal_id, custom_fields")
            .eq("ad_account_id", acc)
            .in("rd_deal_id", slice);
          if (error) throw error;
          salesByDeal = salesByDeal.concat((data ?? []) as SaleForField[]);
        }
      }

      const dealCfMap = new Map(deals.map((d) => [d.id, d.custom_fields]));
      const map = new Map<string, SaleForField>();
      for (const s of [...salesByField, ...salesByDeal]) {
        // ensure custom_fields fallback from linked deal so resolveBucket works
        const cf =
          s.custom_fields && s.custom_fields[key]
            ? s.custom_fields
            : s.rd_deal_id
            ? dealCfMap.get(s.rd_deal_id) ?? s.custom_fields
            : s.custom_fields;
        map.set(s.id, { ...s, custom_fields: cf });
      }

      return { deals, sales: Array.from(map.values()) };
    },
  });
}
