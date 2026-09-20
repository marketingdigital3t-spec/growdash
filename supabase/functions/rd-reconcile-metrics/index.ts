import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey);
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };

async function reprocessMissingDeals(funnel: { id: string; user_id: string }, dealIds: string[]) {
  if (dealIds.length === 0) return { attempted: 0, ok: true, response: null };
  const response = await fetch(`${url}/functions/v1/rd-sync-deals`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      funnel_id: funnel.id,
      deal_ids: dealIds,
      service_user_id: funnel.user_id,
      cron_trigger: true,
      trigger_source: "rd_metric_reconciliation",
    }),
  });
  const payload = await response.json().catch(() => ({}));
  return { attempted: dealIds.length, ok: response.ok && payload?.success !== false && payload?.ok !== false, response: { status: response.status, payload } };
}

function isWon(stage: unknown, win: unknown) {
  if (win === true) return true;
  const name = String(stage || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (!name || /\b(pre|pos) venda\b/.test(name)) return false;
  return /^(venda|vendas|sale|sales)$/.test(name) || /\b(vendas? realizadas?|vendas? concluidas?|vendas? ganhas?|fechado ganho|ganho|won|cliente)\b/.test(name);
}

async function readAll(table: string, select: string, funnelId: string) {
  const rows: any[] = [];
  for (let page = 0; ; page += 1) {
    const { data, error } = await admin.from(table).select(select).eq("rd_funnel_id", funnelId).range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer || bearer !== serviceKey) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const { data: funnels, error: funnelError } = await admin.from("rd_funnels").select("id,user_id,ad_account_id,name").eq("is_active", true).not("rd_funnel_id", "is", null);
    if (funnelError) throw funnelError;
    const results: any[] = [];
    for (const funnel of funnels || []) {
      try {
        const deals = await readAll("rd_deals", "rd_deal_id,win,rd_stage_name", funnel.id);
        const wonIds = new Set<string>();
        let duplicateCount = 0;
        for (const deal of deals) {
          const id = String(deal.rd_deal_id || "").trim();
          if (!id || !isWon(deal.rd_stage_name, deal.win)) continue;
          if (wonIds.has(id)) duplicateCount += 1;
          wonIds.add(id);
        }
        const sales = await readAll("sales", "rd_deal_id,status,gross_revenue,net_revenue", funnel.id);
        const linkedIds = new Set<string>(sales.filter((sale) => sale.status === "confirmed" && sale.rd_deal_id).map((sale) => String(sale.rd_deal_id).trim()));
        const missing = [...wonIds].filter((id) => !linkedIds.has(id));
        const financialGapIds = sales
          .filter((sale) => sale.status === "confirmed" && sale.rd_deal_id && Number(sale.gross_revenue || 0) <= 0 && Number(sale.net_revenue || 0) <= 0)
          .map((sale) => String(sale.rd_deal_id).trim())
          .filter((id) => wonIds.has(id));
        const reprocess = await reprocessMissingDeals(funnel, missing);
        const hasDivergence = missing.length > 0 || duplicateCount > 0 || financialGapIds.length > 0;
        const row = {
          funnel_id: funnel.id,
          user_id: funnel.user_id,
          account_id: funnel.ad_account_id,
          status: reprocess.ok && !hasDivergence ? "success" : "partial",
          rd_won_count: wonIds.size,
          linked_sale_count: [...wonIds].filter((id) => linkedIds.has(id)).length,
          missing_sale_count: missing.length,
          duplicate_rd_count: duplicateCount,
          missing_sale_rd_ids: missing.slice(0, 100),
          details: {
            funnel_name: funnel.name,
            canonical_source: "rd_deals",
            checked_at: new Date().toISOString(),
            financial_gap_is_not_fabricated: true,
            financial_gap_count: financialGapIds.length,
            financial_gap_rd_ids: financialGapIds.slice(0, 100),
            reprocess,
          },
        };
        const { error } = await admin.from("rd_metric_reconciliation_audits").insert(row);
        if (error) throw error;
        results.push(row);
      } catch (error) {
        const row = { funnel_id: funnel.id, user_id: funnel.user_id, account_id: funnel.ad_account_id, status: "failed", details: { funnel_name: funnel.name, error: error instanceof Error ? error.message : String(error) } };
        await admin.from("rd_metric_reconciliation_audits").insert(row);
        results.push(row);
      }
    }
    const failed = results.filter((row) => row.status === "failed").length;
    const divergent = results.filter((row) => row.status === "partial").length;
    const unhealthy = failed + divergent;
    return new Response(JSON.stringify({ ok: unhealthy === 0, status: unhealthy ? "partial" : "success", requested: results.length, failed, divergent, results }), { status: unhealthy ? 207 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
