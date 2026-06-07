// admin-create-user v2 — email+password fluxo (não requer mais username)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_SUFFIX = "@users.local";
const PLATFORM_OWNER_EMAIL = "marketingdigital3t@gmail.com";

const OPTIONAL_PERMISSION_COLUMNS = [
  "can_crm",
  "can_commercial",
  "can_leads",
  "can_alerts",
  "can_users",
  "can_integrations",
  "can_announcements",
  "can_automations",
] as const;

async function upsertDefaultRole(admin: ReturnType<typeof createClient>, userId: string) {
  const primary = await admin.from("user_roles").upsert({
    user_id: userId,
    role: "user",
  }, { onConflict: "user_id,role" });

  if (!primary.error) return null;

  if (!/invalid input value for enum|schema cache/i.test(primary.error.message)) {
    return primary.error;
  }

  const fallback = await admin.from("user_roles").upsert({
    user_id: userId,
    role: "usuario",
  }, { onConflict: "user_id,role" });

  return fallback.error ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Parse body early so we can allow the unauthenticated `ensure_owner` bootstrap.
    const body = await req.json().catch(() => ({}));
    const isOwnerBootstrap = body?.action === "ensure_owner";

    const authHeader = req.headers.get("Authorization");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (!isOwnerBootstrap) {
      if (!authHeader) return json({ error: "Unauthorized" }, 401);

      // verify caller
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData.user) return json({ error: "Unauthorized" }, 401);
      const isPlatformOwner = String(userData.user.email || "").trim().toLowerCase() === PLATFORM_OWNER_EMAIL;

      const { data: adminRoles, error: roleError } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .in("role", ["master", "admin"])
        .limit(1);
      if (!isPlatformOwner && (roleError || !adminRoles?.length)) return json({ error: "Forbidden" }, 403);
    }


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
      can_crm,
      can_commercial,
      can_leads,
      can_alerts,
      can_users,
      can_integrations,
      can_announcements,
      can_automations,
      ad_account_ids,
      rd_funnel_ids,
    } = body ?? {};

    console.log("[admin-create-user] action:", action, "email:", email, "ads:", Array.isArray(ad_account_ids) ? ad_account_ids.length : 0, "funnels:", Array.isArray(rd_funnel_ids) ? rd_funnel_ids.length : 0);



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
      const inputEmail = String(email || "").trim().toLowerCase();
      if (!inputEmail || !password) return json({ error: "email e password obrigatórios" }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail)) return json({ error: "e-mail inválido" }, 400);
      const baseUsername = inputEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 48) || "user";

      // Ensure unique username
      let derivedUsername = baseUsername;
      for (let i = 0; i < 50; i++) {
        const { data: existing } = await admin
          .from("user_permissions")
          .select("user_id")
          .eq("username", derivedUsername)
          .maybeSingle();
        if (!existing) break;
        derivedUsername = `${baseUsername}${Math.floor(Math.random() * 9000 + 1000)}`;
      }

      console.log("[admin-create-user] criando auth user:", inputEmail);
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: inputEmail,
        password,
        email_confirm: true,
        user_metadata: { username: derivedUsername, email: inputEmail },
      });
      if (cErr) {
        console.error("[admin-create-user] auth.createUser error:", cErr);
        const msg = /already registered|already exists|duplicate/i.test(cErr.message)
          ? "Este e-mail já está cadastrado."
          : `Falha ao criar usuário: ${cErr.message}`;
        return json({ error: msg }, 400);
      }
      const newId = created.user!.id;
      console.log("[admin-create-user] auth user criado:", newId);

      const { error: profileErr } = await admin.from("profiles").upsert({
        user_id: newId,
        email: inputEmail,
        full_name: "",
      }, { onConflict: "user_id" });

      if (profileErr) {
        console.error("[admin-create-user] profile upsert error:", profileErr);
        await admin.auth.admin.deleteUser(newId);
        return json({ error: `Falha ao salvar perfil: ${profileErr.message}` }, 400);
      }

      // Role insert is non-fatal: the handle_new_user trigger usually inserts it already.
      const roleErr = await upsertDefaultRole(admin, newId);
      if (roleErr) {
        console.warn("[admin-create-user] role upsert warning (não fatal):", roleErr.message);
      }

      let permissionsPayload: Record<string, unknown> = {
        user_id: newId,
        username: derivedUsername,
        can_dashboard: !!can_dashboard,
        can_campaigns: !!can_campaigns,
        can_funnels: !!can_funnels,
        can_classes: !!can_classes,
        can_crm: !!can_crm,
        can_commercial: !!can_commercial,
        can_leads: !!can_leads,
        can_alerts: !!can_alerts,
        can_users: !!can_users,
        can_integrations: !!can_integrations,
        can_announcements: !!can_announcements,
        can_automations: !!can_automations,
      };

      let { error: pErr } = await admin.from("user_permissions").upsert(permissionsPayload, { onConflict: "user_id" });

      if (pErr && /column .* does not exist|schema cache/i.test(pErr.message)) {
        for (const column of OPTIONAL_PERMISSION_COLUMNS) delete permissionsPayload[column];
        const retry = await admin.from("user_permissions").upsert(permissionsPayload, { onConflict: "user_id" });
        pErr = retry.error;
      }

      if (pErr) {
        console.error("[admin-create-user] user_permissions error:", pErr);
        await admin.auth.admin.deleteUser(newId);
        return json({ error: `Falha ao salvar permissões: ${pErr.message}` }, 400);
      }

      if (Array.isArray(ad_account_ids) && ad_account_ids.length) {
        const validIds = ad_account_ids.filter((id) => typeof id === "string" && id.length > 0);
        if (validIds.length) {
          const { error: adErr } = await admin.from("user_ad_account_access").insert(
            validIds.map((id: string) => ({ user_id: newId, ad_account_id: id }))
          );
          if (adErr) console.warn("[admin-create-user] ad_account_access warning:", adErr.message);
        }
      }
      if (Array.isArray(rd_funnel_ids) && rd_funnel_ids.length) {
        const validIds = rd_funnel_ids.filter((id) => typeof id === "string" && id.length > 0);
        if (validIds.length) {
          const { error: rdErr } = await admin.from("user_rd_funnel_access").insert(
            validIds.map((id: string) => ({ user_id: newId, rd_funnel_id: id }))
          );
          if (rdErr) console.warn("[admin-create-user] rd_funnel_access warning:", rdErr.message);
        }
      }
      console.log("[admin-create-user] usuário criado com sucesso:", newId);
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
      if (typeof can_crm === "boolean") updates.can_crm = can_crm;
      if (typeof can_commercial === "boolean") updates.can_commercial = can_commercial;
      if (typeof can_leads === "boolean") updates.can_leads = can_leads;
      if (typeof can_alerts === "boolean") updates.can_alerts = can_alerts;
      if (typeof can_users === "boolean") updates.can_users = can_users;
      if (typeof can_integrations === "boolean") updates.can_integrations = can_integrations;
      if (typeof can_announcements === "boolean") updates.can_announcements = can_announcements;
      if (typeof can_automations === "boolean") updates.can_automations = can_automations;

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
      const [{ data: accs }, { data: funs }, authList] = await Promise.all([
        admin.from("user_ad_account_access").select("user_id, ad_account_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        admin.from("user_rd_funnel_access").select("user_id, rd_funnel_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);

      const emailMap = new Map<string, string>(
        (authList.data?.users ?? []).map((u) => [u.id, String(u.email || "")]),
      );

      const result = (perms ?? []).map((p) => ({
        ...p,
        email: emailMap.get(p.user_id) || "",
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
