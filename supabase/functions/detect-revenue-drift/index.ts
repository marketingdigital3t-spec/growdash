import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") || "";
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cross sales with rd_deals: amount_total != gross_revenue
    const { data: sales } = await supabase
      .from("sales")
      .select("id, rd_deal_id, gross_revenue, sale_date, contact_name")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .not("rd_deal_id", "is", null);

    const ids = (sales || []).map((s: any) => s.rd_deal_id);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ drift: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const CHUNK = 200;
    const dealMap = new Map<string, number>();
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data: deals } = await supabase
        .from("rd_deals")
        .select("rd_deal_id, amount_total")
        .in("rd_deal_id", slice);
      for (const d of (deals || []) as any[]) dealMap.set(d.rd_deal_id, Number(d.amount_total || 0));
    }

    const drift: any[] = [];
    for (const s of sales || []) {
      const rdAmount = dealMap.get(s.rd_deal_id as string);
      if (rdAmount === undefined) continue;
      const saleAmount = Number(s.gross_revenue || 0);
      const diff = Math.abs(rdAmount - saleAmount);
      if (diff > 1) {
        drift.push({
          sale_id: s.id,
          rd_deal_id: s.rd_deal_id,
          contact_name: s.contact_name,
          sale_date: s.sale_date,
          sale_amount: saleAmount,
          rd_amount: rdAmount,
          diff,
        });
      }
    }

    drift.sort((a, b) => b.diff - a.diff);

    return new Response(JSON.stringify({ drift: drift.slice(0, 100), total: drift.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("detect-revenue-drift error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
