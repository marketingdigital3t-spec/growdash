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

const normalize = (value: unknown) => String(value ?? "").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) return json({ error: "Sessão inválida ou expirada" }, 401);

    const body = await req.json().catch(() => ({}));
    const provider = normalize(body?.provider).toLowerCase();
    const accountId = normalize(body?.account_id);
    const confirmation = normalize(body?.confirmation);
    const { data: isMaster } = await admin.rpc("is_master", { _user_id: user.id });

    if (provider === "meta") {
      if (!accountId) return json({ error: "Conta Meta não informada" }, 400);
      const { data: account, error: accountError } = await admin
        .from("ad_accounts")
        .select("id, user_id, name, account_id")
        .eq("id", accountId)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account) return json({ error: "A conta Meta já foi removida ou não existe" }, 404);
      if (account.user_id !== user.id && !isMaster) return json({ error: "Você não pode remover esta conta" }, 403);
      if (confirmation !== account.name) {
        return json({ error: `Digite exatamente o nome da conta: ${account.name}` }, 400);
      }

      const { error: deleteError } = await admin.from("ad_accounts").delete().eq("id", account.id);
      if (deleteError) throw deleteError;
      return json({
        ok: true,
        provider: "meta",
        message: "A conexão e os dados sincronizados desta conta foram removidos da Growdash. A conta de anúncios continua existindo na Meta.",
      });
    }

    if (provider === "rd_station_crm") {
      const { data: integration, error: integrationError } = await admin
        .from("integrations")
        .select("id, user_id, provider")
        .eq("provider", "rd_station_crm")
        .eq("user_id", accountId || user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (integrationError) throw integrationError;
      if (!integration) return json({ error: "A integração RD já foi removida ou não existe" }, 404);
      if (integration.user_id !== user.id && !isMaster) return json({ error: "Você não pode remover esta integração" }, 403);
      if (confirmation !== "EXCLUIR RD") {
        return json({ error: "Digite EXCLUIR RD para confirmar" }, 400);
      }

      const { error: deleteError } = await admin.from("integrations").delete().eq("id", integration.id);
      if (deleteError) throw deleteError;
      return json({
        ok: true,
        provider: "rd_station_crm",
        message: "A credencial do RD Station foi eliminada. Negócios já sincronizados foram preservados para auditoria.",
      });
    }

    return json({ error: "Provedor de integração inválido" }, 400);
  } catch (error) {
    console.error("delete-integration-account", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    const friendly = /foreign key|violates/i.test(message)
      ? "Existem registros vinculados que impedem a exclusão. Atualize o banco e tente novamente."
      : message;
    return json({ error: friendly }, 500);
  }
});
