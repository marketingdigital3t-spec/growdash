import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
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

    const body = await req.json().catch(() => null);
    if (!body?.conversation_id || !body?.file_base64 || !body?.mime) {
      return json({ error: 'Missing fields' }, 400);
    }
    const conversationId: string = body.conversation_id;
    const mime: string = body.mime;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(mime)) {
      return json({ error: 'Invalid mime' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verifica participação
    const { data: conv, error: cErr } = await admin
      .from('conversations')
      .select('id, patient_id, professional_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (cErr || !conv) return json({ error: 'Conversation not found' }, 404);
    if (conv.patient_id !== userId && conv.professional_id !== userId) {
      return json({ error: 'Forbidden' }, 403);
    }

    // Decodifica base64
    const b64 = (body.file_base64 as string).replace(/^data:[^;]+;base64,/, '');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 10 * 1024 * 1024) return json({ error: 'File too large (max 10MB)' }, 400);

    const ext = mime.split('/')[1];
    const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await admin.storage.from('patient-photos').upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (upErr) return json({ error: 'Upload failed', details: upErr.message }, 500);

    const { data: msg, error: mErr } = await admin
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: userId, kind: 'photo', photo_path: path })
      .select()
      .single();
    if (mErr) return json({ error: 'Insert failed', details: mErr.message }, 500);

    await admin.from('audit_log').insert({
      actor_id: userId,
      action: 'photo_upload',
      target_type: 'message',
      target_id: msg.id,
      metadata: { conversation_id: conversationId, path },
    });
    await admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

    return json({ message: msg });
  } catch (e) {
    console.error('upload-photo error', e);
    return json({ error: 'Internal error', details: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
