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

    // Authenticated user
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull confirmed sales (last 365 days) for this user
    const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const { data: sales, error } = await supabase
      .from("sales")
      .select("id, rd_deal_id, contact_email, sale_date, gross_revenue, contact_name, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .gte("sale_date", since)
      .order("sale_date", { ascending: false });

    if (error) throw error;

    const all = sales || [];

    // Group 1: same email + same date + similar amount (>= 2 records)
    const groups = new Map<string, any[]>();
    for (const s of all) {
      if (!s.contact_email) continue;
      const key = `${s.contact_email.toLowerCase().trim()}|${s.sale_date}|${Math.round(Number(s.gross_revenue || 0))}`;
      const arr = groups.get(key) || [];
      arr.push(s);
      groups.set(key, arr);
    }
    const emailDuplicates: any[] = [];
    for (const [, arr] of groups) {
      if (arr.length > 1) emailDuplicates.push({ records: arr });
    }

    // Group 2: same rd_deal_id (should be 0 now thanks to UNIQUE constraint, but check legacy)
    const byDeal = new Map<string, any[]>();
    for (const s of all) {
      if (!s.rd_deal_id) continue;
      const arr = byDeal.get(s.rd_deal_id) || [];
      arr.push(s);
      byDeal.set(s.rd_deal_id, arr);
    }
    const dealDuplicates: any[] = [];
    for (const [, arr] of byDeal) {
      if (arr.length > 1) dealDuplicates.push({ records: arr });
    }

    return new Response(JSON.stringify({
      emailDuplicates,
      dealDuplicates,
      total: emailDuplicates.length + dealDuplicates.length,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("detect-duplicates error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
