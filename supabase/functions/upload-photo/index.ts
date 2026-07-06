import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Recebe um blob JÁ CRIPTOGRAFADO pelo cliente (AES-GCM com a chave da conversa).
 * O servidor não conhece a chave nem consegue descriptografar — apenas armazena
 * e registra o evento de auditoria.
 *
 * Body: { conversation_id, ciphertext_base64, iv_base64 }
 * O IV é anexado como prefixo binário (12 bytes) antes do ciphertext no arquivo.
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
    const userId = claims.claims.sub as string;
    // Exige AAL2 (2FA verificado nesta sessão) para profissional/admin
    const aal = (claims.claims as Record<string, unknown>).aal as string | undefined;

    const body = await req.json().catch(() => null);
    if (!body?.conversation_id || !body?.ciphertext_base64 || !body?.iv_base64) {
      return json({ error: 'Missing fields' }, 400);
    }
    const conversationId: string = body.conversation_id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Verifica participação
    const { data: conv, error: cErr } = await admin
      .from('conversations')
      .select('id, patient_id, professional_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (cErr || !conv) return json({ error: 'Conversation not found' }, 404);
    if (conv.patient_id !== userId && conv.professional_id !== userId) {
      await admin.from('security_events').insert({
        user_id: userId,
        event_type: 'upload_forbidden',
        metadata: { conversation_id: conversationId },
      });
      return json({ error: 'Forbidden' }, 403);
    }

    // Exige 2FA para o profissional (admin/professional). Paciente pode enviar sem AAL2.
    const isProf = conv.professional_id === userId;
    if (isProf && aal !== 'aal2') {
      return json({ error: '2FA required' }, 403);
    }

    // Rate-limit simples: máx 20 uploads / 10min por usuário nesta conversa
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('sender_id', userId)
      .eq('kind', 'photo')
      .gte('created_at', since);
    if ((count ?? 0) >= 20) {
      await admin.from('security_events').insert({
        user_id: userId,
        event_type: 'upload_rate_limited',
        metadata: { conversation_id: conversationId },
      });
      return json({ error: 'Rate limit exceeded' }, 429);
    }

    // Decodifica IV + ciphertext e concatena em um único blob binário
    const iv = base64ToBytes(body.iv_base64);
    const ct = base64ToBytes(body.ciphertext_base64);
    if (iv.byteLength !== 12) return json({ error: 'Invalid IV' }, 400);
    if (ct.byteLength === 0 || ct.byteLength > 12 * 1024 * 1024) {
      return json({ error: 'Ciphertext size invalid (max 12MB)' }, 400);
    }
    const blob = new Uint8Array(iv.byteLength + ct.byteLength);
    blob.set(iv, 0);
    blob.set(ct, iv.byteLength);

    const path = `${conversationId}/${crypto.randomUUID()}.bin`;
    const { error: upErr } = await admin.storage
      .from('patient-photos')
      .upload(path, blob, { contentType: 'application/octet-stream', upsert: false });
    if (upErr) return json({ error: 'Upload failed', details: upErr.message }, 500);

    const { data: msg, error: mErr } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        kind: 'photo',
        photo_path: path,
      })
      .select()
      .single();
    if (mErr) return json({ error: 'Insert failed', details: mErr.message }, 500);

    await admin.from('audit_log').insert({
      actor_id: userId,
      action: 'photo_upload_encrypted',
      target_type: 'message',
      target_id: msg.id,
      metadata: { conversation_id: conversationId, path, size: blob.byteLength },
    });
    await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

    return json({ message: msg });
  } catch (e) {
    console.error('upload-photo error', e);
    return json({ error: 'Internal error' }, 500);
  }
});

function base64ToBytes(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
