import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_OWNER_EMAIL = "marketingdigital3t@gmail.com";
type AccessRole = "admin" | "editor" | "viewer" | "financial" | "analyst";
const PERMISSION_KEYS = [
  "can_expert_dashboard",
  "can_dashboard",
  "can_campaigns",
  "can_funnels",
  "can_flow",
  "can_social_media",
  "can_classes",
  "can_crm",
  "can_commercial",
  "can_leads",
  "can_kanban",
  "can_tickets",
  "can_alerts",
  "can_automations",
  "can_finance",
  "can_storage",
  "can_brands",
  "can_products",
  "can_users",
  "can_integrations",
  "can_meta_connect",
  "can_announcements",
  "can_agents",
  "can_settings",
  "can_data_health",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sessão não encontrada." }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, serviceRole);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);
    const caller = authData.user;
    const body = await req.json().catch(() => ({}));

    const { data: isMaster } = await admin.rpc("is_master", { _user_id: caller.id });
    const workspaceId = await resolveWorkspace(admin, caller.id, body?.workspace_id, isMaster === true);
    if (!workspaceId) return json({ error: "Nenhum workspace ativo foi encontrado." }, 404);

    const { data: membership } = await admin
      .from("workspace_members")
      .select("role, status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", caller.id)
      .maybeSingle();
    const canManage = isMaster === true || (
      membership?.status === "active" && ["owner", "admin"].includes(membership.role)
    );
    if (!canManage) return json({ error: "Você não tem permissão para gerenciar usuários deste workspace." }, 403);

    const action = String(body?.action ?? "");
    if (action === "list") return listUsers(admin, workspaceId, caller.id);
    if (action === "create") return createUser(admin, workspaceId, body);
    if (action === "resend_invite") return resendInvite(admin, workspaceId, body);
    if (action === "cancel_invite") return cancelInvite(admin, workspaceId, body);
    if (action === "update") return updateUser(admin, workspaceId, caller.id, body);
    if (action === "delete") return deleteUser(admin, workspaceId, caller.id, body);
    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("admin-create-user", error);
    return json({ error: (error as Error).message || "Erro interno ao gerenciar usuário." }, 500);
  }
});

async function resolveWorkspace(admin: any, callerId: string, requested?: string, isMaster = false) {
  if (requested && /^[0-9a-f-]{36}$/i.test(requested)) {
    if (isMaster) {
      const { data } = await admin.from("workspaces").select("id").eq("id", requested).maybeSingle();
      if (data) return requested;
    }
    const { data } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", requested)
      .eq("user_id", callerId)
      .eq("status", "active")
      .maybeSingle();
    if (data) return requested;
  }
  const { data } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", callerId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  return data?.sort((a: any, b: any) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))[0]?.workspace_id ?? null;
}

function normalizeAccessRole(value: unknown): AccessRole {
  if (value === "admin") return "admin";
  if (value === "financial") return "financial";
  if (value === "analyst") return "analyst";
  if (value === "editor" || value === "analyst") return "editor";
  return "viewer";
}

function toWorkspaceRole(role: AccessRole) {
  // O banco usa apenas os papéis estruturais do workspace. O perfil escolhido
  // na tela fica salvo em access_role; editor/analista usam a estrutura de
  // analista e os demais perfis comuns usam member.
  if (role === "admin") return "admin";
  if (role === "editor" || role === "analyst") return "analyst";
  if (role === "financial") return "financial";
  return "member";
}

function fromWorkspaceRole(role: string): AccessRole {
  return role === "admin" ? "admin" : role === "analyst" ? "analyst" : role === "financial" ? "financial" : "viewer";
}

const ROLE_DEFAULTS: Record<AccessRole, Partial<Record<typeof PERMISSION_KEYS[number], boolean>>> = {
  admin: Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true])),
  editor: { can_dashboard: true, can_expert_dashboard: true, can_crm: true, can_commercial: true, can_campaigns: true, can_funnels: true, can_flow: true, can_social_media: true, can_classes: true, can_leads: true, can_kanban: true, can_tickets: true, can_alerts: true, can_automations: true, can_finance: true, can_storage: true, can_brands: true, can_products: true, can_integrations: true, can_announcements: true },
  viewer: { can_dashboard: true, can_expert_dashboard: true, can_commercial: true, can_campaigns: true, can_funnels: true, can_classes: true },
  financial: { can_dashboard: true, can_expert_dashboard: true, can_commercial: true, can_finance: true },
  analyst: { can_dashboard: true, can_expert_dashboard: true, can_crm: true, can_commercial: true, can_campaigns: true, can_funnels: true, can_flow: true, can_social_media: true, can_alerts: true, can_data_health: true },
};

function permissionRecord(body: Record<string, unknown>, role: AccessRole) {
  const defaults = ROLE_DEFAULTS[role];
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, role === "admin" || (key in body ? body[key] === true : defaults[key] === true)]));
}

function uuidList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))];
}

function sameIds(expected: string[], actual: string[]) {
  return expected.length === actual.length && expected.every((id) => actual.includes(id));
}

async function saveWorkspaceAccess(
  admin: any,
  workspaceId: string,
  userId: string,
  email: string,
  role: AccessRole,
  body: Record<string, unknown>,
) {
  const { error } = await admin.rpc("admin_save_workspace_user_access", {
    _workspace_id: workspaceId,
    _user_id: userId,
    _email: email,
    _role: toWorkspaceRole(role),
    _permissions: permissionRecord(body, role),
    _ad_account_ids: uuidList(body.ad_account_ids),
    _rd_funnel_ids: uuidList(body.rd_funnel_ids),
  });
  if (error) throw error;

  const { error: roleError } = await admin
    .from("workspace_user_permissions")
    .update({ access_role: role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (roleError) throw roleError;

  // Never report success before the server confirms every page, account and
  // funnel selected by the administrator. This protects the access screen
  // from silent partial writes caused by stale workspace/resource records.
  const expectedPermissions = permissionRecord(body, role);
  const { data: savedPermissions, error: permissionError } = await admin
    .from("workspace_user_permissions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (permissionError || !savedPermissions) throw permissionError ?? new Error("As permissões da página não foram gravadas.");
  const permissionsMatch = Object.entries(expectedPermissions).every(([key, value]) => savedPermissions[key] === value);
  if (!permissionsMatch) throw new Error("As permissões das abas não foram confirmadas. Nenhuma confirmação de acesso foi exibida.");

  const expectedAccounts = uuidList(body.ad_account_ids);
  const { data: savedAccounts, error: accountsError } = await admin
    .from("user_ad_account_access")
    .select("ad_account_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (accountsError) throw accountsError;
  if (!sameIds(expectedAccounts, (savedAccounts ?? []).map((row: any) => row.ad_account_id))) {
    throw new Error("Uma ou mais contas selecionadas não pertencem a este workspace e não tiveram o acesso confirmado.");
  }

  const expectedFunnels = uuidList(body.rd_funnel_ids);
  const { data: savedFunnels, error: funnelsError } = await admin
    .from("user_rd_funnel_access")
    .select("rd_funnel_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (funnelsError) throw funnelsError;
  if (!sameIds(expectedFunnels, (savedFunnels ?? []).map((row: any) => row.rd_funnel_id))) {
    throw new Error("Um ou mais funis selecionados não pertencem a este workspace e não tiveram o acesso confirmado.");
  }
}

async function findUserByEmail(admin: any, email: string) {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user: any) => String(user.email ?? "").toLowerCase() === email);
    if (match || data.users.length < 1000) return match ?? null;
  }
  throw new Error("Não foi possível concluir a busca do e-mail na base de autenticação.");
}

async function assertTargetMember(admin: any, workspaceId: string, targetId: string) {
  const { data, error } = await admin
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Este usuário não pertence ao workspace selecionado.");
  if (data.role === "owner") throw new Error("O proprietário do workspace não pode ser alterado ou excluído.");
  return data;
}

async function createUser(admin: any, workspaceId: string, body: Record<string, unknown>) {
  const email = String(body.email ?? "").toLowerCase().trim();
  const name = String(body.name ?? "").trim();
  const role = normalizeAccessRole(body.role);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Informe um e-mail válido." }, 400);

  let authUser = await findUserByEmail(admin, email);
  const identityAlreadyExisted = !!authUser;
  if (authUser) {
    const { data: existingMembership } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (existingMembership) return json({ error: "Este e-mail já possui acesso ao workspace." }, 409);
  }
  let invited = false;
  if (!authUser || (!authUser.email_confirmed_at && !authUser.confirmed_at)) {
    const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${Deno.env.get("APP_URL") || "https://growdash.com.br"}/reset-password`,
      data: { full_name: name || email.split("@")[0], managed_by_growdash: true },
    });
    if (inviteError || !invitedUser.user) return json({ error: inviteError?.message ?? "Não foi possível enviar o convite." }, 400);
    authUser = invitedUser.user;
    invited = true;
  } else if (name) {
    const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, { user_metadata: { ...authUser.user_metadata, full_name: name } });
    if (updateError) return json({ error: updateError.message }, 400);
  }
  if (!authUser) {
    return json({ error: "Não foi possível criar a identidade do usuário." }, 400);
  }
  const userId = authUser.id;

  try {
    await saveWorkspaceAccess(admin, workspaceId, userId, email, role, body);
    if (invited) {
      const { error: statusError } = await admin.from("workspace_members").update({ status: "invited" }).eq("workspace_id", workspaceId).eq("user_id", userId);
      if (statusError) throw statusError;
    }
    return json({ ok: true, user_id: userId, status: invited ? "invited" : "active" });
  } catch (error) {
    if (!identityAlreadyExisted) await admin.auth.admin.deleteUser(userId);
    return json({ error: `Cadastro revertido: ${(error as Error).message}` }, 409);
  }
}

async function resendInvite(admin: any, workspaceId: string, body: Record<string, unknown>) {
  const targetId = String(body.target_user_id ?? "");
  await assertTargetMember(admin, workspaceId, targetId);
  const { data: target, error: userError } = await admin.auth.admin.getUserById(targetId);
  if (userError || !target.user?.email) return json({ error: "Usuário não encontrado." }, 404);
  const { error } = await admin.auth.admin.inviteUserByEmail(target.user.email, { redirectTo: `${Deno.env.get("APP_URL") || "https://growdash.com.br"}/reset-password` });
  if (error) return json({ error: error.message }, 400);
  const { error: statusError } = await admin.from("workspace_members").update({ status: "invited" }).eq("workspace_id", workspaceId).eq("user_id", targetId);
  if (statusError) return json({ error: statusError.message }, 400);
  return json({ ok: true, status: "invited" });
}

async function cancelInvite(admin: any, workspaceId: string, body: Record<string, unknown>) {
  const targetId = String(body.target_user_id ?? "");
  const member = await assertTargetMember(admin, workspaceId, targetId);
  if (member.status !== "invited") return json({ error: "Este usuário já está ativo." }, 400);
  const { error } = await admin.from("workspace_members").update({ status: "disabled" }).eq("workspace_id", workspaceId).eq("user_id", targetId);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true, status: "disabled" });
}

async function updateUser(admin: any, workspaceId: string, callerId: string, body: Record<string, unknown>) {
  const targetId = String(body.target_user_id ?? "");
  if (!targetId) return json({ error: "Usuário de destino não informado." }, 400);
  if (targetId === callerId) return json({ error: "Edite a própria conta pela página de perfil." }, 400);
  await assertTargetMember(admin, workspaceId, targetId);
  const role = normalizeAccessRole(body.role);
  const email = String(body.email ?? "").toLowerCase().trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Informe um e-mail válido." }, 400);

  const password = String(body.password ?? "");
  if (password && password.length < 6) return json({ error: "A nova senha precisa ter pelo menos 6 caracteres." }, 400);
  if (password || email) {
    const { error } = await admin.auth.admin.updateUserById(targetId, {
      ...(password ? { password } : {}),
      ...(email ? { email, email_confirm: true } : {}),
    });
    if (error) return json({ error: error.message }, 400);
  }

  try {
    const effectiveEmail = email || String((await admin.auth.admin.getUserById(targetId)).data?.user?.email ?? "");
    await saveWorkspaceAccess(admin, workspaceId, targetId, effectiveEmail, role, body);
    return json({ ok: true });
  } catch (error) {
    return json({ error: `Não foi possível salvar as permissões: ${(error as Error).message}` }, 409);
  }
}

async function deleteUser(admin: any, workspaceId: string, callerId: string, body: Record<string, unknown>) {
  const targetId = String(body.target_user_id ?? "");
  if (!targetId) return json({ error: "Usuário de destino não informado." }, 400);
  if (targetId === callerId) return json({ error: "Você não pode excluir a própria conta." }, 400);
  await assertTargetMember(admin, workspaceId, targetId);

  const { data: target } = await admin.auth.admin.getUserById(targetId);
  if (!target?.user) return json({ error: "Usuário não encontrado." }, 404);
  if (String(target.user.email ?? "").toLowerCase() === PLATFORM_OWNER_EMAIL) {
    return json({ error: "A conta proprietária da plataforma não pode ser excluída." }, 403);
  }

  const { data: remaining, error: removeError } = await admin.rpc("admin_remove_workspace_user_access", {
    _workspace_id: workspaceId,
    _user_id: targetId,
  });
  if (removeError) return json({ error: `Falha ao remover o acesso: ${removeError.message}` }, 409);

  const managedIdentity = target.user.user_metadata?.managed_by_growdash === true;
  let identityWarning: string | null = null;
  if ((remaining ?? 0) === 0 && managedIdentity) {
    const { error } = await admin.auth.admin.deleteUser(targetId);
    if (error) identityWarning = "O acesso foi removido. A identidade inativa será limpa posteriormente.";
  }
  return json({ ok: true, warning: identityWarning });
}

async function listUsers(admin: any, workspaceId: string, callerId: string) {
  const { data: members, error: memberError } = await admin
    .from("workspace_members")
    .select("user_id, role, status, created_at")
    .eq("workspace_id", workspaceId)
    .neq("user_id", callerId)
    .order("created_at", { ascending: false });
  if (memberError) return json({ error: memberError.message }, 400);
  const editable = (members ?? []).filter((member: any) => member.role !== "owner");
  const ids = editable.map((member: any) => member.user_id);
  if (!ids.length) return json({ users: [] });

  const [{ data: permissions, error: permissionError }, { data: accounts }, { data: funnels }, authUsers] = await Promise.all([
    admin.from("workspace_user_permissions").select("*").eq("workspace_id", workspaceId).in("user_id", ids),
    admin.from("user_ad_account_access").select("user_id, ad_account_id").eq("workspace_id", workspaceId).in("user_id", ids),
    admin.from("user_rd_funnel_access").select("user_id, rd_funnel_id").eq("workspace_id", workspaceId).in("user_id", ids),
    Promise.all(ids.map(async (id: string) => {
      const { data } = await admin.auth.admin.getUserById(id);
      return data?.user ?? null;
    })),
  ]);
  if (permissionError) return json({ error: permissionError.message }, 400);

  const result = editable.map((member: any) => {
    const permission = (permissions ?? []).find((row: any) => row.user_id === member.user_id) ?? {};
    const authUser = authUsers.find((user: any) => user?.id === member.user_id);
    return {
      ...Object.fromEntries(PERMISSION_KEYS.map((key) => [key, permission[key] === true])),
      user_id: member.user_id,
      email: authUser?.email ?? permission.username ?? "",
      name: authUser?.user_metadata?.full_name ?? authUser?.user_metadata?.name ?? "",
      role: (["admin", "editor", "viewer", "financial", "analyst"] as string[]).includes(permission.access_role)
        ? permission.access_role
        : fromWorkspaceRole(member.role),
      status: member.status,
      ad_account_ids: (accounts ?? []).filter((row: any) => row.user_id === member.user_id).map((row: any) => row.ad_account_id),
      rd_funnel_ids: (funnels ?? []).filter((row: any) => row.user_id === member.user_id).map((row: any) => row.rd_funnel_id),
    };
  });
  return json({ users: result });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
