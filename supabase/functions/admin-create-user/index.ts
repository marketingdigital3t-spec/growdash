import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const callerId = claims.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: callerRoles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId);
    const roles = (callerRoles ?? []).map((r) => r.role as string);

    const body = await req.json().catch(() => null);
    const full_name: string | undefined = body?.full_name?.trim();
    const email: string | undefined = body?.email?.trim().toLowerCase();
    const password: string | undefined = body?.password;
    const role: string = body?.role ?? 'professional';
    const permissions: { module: string; level: 'view' | 'edit' }[] = body?.permissions ?? [];

    if (!full_name || !email || !password || password.length < 8) {
      return json({ error: 'Campos obrigatórios: nome, e-mail e senha (mín. 8 caracteres)' }, 400);
    }
    if (!['admin', 'professional', 'patient'].includes(role)) {
      return json({ error: 'Papel inválido' }, 400);
    }
    const canCreate = roles.includes('admin') || (role === 'patient' && roles.includes('professional'));
    if (!canCreate) return json({ error: 'Apenas administradoras podem criar equipe; profissionais podem criar pacientes.' }, 403);

    let uid: string | undefined;
    let reusedExistingUser = false;

    // Cria usuário confirmado. Se o e-mail já existir para uma paciente, sincroniza o cadastro
    // em vez de deixar a tela parecer que não salvou.
    const { data: created, error: uErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });
    if (created.user) {
      uid = created.user.id;
    } else if (uErr && /already been registered|already exists|email/i.test(uErr.message ?? '')) {
      const existing = await findUserByEmail(admin, email);
      if (!existing) return json({ error: 'Este e-mail já existe, mas não foi possível sincronizar o cadastro.' }, 409);

      const { data: existingRoles } = await admin.from('user_roles').select('role').eq('user_id', existing.id);
      const existingRoleNames = (existingRoles ?? []).map((r) => r.role as string);
      const isOnlyPatient = existingRoleNames.length === 0 || existingRoleNames.every((r) => r === 'patient');
      if (role === 'patient' && !isOnlyPatient) {
        return json({ error: 'Este e-mail já pertence a uma usuária da equipe.' }, 409);
      }
      if (role !== 'patient') {
        return json({ error: 'Já existe uma conta com este e-mail.' }, 409);
      }

      const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata ?? {}), full_name, role },
      });
      if (updateErr) return json({ error: updateErr.message }, 400);
      uid = existing.id;
      reusedExistingUser = true;
    } else {
      return json({ error: uErr?.message ?? 'Falha ao criar' }, 400);
    }

    if (!uid) return json({ error: 'Falha ao identificar a usuária criada' }, 500);

    // trigger cria profile + role default; garante profile, papel correto e nome visível
    await admin.from('profiles').upsert({
      id: uid,
      full_name,
      initial_password_pending: role === 'patient',
    }, { onConflict: 'id' });
    await admin.from('user_roles').upsert({ user_id: uid, role }, { onConflict: 'user_id,role' });
    if (role !== 'patient') {
      await admin.from('user_roles').delete().eq('user_id', uid).eq('role', 'patient');
    }

    // Profissionais veem imediatamente as pacientes que criaram.
    if (role === 'patient' && roles.includes('professional')) {
      await admin
        .from('patient_links')
        .upsert({ patient_id: uid, professional_id: callerId, status: 'active' }, { onConflict: 'patient_id,professional_id' });
    }

    if (permissions.length) {
      const rows = permissions.map((p) => ({ user_id: uid, module: p.module, level: p.level }));
      await admin.from('user_permissions').upsert(rows, { onConflict: 'user_id,module' });
    }

    await admin.from('audit_log').insert({
      actor_id: callerId,
      action: 'user_create',
      target_type: 'user',
      target_id: uid,
      metadata: { email, role, permissions_count: permissions.length, reused_existing_user: reusedExistingUser },
    });

    return json({ user_id: uid, reused_existing_user: reusedExistingUser });
  } catch (e) {
    console.error('admin-create-user', e);
    return json({ error: 'Internal', details: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 1000) break;
  }
  return null;
}
