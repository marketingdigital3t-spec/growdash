import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
const admin = createClient(url, serviceKey);
const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const ratio = (value: number, base: number) => base > 0 ? value / base : 0;

async function userFor(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const client = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data } = await client.auth.getUser();
  return data.user || null;
}

async function meta(token: string, id: string, fields: Record<string, string>) {
  const query = new URLSearchParams({ access_token: token, ...fields });
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${id}?${query}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(String(data?.error?.message || `META_HTTP_${response.status}`));
  return data;
}

async function mutate(token: string, id: string, fields: Record<string, string>) {
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${id}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ access_token: token, ...fields }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(String(data?.error?.message || `META_HTTP_${response.status}`));
  return data;
}

function score(metrics: { leads: number; qualified: number; opportunities: number; sales: number; spend: number }, baseline: any, referenceCpl: number) {
  const leadQuality = ratio(metrics.qualified, metrics.leads);
  const opportunityQuality = ratio(metrics.opportunities, Math.max(metrics.qualified, metrics.leads));
  const saleQuality = ratio(metrics.sales, Math.max(metrics.opportunities, metrics.qualified, metrics.leads));
  const cpl = ratio(metrics.spend, metrics.leads);
  const cplEfficiency = referenceCpl > 0 && cpl > 0 ? Math.min(1, referenceCpl / cpl) : 0;
  return (saleQuality * 0.4 + opportunityQuality * 0.3 + leadQuality * 0.15 + cplEfficiency * 0.1) * 100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await userFor(req);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: workspace } = await admin.from("workspaces").select("id").eq("owner_id", user.id).maybeSingle();
    if (!workspace) return json({ error: "WORKSPACE_NOT_FOUND" }, 404);
    const { data: experiments, error: experimentsError } = await admin.from("growth_experiments").select("*").eq("workspace_id", workspace.id).eq("status", "measuring").limit(20);
    if (experimentsError) throw new Error(`EXPERIMENTS_QUERY_FAILED:${experimentsError.message}`);
    const results: Array<Record<string, unknown>> = [];
    for (const experiment of experiments || []) {
      try {
        const { data: variants, error: variantsError } = await admin.from("growth_experiment_variants").select("new_ad_id,new_adset_id").eq("experiment_id", experiment.id);
        if (variantsError) throw new Error(`VARIANTS_QUERY_FAILED:${variantsError.message}`);
        const adIds = (variants || []).map((variant) => variant.new_ad_id).filter(Boolean);
        if (!adIds.length) continue;
        const { data: snapshot } = await admin.from("growth_snapshots").select("quality,freshness_minutes,attribution_coverage,metrics").eq("id", experiment.source_snapshot_id).maybeSingle();
        if (!snapshot || snapshot.quality !== "confirmed" || Number(snapshot.freshness_minutes || 0) > 90 || Number(snapshot.attribution_coverage || 0) < 0.8) throw new Error("SNAPSHOT_NOT_DECISION_READY");
        const { data: insights, error: insightsError } = await admin.from("insights").select("ad_id,spend,leads,date").in("ad_id", adIds).gte("date", String(experiment.started_at || "").slice(0, 10));
        if (insightsError) throw new Error(`INSIGHTS_QUERY_FAILED:${insightsError.message}`);
        const { data: deals, error: dealsError } = await admin.from("rd_deals").select("meta_ad_id,win,stage_bucket,amount_total").eq("ad_account_id", experiment.ad_account_id).in("meta_ad_id", adIds);
        if (dealsError) throw new Error(`RD_QUERY_FAILED:${dealsError.message}`);
        const metrics = { spend: (insights || []).reduce((sum, row) => sum + num(row.spend), 0), leads: (insights || []).reduce((sum, row) => sum + num(row.leads), 0), qualified: (deals || []).filter((deal) => ["sql", "opportunity", "client"].includes(String(deal.stage_bucket || "").toLowerCase())).length, opportunities: (deals || []).filter((deal) => ["opportunity", "qualified", "proposal", "sql"].includes(String(deal.stage_bucket || "").toLowerCase())).length, sales: (deals || []).filter((deal) => deal.win).length };
        const hours = experiment.started_at ? (Date.now() - new Date(experiment.started_at).getTime()) / 3600000 : 0;
        const baseline = (await admin.from("growth_snapshots").select("metrics").eq("id", experiment.source_snapshot_id).maybeSingle()).data?.metrics || {};
        const currentScore = score(metrics, baseline, num(experiment.reference_cpl));
        const baselineScore = score({ spend: num(baseline.spend), leads: num(baseline.leads), qualified: num(baseline.qualifiedLeads), opportunities: num(baseline.opportunities), sales: num(baseline.sales) }, baseline, num(experiment.reference_cpl));
        const exhausted = metrics.spend >= num(experiment.test_budget);
        const stop = exhausted && metrics.qualified === 0 && metrics.opportunities === 0 && metrics.sales === 0;
        const complete = hours >= num(experiment.window_hours || 72);
        const promote = complete && (metrics.sales > 0 || metrics.opportunities > 0 || metrics.qualified > 0) && currentScore >= Math.max(1, baselineScore * 1.05);
        const testAdsetId = experiment.provider_state?.test_adset_id;
        const { data: account } = await admin.from("ad_accounts").select("access_token").eq("id", experiment.ad_account_id).eq("user_id", user.id).maybeSingle();
        if (!account?.access_token || !testAdsetId) throw new Error("REMOTE_EXPERIMENT_STATE_MISSING");
        if (stop || (complete && !promote)) {
          await mutate(account.access_token, testAdsetId, { status: "PAUSED" });
          await admin.from("growth_experiments").update({ status: "stopped", current_snapshot_id: null, updated_at: new Date().toISOString() }).eq("id", experiment.id);
          await admin.from("growth_budget_ledger").insert({ workspace_id: workspace.id, ad_account_id: experiment.ad_account_id, experiment_id: experiment.id, entry_type: "release", amount: Math.max(0, num(experiment.test_budget) - metrics.spend), idempotency_key: `release:${experiment.id}`, evidence: { metrics, hours, currentScore, baselineScore } }).select("id").maybeSingle();
          await admin.from("growth_decisions").insert({ workspace_id: workspace.id, experiment_id: experiment.id, decision: "stop", reason: stop ? "NO_QUALIFIED_SIGNAL" : "QUALITY_BELOW_BASELINE", score: currentScore, evidence: { metrics, hours, baselineScore } });
          results.push({ id: experiment.id, status: "stopped", metrics });
        } else if (promote) {
          const { data: sourceAdset } = await admin.from("adsets").select("daily_budget").eq("id", experiment.source_adset_id).maybeSingle();
          const nextBudget = num(sourceAdset?.daily_budget) > 0 ? num(sourceAdset?.daily_budget) * 1.1 : null;
          if (nextBudget) await mutate(account.access_token, experiment.source_adset_id, { daily_budget: String(Math.round(nextBudget * 100)) });
          await admin.from("growth_experiments").update({ status: "promoted", updated_at: new Date().toISOString() }).eq("id", experiment.id);
          await admin.from("growth_decisions").insert({ workspace_id: workspace.id, experiment_id: experiment.id, decision: "promote", reason: "QUALITY_ABOVE_BASELINE", score: currentScore, evidence: { metrics, hours, baselineScore, nextBudget } });
          await admin.from("growth_learning_records").insert({ workspace_id: workspace.id, ad_account_id: experiment.ad_account_id, hypothesis: experiment.hypothesis, pattern: "creative_variant_quality", outcome: "promoted", evidence: { metrics, currentScore, baselineScore }, prompt_version: "creative-factory.v1" });
          results.push({ id: experiment.id, status: "promoted", metrics });
        } else {
          results.push({ id: experiment.id, status: "measuring", metrics, hours });
        }
      } catch (error) {
        await admin.from("growth_experiments").update({ status: "blocked", block_reason: error instanceof Error ? error.message.slice(0, 500) : "EVALUATION_FAILED", updated_at: new Date().toISOString() }).eq("id", experiment.id);
        results.push({ id: experiment.id, status: "blocked" });
      }
    }
    return json({ status: "completed", results });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "GROWTH_EXPERIMENT_EVALUATE_FAILED" }, 500);
  }
});
