import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { api_token } = await req.json();
    if (!api_token || typeof api_token !== "string") {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const token = api_token.trim();

    // Retry on 429 (rate limit) with exponential backoff
    let r: Response | null = null;
    let lastTxt = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await fetch(
        `https://crm.rdstation.com/api/v1/deal_pipelines/?token=${encodeURIComponent(token)}&limit=1`,
      );
      if (r.status !== 429) break;
      lastTxt = await r.text();
      // wait 1.5s, 3s
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
    }

    if (r && r.status === 429) {
      // Rate-limited — don't reject the token. Save it if it looks valid and let the user retry sync later.
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: existing } = await admin
        .from("integrations")
        .select("id")
        .eq("user_id", userId)
        .eq("provider", "rd_station_crm")
        .maybeSingle();
      if (existing) {
        await admin.from("integrations").update({
          api_token: token, is_active: true, updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await admin.from("integrations").insert({
          user_id: userId, provider: "rd_station_crm", api_token: token, is_active: true,
        });
      }
      return new Response(JSON.stringify({
        ok: true,
        warning: "Token salvo, mas a API do RD está com limite de requisições excedido no momento (HTTP 429). Aguarde alguns minutos e tente sincronizar novamente.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!r || !r.ok) {
      const txt = lastTxt || (r ? await r.text() : "");
      return new Response(JSON.stringify({
        error: `Token inválido ou sem permissão (HTTP ${r?.status ?? "?"}). ${txt.slice(0, 200)}`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: existing } = await admin
      .from("integrations")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "rd_station_crm")
      .maybeSingle();

    if (existing) {
      await admin.from("integrations").update({
        api_token: token, is_active: true, updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await admin.from("integrations").insert({
        user_id: userId, provider: "rd_station_crm", api_token: token, is_active: true,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
