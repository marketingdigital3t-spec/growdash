import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: integration } = await admin
      .from("integrations")
      .select("api_token")
      .eq("user_id", userId)
      .eq("provider", "rd_station_crm")
      .eq("is_active", true)
      .maybeSingle();

    if (!integration?.api_token) {
      return new Response(JSON.stringify({
        error: "RD Station CRM não conectado. Configure o token nas Configurações.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = await fetch(
      `https://crm.rdstation.com/api/v1/deal_pipelines/?token=${encodeURIComponent(integration.api_token)}&limit=200`,
    );
    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: `RD API ${r.status}: ${txt.slice(0, 200)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    // deno-lint-ignore no-explicit-any
    const pipelines = (data.deal_pipelines || data || []).map((p: any) => ({
      id: String(p._id || p.id), name: p.name,
    }));

    return new Response(JSON.stringify({ pipelines }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
