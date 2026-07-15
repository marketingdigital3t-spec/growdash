import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type EntityType = "campaign" | "adset" | "ad";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Sessão inválida ou expirada" }, 401);

    const body = await req.json().catch(() => null);
    const entityType = body?.entityType as EntityType;
    const entityId = String(body?.entityId ?? "").trim();
    const changes = body?.changes ?? {};

    if (!(["campaign", "adset", "ad"] as string[]).includes(entityType) || !/^[0-9]{5,30}$/.test(entityId)) {
      return json({ error: "Entidade inválida" }, 400);
    }

    const name = String(changes.name ?? "").trim();
    const status = String(changes.status ?? "").toUpperCase();
    if (name.length < 1 || name.length > 255) return json({ error: "Nome inválido" }, 400);
    if (!["ACTIVE", "PAUSED"].includes(status)) return json({ error: "Status inválido" }, 400);

    let source: Record<string, unknown>;
    let campaignId: string;
    if (entityType === "campaign") {
      const { data, error } = await admin.from("campaigns").select("id, name, status, ad_account_id").eq("id", entityId).maybeSingle();
      if (error || !data) return json({ error: "Campanha não encontrada" }, 404);
      source = data;
      campaignId = data.id;
    } else if (entityType === "adset") {
      const { data, error } = await admin.from("adsets").select("id, name, status, daily_budget, campaign_id").eq("id", entityId).maybeSingle();
      if (error || !data) return json({ error: "Conjunto não encontrado" }, 404);
      source = data;
      campaignId = data.campaign_id;
    } else {
      const { data, error } = await admin.from("ads").select("id, name, status, adset_id").eq("id", entityId).maybeSingle();
      if (error || !data) return json({ error: "Anúncio não encontrado" }, 404);
      source = data;
      const { data: adset } = await admin.from("adsets").select("campaign_id").eq("id", data.adset_id).maybeSingle();
      if (!adset) return json({ error: "Campanha do anúncio não encontrada" }, 404);
      campaignId = adset.campaign_id;
    }

    const { data: campaign } = await admin.from("campaigns").select("ad_account_id").eq("id", campaignId).maybeSingle();
    if (!campaign) return json({ error: "Conta da campanha não encontrada" }, 404);

    const { data: account } = await admin
      .from("ad_accounts")
      .select("id, user_id, access_token, connection_status")
      .eq("id", campaign.ad_account_id)
      .maybeSingle();
    if (!account?.access_token) return json({ error: "Conta Meta sem token válido" }, 409);

    const [{ data: privileged }, { data: delegated }, { data: permissions }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "master"]).maybeSingle(),
      admin.from("user_ad_account_access").select("ad_account_id").eq("user_id", user.id).eq("ad_account_id", account.id).maybeSingle(),
      admin.from("user_permissions").select("can_campaigns").eq("user_id", user.id).maybeSingle(),
    ]);
    const ownsAccount = account.user_id === user.id;
    const hasDelegatedWrite = !!delegated && permissions?.can_campaigns === true;
    if (!ownsAccount && !privileged && !hasDelegatedWrite) {
      return json({ error: "Sem permissão para editar esta conta" }, 403);
    }

    const metaPayload = new URLSearchParams({
      access_token: account.access_token,
      name,
      status,
    });
    let normalizedBudget: number | null = null;
    if (entityType === "adset") {
      const budget = Number(changes.dailyBudget);
      if (!Number.isFinite(budget) || budget <= 0 || budget > 100_000_000) {
        return json({ error: "Orçamento diário inválido" }, 400);
      }
      normalizedBudget = Math.round(budget * 100) / 100;
      metaPayload.set("daily_budget", String(Math.round(normalizedBudget * 100)));
    }

    const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") ?? "v25.0";
    const metaResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${entityId}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: metaPayload,
    });
    const metaResult = await metaResponse.json().catch(() => ({}));
    if (!metaResponse.ok || metaResult?.error) {
      const message = metaResult?.error?.message ?? "A Meta recusou a alteração";
      const code = metaResult?.error?.code ?? metaResponse.status;
      return json({ error: `${message} (código ${code})` }, 422);
    }

    const table = entityType === "campaign" ? "campaigns" : entityType === "adset" ? "adsets" : "ads";
    const localUpdate: Record<string, unknown> = { name, status, updated_at: new Date().toISOString() };
    if (entityType === "adset") localUpdate.daily_budget = normalizedBudget;
    const { error: updateError } = await admin.from(table).update(localUpdate).eq("id", entityId);
    if (updateError) console.error("Meta updated, local update failed", updateError);

    const auditRows = [
      { field: "name", oldValue: source.name, newValue: name },
      { field: "status", oldValue: source.status, newValue: status },
      ...(entityType === "adset" ? [{ field: "daily_budget", oldValue: source.daily_budget, newValue: normalizedBudget }] : []),
    ].filter((row) => String(row.oldValue ?? "") !== String(row.newValue ?? ""));

    if (auditRows.length > 0) {
      await admin.from("campaign_changes").insert(auditRows.map((row) => ({
        campaign_id: campaignId,
        entity_type: entityType,
        entity_id: entityId,
        change_type: "manual_update",
        field: row.field,
        old_value: row.oldValue == null ? null : String(row.oldValue),
        new_value: row.newValue == null ? null : String(row.newValue),
        created_by: user.id,
        note: "Alteração enviada pela Growdash",
      })));
    }

    return json({ success: true, entityType, entityId, updated: localUpdate });
  } catch (error) {
    console.error("meta-manage-entity", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
