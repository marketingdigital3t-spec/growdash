import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HealthLevel = "ok" | "warning" | "error";

export interface FunnelSyncRow {
  funnel_id: string;
  funnel_name: string;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  duration_ms: number | null;
  deals_24h: number;
  deals_7d: number;
  deals_30d: number;
  level: HealthLevel;
}

export interface DataQuality {
  totalDeals30d: number;
  utmCompletePct: number;
  ownerNamePct: number;
  winsWithAmountPct: number;
  level: HealthLevel;
}

export interface WebhookHealth {
  events24h: number;
  events7d: number;
  avgPerDay30d: number;
  ratioVsAvg: number; // last 24h vs daily avg
  lastEventAt: string | null;
  level: HealthLevel;
}

export interface AttributionHealth {
  totalDeals30d: number;
  withTouchesPct: number;
  multiTouchPct: number;
  matchedTouchesPct: number;
  level: HealthLevel;
}

export interface RecentRun {
  id: string;
  funnel_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: string;
  duration_ms: number | null;
  deals_fetched: number;
  errors_total: number;
  error_message: string | null;
}

export interface RDObservability {
  checkedAt: string;
  funnels: FunnelSyncRow[];
  dataQuality: DataQuality;
  webhooks: WebhookHealth;
  attribution: AttributionHealth;
  recentRuns: RecentRun[];
}

const pct = (n: number, d: number) => (d > 0 ? n / d : 0);
const levelFromPct = (p: number, okMin = 0.8, warnMin = 0.5): HealthLevel =>
  p >= okMin ? "ok" : p >= warnMin ? "warning" : "error";

export function useRDObservability() {
  return useQuery<RDObservability>({
    queryKey: ["rd_observability"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const now = Date.now();
      const since24 = new Date(now - 24 * 3600_000).toISOString();
      const since7 = new Date(now - 7 * 86400_000).toISOString();
      const since30 = new Date(now - 30 * 86400_000).toISOString();

      // ---- Funnels + sync_runs ----
      const { data: funnels = [] } = await supabase
        .from("rd_funnels")
        .select("id, name")
        .eq("is_active", true);

      const funnelRows: FunnelSyncRow[] = [];
      for (const f of funnels ?? []) {
        const [{ data: lastRunArr }, { count: c24 }, { count: c7 }, { count: c30 }] = await Promise.all([
          supabase
            .from("sync_runs")
            .select("started_at, finished_at, status, duration_ms, error_message")
            .eq("funnel_id", f.id)
            .order("started_at", { ascending: false })
            .limit(1),
          supabase.from("rd_deals").select("id", { count: "exact", head: true }).eq("rd_funnel_id", f.id).gte("updated_at", since24),
          supabase.from("rd_deals").select("id", { count: "exact", head: true }).eq("rd_funnel_id", f.id).gte("updated_at", since7),
          supabase.from("rd_deals").select("id", { count: "exact", head: true }).eq("rd_funnel_id", f.id).gte("updated_at", since30),
        ]);
        const last = lastRunArr?.[0];
        const lastTs = last?.started_at ? new Date(last.started_at).getTime() : 0;
        const stale = !lastTs || now - lastTs > 2 * 3600_000;
        const noRecent = (c7 ?? 0) === 0;
        const failed = last?.status === "failed";
        const level: HealthLevel = failed ? "error" : noRecent || stale ? "warning" : "ok";

        funnelRows.push({
          funnel_id: f.id,
          funnel_name: f.name,
          last_run_at: last?.started_at ?? null,
          last_status: last?.status ?? null,
          last_error: last?.error_message ?? null,
          duration_ms: last?.duration_ms ?? null,
          deals_24h: c24 ?? 0,
          deals_7d: c7 ?? 0,
          deals_30d: c30 ?? 0,
          level,
        });
      }

      // ---- Data quality (deals últimos 30d) ----
      const { data: dealsQ = [] } = await supabase
        .from("rd_deals")
        .select("utm_source, utm_medium, utm_campaign, deal_owner_name, win, amount_total, updated_at")
        .gte("updated_at", since30)
        .limit(5000);

      const totalDeals30d = dealsQ?.length ?? 0;
      const utmComplete = (dealsQ ?? []).filter(
        (d) => d.utm_source && d.utm_medium && d.utm_campaign,
      ).length;
      const ownerComplete = (dealsQ ?? []).filter((d) => !!d.deal_owner_name).length;
      const wins = (dealsQ ?? []).filter((d) => d.win === true);
      const winsWithAmount = wins.filter((d) => Number(d.amount_total || 0) > 0).length;

      const utmPct = pct(utmComplete, totalDeals30d);
      const ownerPct = pct(ownerComplete, totalDeals30d);
      const winsAmountPct = pct(winsWithAmount, wins.length);
      const dqLevel: HealthLevel = (() => {
        const levels = [levelFromPct(utmPct), levelFromPct(ownerPct), levelFromPct(winsAmountPct, 0.95, 0.7)];
        if (levels.includes("error")) return "error";
        if (levels.includes("warning")) return "warning";
        return "ok";
      })();

      const dataQuality: DataQuality = {
        totalDeals30d,
        utmCompletePct: utmPct,
        ownerNamePct: ownerPct,
        winsWithAmountPct: winsAmountPct,
        level: dqLevel,
      };

      // ---- Webhooks (proxy via rd_deals.updated_at) ----
      const { count: ev24 } = await supabase
        .from("rd_deals")
        .select("id", { count: "exact", head: true })
        .gte("updated_at", since24);
      const { count: ev7 } = await supabase
        .from("rd_deals")
        .select("id", { count: "exact", head: true })
        .gte("updated_at", since7);
      const { count: ev30 } = await supabase
        .from("rd_deals")
        .select("id", { count: "exact", head: true })
        .gte("updated_at", since30);
      const { data: lastEvArr } = await supabase
        .from("rd_deals")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1);

      const avgPerDay30d = (ev30 ?? 0) / 30;
      const ratio = avgPerDay30d > 0 ? (ev24 ?? 0) / avgPerDay30d : 1;
      const whLevel: HealthLevel =
        (ev24 ?? 0) === 0 && avgPerDay30d > 1
          ? "error"
          : ratio < 0.3 && avgPerDay30d > 1
          ? "warning"
          : "ok";

      const webhooks: WebhookHealth = {
        events24h: ev24 ?? 0,
        events7d: ev7 ?? 0,
        avgPerDay30d,
        ratioVsAvg: ratio,
        lastEventAt: lastEvArr?.[0]?.updated_at ?? null,
        level: whLevel,
      };

      // ---- Attribution health ----
      const { data: dealsAttr = [] } = await supabase
        .from("rd_deals")
        .select("touch_count, first_touch_utm_campaign")
        .gte("updated_at", since30)
        .limit(5000);

      const attrTotal = dealsAttr?.length ?? 0;
      const withTouches = (dealsAttr ?? []).filter((d) => (d.touch_count ?? 0) > 0).length;
      const multi = (dealsAttr ?? []).filter((d) => (d.touch_count ?? 0) > 1).length;

      const { count: totalTouches } = await supabase
        .from("rd_deal_touches")
        .select("id", { count: "exact", head: true })
        .gte("touch_at", since30);
      const { count: matchedTouches } = await supabase
        .from("rd_deal_touches")
        .select("id", { count: "exact", head: true })
        .not("matched_campaign_id", "is", null)
        .gte("touch_at", since30);

      const withTouchesPct = pct(withTouches, attrTotal);
      const multiTouchPct = pct(multi, withTouches);
      const matchedPct = pct(matchedTouches ?? 0, totalTouches ?? 0);

      const attrLevel: HealthLevel =
        withTouchesPct < 0.3
          ? "error"
          : withTouchesPct < 0.6 || matchedPct < 0.6
          ? "warning"
          : "ok";

      const attribution: AttributionHealth = {
        totalDeals30d: attrTotal,
        withTouchesPct,
        multiTouchPct,
        matchedTouchesPct: matchedPct,
        level: attrLevel,
      };

      // ---- Recent runs (últimas 10) ----
      const { data: runs = [] } = await supabase
        .from("sync_runs")
        .select("id, funnel_id, started_at, finished_at, status, duration_ms, deals_fetched, errors_total, error_message")
        .order("started_at", { ascending: false })
        .limit(10);

      return {
        checkedAt: new Date().toISOString(),
        funnels: funnelRows,
        dataQuality,
        webhooks,
        attribution,
        recentRuns: (runs ?? []) as RecentRun[],
      };
    },
  });
}
