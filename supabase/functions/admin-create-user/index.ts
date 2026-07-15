import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_SUFFIX = "@users.local";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // verify caller
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isMaster } = await admin.rpc("is_master", { _user_id: userData.user.id });
    if (!isMaster) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const {
      action,
      target_user_id,
      username,
      password,
      can_dashboard,
      can_campaigns,
      can_funnels,
      can_classes,
      ad_account_ids,
      rd_funnel_ids,
    } = body ?? {};

    if (action === "create") {
      if (!username || !password) return json({ error: "username e password obrigatórios" }, 400);
      const email = `${String(username).toLowerCase().trim()}${EMAIL_SUFFIX}`;
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username },
      });
      if (cErr) return json({ error: cErr.message }, 400);
      const newId = created.user!.id;

      // Default role usuario already inserted by handle_new_user trigger
      const { error: pErr } = await admin.from("user_permissions").insert({
        user_id: newId,
        username: String(username).toLowerCase().trim(),
        can_dashboard: !!can_dashboard,
        can_campaigns: !!can_campaigns,
        can_funnels: !!can_funnels,
        can_classes: !!can_classes,
      });
      if (pErr) {
        await admin.auth.admin.deleteUser(newId);
        return json({ error: pErr.message }, 400);
      }

      if (Array.isArray(ad_account_ids) && ad_account_ids.length) {
        await admin.from("user_ad_account_access").insert(
          ad_account_ids.map((id: string) => ({ user_id: newId, ad_account_id: id }))
        );
      }
      if (Array.isArray(rd_funnel_ids) && rd_funnel_ids.length) {
        await admin.from("user_rd_funnel_access").insert(
          rd_funnel_ids.map((id: string) => ({ user_id: newId, rd_funnel_id: id }))
        );
      }
      return json({ ok: true, user_id: newId });
    }

    if (action === "update") {
      if (!target_user_id) return json({ error: "target_user_id obrigatório" }, 400);

      if (password) {
        const { error } = await admin.auth.admin.updateUserById(target_user_id, { password });
        if (error) return json({ error: error.message }, 400);
      }

      const updates: Record<string, unknown> = {};
      if (typeof can_dashboard === "boolean") updates.can_dashboard = can_dashboard;
      if (typeof can_campaigns === "boolean") updates.can_campaigns = can_campaigns;
      if (typeof can_funnels === "boolean") updates.can_funnels = can_funnels;
      if (typeof can_classes === "boolean") updates.can_classes = can_classes;
      if (Object.keys(updates).length) {
        await admin.from("user_permissions").update(updates).eq("user_id", target_user_id);
      }

      if (Array.isArray(ad_account_ids)) {
        await admin.from("user_ad_account_access").delete().eq("user_id", target_user_id);
        if (ad_account_ids.length) {
          await admin.from("user_ad_account_access").insert(
            ad_account_ids.map((id: string) => ({ user_id: target_user_id, ad_account_id: id }))
          );
        }
      }
      if (Array.isArray(rd_funnel_ids)) {
        await admin.from("user_rd_funnel_access").delete().eq("user_id", target_user_id);
        if (rd_funnel_ids.length) {
          await admin.from("user_rd_funnel_access").insert(
            rd_funnel_ids.map((id: string) => ({ user_id: target_user_id, rd_funnel_id: id }))
          );
        }
      }
      return json({ ok: true });
    }

    if (action === "delete") {
      if (!target_user_id) return json({ error: "target_user_id obrigatório" }, 400);
      if (target_user_id === userData.user.id) {
        return json({ error: "Você não pode excluir a própria conta enquanto está autenticado." }, 400);
      }

      const { data: targetResult, error: targetLookupError } = await admin.auth.admin.getUserById(target_user_id);
      if (targetLookupError || !targetResult.user) return json({ error: "Usuário não encontrado." }, 404);
      if (String(targetResult.user.email ?? "").toLowerCase() === "marketingdigital3t@gmail.com") {
        return json({ error: "A conta proprietária da plataforma não pode ser excluída." }, 403);
      }

      // Tables without an auth.users foreign key must be cleaned explicitly.
      // Child records come first so the operation remains deterministic even on
      // projects that have not received every historical cascade constraint.
      const cleanup: Array<[string, string]> = [
        ["rd_deal_touches", "user_id"],
        ["rd_funnel_stages", "user_id"],
        ["rd_deals", "user_id"],
        ["user_ad_account_access", "user_id"],
        ["user_rd_funnel_access", "user_id"],
        ["dashboard_view_state", "user_id"],
        ["dashboard_views", "user_id"],
        ["funnels", "user_id"],
        ["rd_funnels", "user_id"],
        ["integrations", "user_id"],
        ["realtime_sync_state", "user_id"],
        ["user_permissions", "user_id"],
        ["user_roles", "user_id"],
      ];
      for (const [table, column] of cleanup) {
        const { error: cleanupError } = await admin.from(table).delete().eq(column, target_user_id);
        // A missing optional table should not block user management on older
        // installations; every other database failure must be surfaced.
        if (cleanupError && cleanupError.code !== "42P01") {
          return json({ error: `Não foi possível limpar ${table}: ${cleanupError.message}` }, 409);
        }
      }

      const { error } = await admin.auth.admin.deleteUser(target_user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "list") {
      const { data: perms, error } = await admin
        .from("user_permissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);

      const ids = (perms ?? []).map((p) => p.user_id);
      const [{ data: accs }, { data: funs }] = await Promise.all([
        admin.from("user_ad_account_access").select("user_id, ad_account_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        admin.from("user_rd_funnel_access").select("user_id, rd_funnel_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      ]);

      const result = (perms ?? []).map((p) => ({
        ...p,
        ad_account_ids: (accs ?? []).filter((a) => a.user_id === p.user_id).map((a) => a.ad_account_id),
        rd_funnel_ids: (funs ?? []).filter((f) => f.user_id === p.user_id).map((f) => f.rd_funnel_id),
      }));
      return json({ users: result });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
