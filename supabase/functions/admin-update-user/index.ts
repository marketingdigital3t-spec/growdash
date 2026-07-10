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
    const isAdmin = roles.includes('admin');
    const isProfessional = roles.includes('professional');
    if (!isAdmin && !isProfessional) {
      return json({ error: 'Apenas administradoras e profissionais podem editar pacientes.' }, 403);
    }

    const body = await req.json().catch(() => null);
    const user_id: string | undefined = body?.user_id;
    if (!user_id) return json({ error: 'user_id obrigatório' }, 400);

    // Confirm target is a patient
    const { data: targetRoles } = await admin.from('user_roles').select('role').eq('user_id', user_id);
    const targetIsPatient = (targetRoles ?? []).some((r) => r.role === 'patient');
    if (!targetIsPatient) {
      return json({ error: 'Este endpoint só edita pacientes.' }, 403);
    }

    // Professionals must have the link to this patient
    if (!isAdmin && isProfessional) {
      const { data: link } = await admin
        .from('patient_links')
        .select('patient_id')
        .eq('professional_id', callerId)
        .eq('patient_id', user_id)
        .maybeSingle();
      if (!link) return json({ error: 'Sem vínculo com essa paciente.' }, 403);
    }

    const full_name: string | undefined = typeof body?.full_name === 'string' ? body.full_name.trim() : undefined;
    const phone: string | null | undefined = typeof body?.phone === 'string' ? body.phone.trim() : body?.phone;
    const instagram: string | null | undefined = typeof body?.instagram === 'string' ? body.instagram.trim() : body?.instagram;
    const avatar_url: string | null | undefined = typeof body?.avatar_url === 'string' ? body.avatar_url : body?.avatar_url;
    const email: string | undefined = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : undefined;
    const password: string | undefined = typeof body?.password === 'string' && body.password.length ? body.password : undefined;

    if (password !== undefined && password.length < 8) {
      return json({ error: 'Senha deve ter ao menos 8 caracteres.' }, 400);
    }

    // Update profiles
    const profileUpdate: Record<string, unknown> = {};
    if (full_name !== undefined) profileUpdate.full_name = full_name;
    if (phone !== undefined) profileUpdate.phone = phone;
    if (instagram !== undefined) profileUpdate.instagram = instagram;
    if (avatar_url !== undefined) profileUpdate.avatar_url = avatar_url;
    if (Object.keys(profileUpdate).length) {
      const { error: pErr } = await admin.from('profiles').update(profileUpdate).eq('id', user_id);
      if (pErr) return json({ error: `Falha ao atualizar perfil: ${pErr.message}` }, 400);
    }

    // Update auth (email/password)
    const authUpdate: Record<string, unknown> = {};
    if (email !== undefined) authUpdate.email = email;
    if (password !== undefined) {
      authUpdate.password = password;
      // marca senha inicial pendente = false quando admin/profissional troca (uso é intencional)
      await admin.from('profiles').update({ initial_password_pending: true }).eq('id', user_id);
    }
    if (Object.keys(authUpdate).length) {
      const { error: aErr } = await admin.auth.admin.updateUserById(user_id, authUpdate);
      if (aErr) return json({ error: `Falha ao atualizar login: ${aErr.message}` }, 400);
    }

    // Audit
    await admin.from('audit_log').insert({
      actor_id: callerId,
      action: 'patient_update',
      target_id: user_id,
      metadata: {
        fields: Object.keys({ ...profileUpdate, ...authUpdate }),
      } as unknown as never,
    }).then(() => {}, () => {});

    return json({ ok: true });
  } catch (e) {
    console.error('admin-update-user', e);
    return json({ error: 'Internal', details: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
