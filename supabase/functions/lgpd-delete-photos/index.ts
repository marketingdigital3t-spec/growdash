import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * LGPD Art. 18 II — exclusão de fotos da paciente.
 * Chamada pelo admin depois que uma solicitação `pending` é aprovada.
 * - Valida se quem chama tem papel `admin`.
 * - Pega todas as mensagens `photo` da paciente na conversa (ou todas as conversas se conversation_id for null).
 * - Apaga os arquivos do bucket privado `patient-photos`.
 * - Apaga as linhas em `messages`.
 * - Marca a solicitação como `done` com timestamp e resolver.
 * - Registra em `audit_log` e `security_events`.
 */
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
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const actorId = claims.claims.sub as string;

    const body = await req.json().catch(() => null);
    const requestId: string | undefined = body?.request_id;
    if (!requestId) return json({ error: 'Missing request_id' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: adminRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', actorId)
      .eq('role', 'admin')
      .maybeSingle();
    if (!adminRow) return json({ error: 'Forbidden' }, 403);

    const { data: reqRow, error: rErr } = await admin
      .from('data_deletion_requests')
      .select('id, patient_id, conversation_id, scope, status')
      .eq('id', requestId)
      .maybeSingle();
    if (rErr || !reqRow) return json({ error: 'Request not found' }, 404);
    if (reqRow.status !== 'pending' && reqRow.status !== 'approved') {
      return json({ error: `Request already ${reqRow.status}` }, 409);
    }

    // Marca como approved antes de executar para deixar rastro
    await admin
      .from('data_deletion_requests')
      .update({ status: 'approved', resolver_id: actorId })
      .eq('id', requestId);

    // Seleciona mensagens de foto da paciente
    const q = admin
      .from('messages')
      .select('id, photo_path, conversation_id')
      .eq('sender_id', reqRow.patient_id)
      .eq('kind', 'photo');
    const { data: msgs, error: mErr } = reqRow.conversation_id
      ? await q.eq('conversation_id', reqRow.conversation_id)
      : await q;
    if (mErr) return json({ error: 'Query failed', details: mErr.message }, 500);

    const paths = (msgs ?? []).map((m) => m.photo_path).filter((p): p is string => !!p);
    let removedFiles = 0;
    if (paths.length) {
      const { data: removed, error: sErr } = await admin.storage.from('patient-photos').remove(paths);
      if (sErr) {
        return json({ error: 'Storage removal failed', details: sErr.message }, 500);
      }
      removedFiles = removed?.length ?? paths.length;
    }

    const ids = (msgs ?? []).map((m) => m.id);
    let removedRows = 0;
    if (ids.length) {
      const { error: dErr, count } = await admin
        .from('messages')
        .delete({ count: 'exact' })
        .in('id', ids);
      if (dErr) return json({ error: 'Delete failed', details: dErr.message }, 500);
      removedRows = count ?? ids.length;
    }

    await admin
      .from('data_deletion_requests')
      .update({ status: 'done', resolved_at: new Date().toISOString(), resolver_id: actorId })
      .eq('id', requestId);

    await admin.from('audit_log').insert({
      actor_id: actorId,
      action: 'lgpd_photos_deleted',
      target_type: 'patient',
      target_id: reqRow.patient_id,
      metadata: {
        request_id: requestId,
        conversation_id: reqRow.conversation_id,
        removed_files: removedFiles,
        removed_messages: removedRows,
      },
    });
    await admin.from('security_events').insert({
      user_id: actorId,
      event_type: 'lgpd_photo_purge',
      metadata: {
        patient_id: reqRow.patient_id,
        request_id: requestId,
        removed_files: removedFiles,
        removed_messages: removedRows,
      },
    });

    return json({ ok: true, removed_files: removedFiles, removed_messages: removedRows });
  } catch (e) {
    console.error('lgpd-delete-photos error', e);
    return json({ error: 'Internal error', details: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
