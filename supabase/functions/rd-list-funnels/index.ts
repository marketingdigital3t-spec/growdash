import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { resolveRDConnection } from "../_shared/rdConnection.ts";

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
    const body = await req.json().catch(() => ({}));
    let connection;
    try {
      connection = await resolveRDConnection(admin, { connectionId: body?.rd_connection_id, userId });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error && error.message === "RD_CONNECTION_NOT_AUTHORIZED"
          ? "Conexão RD sem autorização válida. Reconecte esta conta."
          : "Nenhuma conexão RD autorizada para esta conta.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = await fetch(
      `https://crm.rdstation.com/api/v1/deal_pipelines/?token=${encodeURIComponent(connection.api_token!)}&limit=200`,
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
