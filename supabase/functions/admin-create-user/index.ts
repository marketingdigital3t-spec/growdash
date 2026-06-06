import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_SUFFIX = "@users.local";
const PLATFORM_OWNER_EMAIL = "marketingdigital3t@gmail.com";

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
    const isPlatformOwner = String(userData.user.email || "").trim().toLowerCase() === PLATFORM_OWNER_EMAIL;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: adminRoles, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["master", "admin"])
      .limit(1);
    if (!isPlatformOwner && (roleError || !adminRoles?.length)) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const {
      action,
      target_user_id,
      username,
      email,
      password,
      can_dashboard,
      can_campaigns,
      can_funnels,
      can_classes,
      ad_account_ids,
      rd_funnel_ids,
    } = body ?? {};

    if (action === "ensure_owner") {
      if (!password) return json({ error: "password obrigatório" }, 400);
      const ownerEmail = String(email || PLATFORM_OWNER_EMAIL).trim().toLowerCase();
      if (ownerEmail !== PLATFORM_OWNER_EMAIL) return json({ error: "email de dono inválido" }, 400);

      const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) return json({ error: listErr.message }, 400);
      const existing = listed.users.find((u) => String(u.email || "").toLowerCase() === ownerEmail);

      let ownerId = existing?.id;
      if (ownerId) {
        const { error } = await admin.auth.admin.updateUserById(ownerId, {
          password,
          email_confirm: true,
          user_metadata: { full_name: "Marketing Digital 3T", username: "marketingdigital3t", role: "owner" },
        });
        if (error) return json({ error: error.message }, 400);
      } else {
        const { data: created, error } = await admin.auth.admin.createUser({
          email: ownerEmail,
          password,
          email_confirm: true,
          user_metadata: { full_name: "Marketing Digital 3T", username: "marketingdigital3t", role: "owner" },
        });
        if (error) return json({ error: error.message }, 400);
        ownerId = created.user!.id;
      }

      await admin.from("profiles").upsert({
        user_id: ownerId,
        email: ownerEmail,
        full_name: "Marketing Digital 3T",
      }, { onConflict: "user_id" });

      await admin.from("user_roles").upsert({
        user_id: ownerId,
        role: "master",
      }, { onConflict: "user_id,role" });

      await admin.from("user_permissions").upsert({
        user_id: ownerId,
        username: "marketingdigital3t",
        can_dashboard: true,
        can_campaigns: true,
        can_funnels: true,
        can_classes: true,
      }, { onConflict: "user_id" });

      return json({ ok: true, user_id: ownerId, email: ownerEmail });
    }

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
      await admin.from("user_ad_account_access").delete().eq("user_id", target_user_id);
      await admin.from("user_rd_funnel_access").delete().eq("user_id", target_user_id);
      await admin.from("user_permissions").delete().eq("user_id", target_user_id);
      await admin.from("user_roles").delete().eq("user_id", target_user_id);
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
