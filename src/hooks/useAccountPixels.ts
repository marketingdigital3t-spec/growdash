import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AccountPixel {
  id: string;
  pixel_id: string;
  name: string;
  ad_account_id: string;
}

export interface PixelEvent {
  id: string;
  pixel_id: string;
  event_name: string;
  action_type: string;
  is_custom: boolean;
}

export interface AccountLpConfig {
  ad_account_id: string;
  pixel_id: string | null;
  action_type: string | null;
}

/** All pixels grouped by ad_account_id, plus their events. */
export function useAccountPixels() {
  return useQuery({
    queryKey: ["account-pixels"],
    queryFn: async () => {
      const [pxRes, evRes] = await Promise.all([
        (supabase as any).from("ad_account_pixel" as any).select("id, pixel_id, name, ad_account_id").order("name"),
        (supabase as any).from("pixel_event" as any).select("id, pixel_id, event_name, action_type, is_custom").order("event_name"),
      ]);
      if (pxRes.error) throw pxRes.error;
      if (evRes.error) throw evRes.error;
      const pixels = (pxRes.data || []) as unknown as AccountPixel[];
      const events = (evRes.data || []) as unknown as PixelEvent[];
      const byAccount: Record<string, AccountPixel[]> = {};
      for (const p of pixels) {
        if (!byAccount[p.ad_account_id]) byAccount[p.ad_account_id] = [];
        byAccount[p.ad_account_id].push(p);
      }
      const eventsByPixel: Record<string, PixelEvent[]> = {};
      for (const e of events) {
        if (!eventsByPixel[e.pixel_id]) eventsByPixel[e.pixel_id] = [];
        eventsByPixel[e.pixel_id].push(e);
      }
      return { byAccount, eventsByPixel };
    },
  });
}

export function useAccountLpConfigs() {
  return useQuery({
    queryKey: ["account-lp-configs"],
    queryFn: async (): Promise<Record<string, AccountLpConfig>> => {
      const { data, error } = await (supabase as any)
        .from("account_lp_config" as any)
        .select("ad_account_id, pixel_id, action_type");
      if (error) throw error;
      const map: Record<string, AccountLpConfig> = {};
      for (const r of (data || []) as any[]) map[r.ad_account_id] = r;
      return map;
    },
  });
}

export function useUpdateAccountLpConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: { ad_account_id: string; pixel_id: string | null; action_type: string | null }) => {
      const { error } = await (supabase as any)
        .from("account_lp_config" as any)
        .upsert({ ...cfg, updated_at: new Date().toISOString() }, { onConflict: "ad_account_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account-lp-configs"] }),
  });
}

export function useSyncMetaPixels() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (adAccountId?: string) => {
      const { data, error } = await supabase.functions.invoke("sync-meta-pixels", {
        body: adAccountId ? { adAccountId } : {},
      });
      if (error) throw error;
      return data as { pixels: number; events: number; errors?: string[] };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["account-pixels"] });
      toast({
        title: "Pixels atualizados",
        description: `${data.pixels} pixel(s) e ${data.events} evento(s) carregados.`,
      });
    },
    onError: (e) => {
      toast({ title: "Erro ao buscar pixels", description: (e as Error).message, variant: "destructive" });
    },
  });
}
