import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const providers = new Set(["hotmart", "kiwify", "cakto", "herospark", "themembers", "generic"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Não autenticado" }, 401);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return json({ error: "Usuário inválido" }, 401);
    const body = await req.json().catch(() => ({}));
    const provider = String(body.provider ?? "").toLowerCase();
    if (!providers.has(provider)) return json({ error: "Plataforma inválida" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const key = `sales_webhook_${provider}`;
    const { data: current } = await admin.from("integrations").select("id,provider,provider_account_id,is_active,updated_at").eq("user_id", auth.user.id).eq("provider", key).order("updated_at", { ascending: false }).maybeSingle();
    if (body.action === "list") return json({ connection: current ? publicConnection(current) : null });
    if (body.action === "disable" && current) {
      await admin.from("integrations").update({ is_active: false }).eq("id", current.id);
      return json({ ok: true });
    }
    const publicId = current?.provider_account_id || crypto.randomUUID();
    const secret = crypto.randomUUID().replaceAll("-", "");
    const values = { provider_account_id: publicId, webhook_secret: secret, is_active: true, updated_at: new Date().toISOString() };
    const operation = current ? admin.from("integrations").update(values).eq("id", current.id) : admin.from("integrations").insert({ user_id: auth.user.id, provider: key, ...values });
    const { error } = await operation;
    if (error) throw error;
    return json({ connection: { provider, endpoint: `${Deno.env.get("SUPABASE_URL")}/functions/v1/sales-webhook/${publicId}`, secret, header: "x-growdash-webhook-secret" } });
  } catch (error) { console.error("sales-webhook-config", error); return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500); }
});

function publicConnection(row: any) { return { provider: String(row.provider).replace("sales_webhook_", ""), endpoint: `${Deno.env.get("SUPABASE_URL")}/functions/v1/sales-webhook/${row.provider_account_id}`, active: !!row.is_active, updated_at: row.updated_at, header: "x-growdash-webhook-secret" }; }
