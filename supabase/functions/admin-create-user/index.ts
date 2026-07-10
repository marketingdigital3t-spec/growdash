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
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) return json({ error: 'Forbidden — apenas administradoras' }, 403);

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

    // Cria usuário confirmado
    const { data: created, error: uErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });
    if (uErr || !created.user) return json({ error: uErr?.message ?? 'Falha ao criar' }, 400);
    const uid = created.user.id;

    // trigger cria profile + role default; garante role correto
    await admin.from('user_roles').upsert({ user_id: uid, role }, { onConflict: 'user_id,role' });

    // Marca perfil como usando senha inicial (para ícone de chave até o primeiro login)
    await admin.from('profiles').update({ initial_password_pending: true }).eq('id', uid);

    if (permissions.length) {
      const rows = permissions.map((p) => ({ user_id: uid, module: p.module, level: p.level }));
      await admin.from('user_permissions').upsert(rows, { onConflict: 'user_id,module' });
    }

    await admin.from('audit_log').insert({
      actor_id: callerId,
      action: 'user_create',
      target_type: 'user',
      target_id: uid,
      metadata: { email, role, permissions_count: permissions.length },
    });

    return json({ user_id: uid });
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
