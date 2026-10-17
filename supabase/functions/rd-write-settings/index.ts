import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado" }, 401);

  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return json({ error: "Usuário inválido" }, 401);

    const body = await req.json().catch(() => ({}));
    const connectionId = typeof body?.rd_connection_id === "string" ? body.rd_connection_id : "";
    if (!connectionId || typeof body?.write_enabled !== "boolean") {
      return json({ error: "rd_connection_id e write_enabled são obrigatórios" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: connection, error: lookupError } = await admin
      .from("rd_account_connections")
      .select("id,user_id,status,write_enabled")
      .eq("id", connectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!connection) return json({ error: "Conexão RD não encontrada ou não autorizada" }, 403);
    if (connection.status !== "connected" && body.write_enabled === true) {
      return json({ error: "Conecte e valide o RD antes de habilitar escritas" }, 409);
    }

    // The card represents the user's global RD write permission, while the
    // database stores the guard per connection. Normalize every connection so
    // a sync on another account cannot make the toggle appear to change after
    // a reload, and an explicit disable really disables all RD writes.
    const { error: updateError } = await admin
      .from("rd_account_connections")
      .update({ write_enabled: body.write_enabled, write_updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (updateError) throw updateError;
    return json({
      ok: true,
      connection: {
        id: connection.id,
        write_enabled: body.write_enabled,
        write_updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("rd-write-settings", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
