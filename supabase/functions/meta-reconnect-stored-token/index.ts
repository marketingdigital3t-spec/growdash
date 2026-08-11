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

type MetaAccount = {
  id?: string;
  account_id?: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
  timezone_offset_hours_utc?: number;
  error?: { code?: number; message?: string; error_user_msg?: string };
};

function safeMetaMessage(code: number | null) {
  if (code === 190) return "O último token expirou ou foi revogado pela Meta. Conecte novamente pelo Facebook.";
  if (code === 10 || code === 100 || code === 200) return "O último token não tem mais permissão para esta conta de anúncio. Conecte novamente pelo Facebook.";
  return "A Meta não confirmou o acesso com o último token. Tente conectar novamente pelo Facebook.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Sessão inválida ou expirada" }, 401);

    const body = await req.json().catch(() => ({}));
    const accountId = typeof body?.account_id === "string" ? body.account_id.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(accountId)) return json({ error: "Conta inválida." }, 400);

    const admin = createClient(url, service);
    const { data: account, error: accountError } = await admin
      .from("ad_accounts")
      .select("id, account_id, name, access_token")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return json({ error: "Conta não encontrada ou sem acesso." }, 404);
    if (!account.access_token) return json({ error: "Não há um token anterior salvo para esta conta." }, 409);

    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") ?? "v25.0";
    const fields = "id,account_id,name,currency,timezone_name,timezone_offset_hours_utc";
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${account.account_id}?fields=${encodeURIComponent(fields)}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${account.access_token}` },
    });
    const meta = await response.json().catch(() => ({})) as MetaAccount;
    const now = new Date().toISOString();
    const code = Number.isFinite(Number(meta.error?.code)) ? Number(meta.error?.code) : null;

    if (!response.ok || meta.error) {
      await admin.from("ad_accounts").update({
        connection_status: code === 190 ? "expired" : "error",
        last_sync_error: safeMetaMessage(code),
        last_sync_error_code: code,
        last_sync_attempt_at: now,
        updated_at: now,
      }).eq("id", account.id).eq("user_id", user.id);
      return json({ ok: false, account: { id: account.id, name: account.name }, code, error: safeMetaMessage(code) }, 409);
    }

    const returnedAccountId = `act_${String(meta.account_id ?? meta.id ?? "").replace(/^act_/i, "")}`;
    if (returnedAccountId !== account.account_id) return json({ error: "A Meta retornou uma conta diferente da conta salva." }, 409);

    const { error: updateError } = await admin.from("ad_accounts").update({
      name: meta.name ? String(meta.name).slice(0, 255) : account.name,
      currency: meta.currency ? String(meta.currency).slice(0, 16) : null,
      timezone_name: meta.timezone_name ? String(meta.timezone_name).slice(0, 100) : null,
      timezone_offset_hours_utc: Number.isFinite(Number(meta.timezone_offset_hours_utc)) ? Number(meta.timezone_offset_hours_utc) : null,
      connection_status: "connected",
      last_sync_error: null,
      last_sync_error_code: null,
      last_sync_attempt_at: now,
      last_sync_success_at: now,
      updated_at: now,
    }).eq("id", account.id).eq("user_id", user.id);
    if (updateError) throw updateError;

    return json({ ok: true, account: { id: account.id, name: meta.name ?? account.name } });
  } catch (error) {
    console.error("meta-reconnect-stored-token", error);
    return json({ error: "Não foi possível validar o último token da Meta." }, 500);
  }
});
