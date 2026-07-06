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
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => null);
    const messageId: string | undefined = body?.message_id;
    if (!messageId) return json({ error: 'Missing message_id' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: msg, error: mErr } = await admin
      .from('messages')
      .select('id, conversation_id, photo_path, kind, conversations!inner(patient_id, professional_id)')
      .eq('id', messageId)
      .maybeSingle();
    if (mErr || !msg || msg.kind !== 'photo' || !msg.photo_path) {
      return json({ error: 'Not found' }, 404);
    }
    // deno-lint-ignore no-explicit-any
    const conv: any = msg.conversations;
    const isParticipant = conv.patient_id === userId || conv.professional_id === userId;

    let isAdmin = false;
    if (!isParticipant) {
      const { data: adminRow } = await admin
        .from('clinic_admins')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      isAdmin = !!adminRow;
    }
    if (!isParticipant && !isAdmin) {
      return json({ error: 'Forbidden' }, 403);
    }

    const { data: signed, error: sErr } = await admin.storage
      .from('patient-photos')
      .createSignedUrl(msg.photo_path, 300);
    if (sErr || !signed) return json({ error: 'Sign failed' }, 500);

    await admin.from('audit_log').insert({
      actor_id: userId,
      action: isAdmin ? 'admin_photo_recovery' : 'photo_view',
      target_type: 'message',
      target_id: messageId,
    });
    if (isAdmin) {
      await admin.from('security_events').insert({
        user_id: userId,
        event_type: 'admin_recovery_photo_access',
        metadata: { message_id: messageId, conversation_id: msg.conversation_id },
      });
    }
    return json({ url: signed.signedUrl });
  } catch (e) {
    console.error('signed-photo-url error', e);
    return json({ error: 'Internal error', details: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
