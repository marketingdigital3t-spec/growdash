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
      .from('user_roles').select('role').eq('user_id', callerId).eq('role', 'admin').maybeSingle();
    if (!roleRow) return json({ error: 'Forbidden — apenas administradoras' }, 403);

    const body = await req.json().catch(() => null);
    const user_id: string | undefined = body?.user_id;
    if (!user_id || typeof user_id !== 'string') return json({ error: 'user_id obrigatório' }, 400);
    if (user_id === callerId) return json({ error: 'Você não pode excluir a si mesma' }, 400);

    const { error: dErr } = await admin.auth.admin.deleteUser(user_id);
    if (dErr) return json({ error: dErr.message }, 400);

    await admin.from('audit_log').insert({
      actor_id: callerId, action: 'user_delete', target_type: 'user', target_id: user_id,
    });
    return json({ ok: true });
  } catch (e) {
    console.error('admin-delete-user', e);
    return json({ error: 'Internal', details: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
