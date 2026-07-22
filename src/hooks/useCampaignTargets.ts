import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCampaignTarget(campaignId?: string) {
  return useQuery({
    queryKey: ["campaign_target", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_targets")
        .select("campaign_id, target_cpl")
        .eq("campaign_id", campaignId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSetCampaignTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, targetCpl }: { campaignId: string; targetCpl: number | null }) => {
      if (targetCpl == null) {
        const { error } = await (supabase as any).from("campaign_targets").delete().eq("campaign_id", campaignId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("campaign_targets")
          .upsert({ campaign_id: campaignId, target_cpl: targetCpl }, { onConflict: "campaign_id" });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["campaign_target", vars.campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign_diagnostics_v2"] });
    },
  });
}

export function useCampaignChanges(campaignId?: string) {
  return useQuery({
    queryKey: ["campaign_changes", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_changes")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddCampaignChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, note, changeType = "manual_note", field, oldValue, newValue }: { campaignId: string; note?: string; changeType?: string; field?: string; oldValue?: string; newValue?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("campaign_changes").insert({
        campaign_id: campaignId,
        change_type: changeType,
        field, old_value: oldValue, new_value: newValue,
        note, created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["campaign_changes", vars.campaignId] }),
  });
}

export function useLastTopUp(adAccountId?: string) {
  return useQuery({
    queryKey: ["last_top_up", adAccountId],
    enabled: !!adAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_balance_events")
        .select("event_at, delta, new_balance")
        .eq("ad_account_id", adAccountId!)
        .gt("delta", 0)
        .order("event_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useNextTopUpEstimate(adAccountId?: string) {
  return useQuery({
    queryKey: ["next_top_up_estimate", adAccountId],
    enabled: !!adAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_balance_events")
        .select("event_at, delta")
        .eq("ad_account_id", adAccountId!)
        .gt("delta", 0)
        .order("event_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      const events = data ?? [];
      if (events.length < 2) {
        return { hasEnoughHistory: false, estimatedDate: null as Date | null, avgAmount: 0 };
      }
      const intervals: number[] = [];
      for (let i = 0; i < events.length - 1; i++) {
        const a = new Date(events[i].event_at).getTime();
        const b = new Date(events[i + 1].event_at).getTime();
        intervals.push(Math.abs(a - b) / 86400000);
      }
      const avgIntervalDays = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const avgAmount = events.reduce((s, e) => s + Number(e.delta), 0) / events.length;
      const last = new Date(events[0].event_at);
      const estimatedDate = new Date(last.getTime() + avgIntervalDays * 86400000);
      return { hasEnoughHistory: true, estimatedDate, avgAmount, avgIntervalDays };
    },
  });
}
