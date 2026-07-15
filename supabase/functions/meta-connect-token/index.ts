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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Sessão inválida ou expirada" }, 401);

    const body = await req.json().catch(() => ({}));
    const rawAccountId = typeof body?.account_id === "string" ? body.account_id.trim() : "";
    const rawToken = typeof body?.access_token === "string" ? body.access_token.trim() : "";
    const numericAccountId = rawAccountId.replace(/^act_/i, "").replace(/\s+/g, "");

    if (!/^\d{5,30}$/.test(numericAccountId)) {
      return json({ error: "ID da conta inválido. Use somente o número ou o formato act_123456789." }, 400);
    }
    if (rawToken.length < 20 || rawToken.length > 4096) {
      return json({ error: "Token da Meta inválido." }, 400);
    }

    const accountId = `act_${numericAccountId}`;
    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") ?? "v25.0";
    const fields = "id,account_id,name,currency,timezone_name,timezone_offset_hours_utc";
    const metaResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${accountId}?fields=${encodeURIComponent(fields)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${rawToken}`,
        },
      },
    );
    const meta = await metaResponse.json().catch(() => ({})) as MetaAccount;

    if (!metaResponse.ok || meta.error) {
      const code = Number(meta.error?.code ?? metaResponse.status);
      console.error("Meta manual connection rejected", { accountId, code });
      const userMessage = code === 190
        ? "O token é inválido ou expirou. Gere um novo token com acesso à conta."
        : code === 100 || code === 200
          ? "O token não possui acesso a esta conta de anúncio ou faltam permissões ads_read/ads_management."
          : "A Meta não autorizou o acesso a esta conta de anúncio.";
      return json({ error: userMessage, code }, 400);
    }

    const returnedNumericId = String(meta.account_id ?? meta.id ?? "").replace(/^act_/i, "");
    if (returnedNumericId !== numericAccountId) {
      return json({ error: "A Meta devolveu uma conta diferente do ID informado." }, 400);
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: existing, error: existingError } = await admin
      .from("ad_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("account_id", accountId)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    const now = new Date().toISOString();
    const values = {
      user_id: user.id,
      account_id: accountId,
      provider_account_id: numericAccountId,
      name: String(meta.name || accountId).slice(0, 255),
      access_token: rawToken,
      currency: meta.currency ? String(meta.currency).slice(0, 16) : null,
      timezone_name: meta.timezone_name ? String(meta.timezone_name).slice(0, 100) : null,
      timezone_offset_hours_utc: Number.isFinite(Number(meta.timezone_offset_hours_utc))
        ? Number(meta.timezone_offset_hours_utc)
        : null,
      connection_status: "connected",
      last_sync_error: null,
      last_sync_error_code: null,
      last_sync_attempt_at: now,
      last_sync_success_at: now,
      updated_at: now,
      metadata: { connection_method: "manual_token", validated_at: now },
    };

    const operation = existing?.id
      ? admin.from("ad_accounts").update(values).eq("id", existing.id)
      : admin.from("ad_accounts").insert(values);
    const { error: saveError } = await operation;
    if (saveError) throw saveError;

    return json({
      ok: true,
      account: {
        id: accountId,
        name: values.name,
        currency: values.currency,
        timezone_name: values.timezone_name,
      },
      updated: !!existing?.id,
    });
  } catch (error) {
    console.error("meta-connect-token", error);
    return json({ error: "Não foi possível concluir a conexão manual com a Meta." }, 500);
  }
});
