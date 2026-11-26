import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { fetchWithTimeout } from "../../../src/lib/syncReliabilityPolicy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ADMIN_ROLES = ["admin", "master"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: user } = await caller.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const { data: profile } = await caller.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      return json({ error: "Acesso negado: usuário não é admin/master" }, 403);
    }

    const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/daily-reconciliation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({ trigger_source: "manual" }),
    }, 15_000);

    if (!response.ok) return json({ error: "Erro ao executar reconciliação", status: response.status }, 500);

    return json({ ok: true, message: "Reconciliação iniciada com sucesso" });
  } catch (err) {
    console.error("trigger-rd-sync:", err);
    return json({ error: "Erro interno", message: err instanceof Error ? err.message : String(err) }, 500);
  }
});