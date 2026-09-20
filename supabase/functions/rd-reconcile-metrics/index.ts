import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey);
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };

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
        const sales = await readAll("sales", "rd_deal_id,status", funnel.id);
        const linkedIds = new Set<string>(sales.filter((sale) => sale.status === "confirmed" && sale.rd_deal_id).map((sale) => String(sale.rd_deal_id).trim()));
        const missing = [...wonIds].filter((id) => !linkedIds.has(id));
        const row = {
          funnel_id: funnel.id,
          user_id: funnel.user_id,
          account_id: funnel.ad_account_id,
          status: "success",
          rd_won_count: wonIds.size,
          linked_sale_count: [...wonIds].filter((id) => linkedIds.has(id)).length,
          missing_sale_count: missing.length,
          duplicate_rd_count: duplicateCount,
          missing_sale_rd_ids: missing.slice(0, 100),
          details: { funnel_name: funnel.name, canonical_source: "rd_deals", checked_at: new Date().toISOString() },
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
    return new Response(JSON.stringify({ ok: failed === 0, status: failed ? "partial" : "success", requested: results.length, failed, results }), { status: failed ? 207 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
