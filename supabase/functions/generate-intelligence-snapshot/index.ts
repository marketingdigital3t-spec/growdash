import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const ratio = (a: number, b: number, factor = 1) => b > 0 ? a / b * factor : 0;

function zonedBoundary(date: string, timeZone: string, endOfDay = false) {
  const [year, month, day] = date.split("-").map(Number);
  const hour = endOfDay ? 23 : 0;
  const minute = endOfDay ? 59 : 0;
  const second = endOfDay ? 59 : 0;
  const millisecond = endOfDay ? 999 : 0;
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const offsetAt = (instant: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(instant);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second)) - instant.getTime();
  };
  let resolved = new Date(localAsUtc - offsetAt(new Date(localAsUtc)));
  resolved = new Date(localAsUtc - offsetAt(resolved));
  return resolved.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const admin = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const accountId = String(body?.account_id || "");
    if (!accountId) throw new Error("account_id required");
    const date = String(body?.date || new Date().toISOString().slice(0, 10));
    const { data: memberships } = await admin.from("workspace_members").select("workspace_id").eq("user_id", user.id);
    const workspaceIds = (memberships || []).map((membership) => membership.workspace_id);
    if (!workspaceIds.length) throw new Error("Workspace not found");
    const { data: account } = await admin.from("ad_accounts")
      .select("id, workspace_id, name, timezone_name, attribution_window, last_sync_success_at")
      .eq("id", accountId).in("workspace_id", workspaceIds).maybeSingle();
    if (!account) throw new Error("Account not found in the current workspace");
    const timezone = account.timezone_name || "America/Sao_Paulo";
    const { data: rows, error } = await admin.from("insights").select("spend, impressions, reach, clicks, leads, ads!inner(adsets!inner(campaigns!inner(ad_account_id)))").eq("date", date).eq("ads.adsets.campaigns.ad_account_id", accountId).limit(20000);
    if (error) throw error;
    const media = (rows || []).reduce((sum: Record<string, number>, row: Record<string, unknown>) => ({ spend: sum.spend + number(row.spend), impressions: sum.impressions + number(row.impressions), reach: sum.reach + number(row.reach), clicks: sum.clicks + number(row.clicks), leads: sum.leads + number(row.leads) }), { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0 });
    const { count: rdLeads } = await admin.from("rd_deals").select("id", { count: "exact", head: true }).eq("ad_account_id", accountId).gte("lead_created_at", zonedBoundary(date, timezone)).lte("lead_created_at", zonedBoundary(date, timezone, true));
    const { data: sales } = await admin.from("sales").select("net_revenue, quantity").eq("ad_account_id", accountId).eq("sale_date", date).in("status", ["confirmed", "pending"]);
    const saleCount = (sales || []).reduce((sum, sale) => sum + number(sale.quantity), 0);
    const revenue = (sales || []).reduce((sum, sale) => sum + number(sale.net_revenue), 0);
    const metrics = { ...media, rdLeads: rdLeads || 0, sales: saleCount, revenue, ctr: ratio(media.clicks, media.impressions, 100), cpm: ratio(media.spend, media.impressions, 1000), cpc: ratio(media.spend, media.clicks), cpl: ratio(media.spend, media.leads), cac: ratio(media.spend, saleCount), roas: ratio(revenue, media.spend), frequency: ratio(media.impressions, media.reach), rdCoverage: ratio(rdLeads || 0, media.leads, 100) };
    let executiveSummary = `${account.name}: R$ ${metrics.spend.toFixed(2)} investidos, ${metrics.leads} leads Meta, ${metrics.rdLeads} leads RD, CPL R$ ${metrics.cpl.toFixed(2)} e ROAS ${metrics.roas.toFixed(2)}x.`;
    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (aiKey) {
      const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "system", content: "Você é o resumo executivo diário da Growdash. Responda em português, até 100 palavras, use somente os números fornecidos, destaque risco e uma ação. Não invente dados." }, { role: "user", content: JSON.stringify({ account: account.name, date, timezone: account.timezone_name, attribution_window: account.attribution_window, metrics }) }] }) });
      if (ai.ok) executiveSummary = (await ai.json())?.choices?.[0]?.message?.content || executiveSummary;
    }
    const payload = { workspace_id: account.workspace_id, ad_account_id: accountId, snapshot_date: date, account_timezone: timezone, attribution_window: account.attribution_window || "account_default", source_freshness: { meta: account.last_sync_success_at, generated_at: new Date().toISOString() }, unified_metrics: metrics, executive_summary: executiveSummary, model: aiKey ? "google/gemini-3-flash-preview" : "deterministic-fallback" };
    const { error: upsertError } = await admin.from("intelligence_snapshots").upsert(payload, { onConflict: "workspace_id,ad_account_id,snapshot_date,attribution_window" });
    if (upsertError) throw upsertError;
    return new Response(JSON.stringify({ snapshot_date: date, account_id: accountId, metrics, executive_summary: executiveSummary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
