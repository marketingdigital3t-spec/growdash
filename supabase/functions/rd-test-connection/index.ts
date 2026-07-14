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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return json({ error: "Usuário inválido" }, 401);

    const body = await req.json().catch(() => ({}));
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await admin
      .from("integrations")
      .select("id, api_token, is_active")
      .eq("user_id", userId)
      .eq("provider", "rd_station_crm")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (body?.disconnect === true) {
      if (existing?.id) {
        const { error } = await admin
          .from("integrations")
          .update({ api_token: null, is_active: false, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      }
      return json({ ok: true, connected: false });
    }

    const suppliedToken = typeof body?.api_token === "string" ? body.api_token.trim() : "";
    const token = suppliedToken || (existing?.is_active ? String(existing.api_token ?? "") : "");
    if (!token) return json({ error: "RD Station CRM não conectado. Informe um token válido." }, 400);

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(
        `https://crm.rdstation.com/api/v1/deal_pipelines/?token=${encodeURIComponent(token)}&limit=1`,
        { headers: { Accept: "application/json" } },
      );
      if (response.status !== 429) break;
      await response.text();
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }

    const rateLimited = response?.status === 429;
    if (!response || (!response.ok && !rateLimited)) {
      const status = response?.status ?? 502;
      if (!suppliedToken && existing?.id && (status === 401 || status === 403)) {
        await admin.from("integrations").update({ is_active: false }).eq("id", existing.id);
      }
      return json({
        error: `Token inválido ou sem permissão no RD Station (HTTP ${status}).`,
        connected: false,
      }, 400);
    }

    if (suppliedToken) {
      const values = {
        api_token: suppliedToken,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      const operation = existing?.id
        ? admin.from("integrations").update(values).eq("id", existing.id)
        : admin.from("integrations").insert({
            user_id: userId,
            provider: "rd_station_crm",
            ...values,
          });
      const { error } = await operation;
      if (error) throw error;
    }

    return json({
      ok: true,
      connected: true,
      warning: rateLimited
        ? "Token aceito e salvo, mas o RD Station limitou temporariamente as requisições. Tente sincronizar novamente em alguns minutos."
        : undefined,
    });
  } catch (error) {
    console.error("rd-test-connection", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
