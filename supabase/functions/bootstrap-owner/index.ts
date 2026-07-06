import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Bootstrap do PRIMEIRO administrador da plataforma.
 * Só funciona se ainda NÃO existir nenhum admin — depois disso a rota trava
 * e novos usuários devem ser criados via admin-create-user (protegido).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Se já existe qualquer admin, bloqueia
    const { count } = await admin
      .from('user_roles')
      .select('user_id', { head: true, count: 'exact' })
      .eq('role', 'admin');
    if ((count ?? 0) > 0) {
      return json({ error: 'Já existe um administrador. Use o menu Usuários para criar novos acessos.' }, 403);
    }

    const body = await req.json().catch(() => null);
    const full_name: string | undefined = body?.full_name?.trim();
    const email: string | undefined = body?.email?.trim().toLowerCase();
    const password: string | undefined = body?.password;
    if (!full_name || !email || !password || password.length < 10) {
      return json({ error: 'Nome, e-mail e senha (mín. 10 caracteres) são obrigatórios.' }, 400);
    }

    // Se já existe usuário com esse e-mail, apenas promove a admin
    let userId: string | null = null;
    const { data: existing } = await admin.auth.admin.listUsers();
    const match = existing?.users?.find((u) => u.email?.toLowerCase() === email);
    if (match) {
      // Atualiza senha e metadata; confirma e-mail
      const { data: upd, error: uErr } = await admin.auth.admin.updateUserById(match.id, {
        password,
        email_confirm: true,
        user_metadata: { ...(match.user_metadata ?? {}), full_name, role: 'admin' },
      });
      if (uErr || !upd?.user) return json({ error: uErr?.message ?? 'Falha ao atualizar' }, 400);
      userId = upd.user.id;
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role: 'admin' },
      });
      if (cErr || !created?.user) return json({ error: cErr?.message ?? 'Falha ao criar' }, 400);
      userId = created.user.id;
    }

    await admin.from('user_roles').upsert({ user_id: userId!, role: 'admin' }, { onConflict: 'user_id,role' });
    await admin
      .from('profiles')
      .upsert({ id: userId!, full_name }, { onConflict: 'id' });

    await admin.from('audit_log').insert({
      actor_id: userId,
      action: 'owner_bootstrap',
      target_type: 'user',
      target_id: userId,
      metadata: { email },
    });

    return json({ ok: true, user_id: userId });
  } catch (e) {
    console.error('bootstrap-owner', e);
    return json({ error: 'Internal', details: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
