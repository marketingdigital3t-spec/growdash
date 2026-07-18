import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-cron-secret, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webhook = Deno.env.get("WHATSAPP_REPORT_WEBHOOK_URL");
  const cronSecret = Deno.env.get("INTELLIGENCE_CRON_SECRET");
  const auth = req.headers.get("Authorization") || "";
  const isCron = Boolean(cronSecret && req.headers.get("x-cron-secret") === cronSecret);
  const admin = createClient(url, service);
  let allowedWorkspaceIds: string[] = [];
  if (!isCron) {
    const { data: { user } } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: memberships } = await admin.from("workspace_members").select("workspace_id").eq("user_id", user.id);
    allowedWorkspaceIds = (memberships || []).map((membership) => membership.workspace_id);
    if (!allowedWorkspaceIds.length) return new Response(JSON.stringify({ error: "Workspace not found" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!webhook) return new Response(JSON.stringify({ error: "WHATSAPP_REPORT_WEBHOOK_URL not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  let query = admin.from("whatsapp_report_schedules").select("*").eq("enabled", true);
  if (!isCron) query = query.in("workspace_id", allowedWorkspaceIds);
  if (body?.schedule_id) query = query.eq("id", body.schedule_id);
  else query = query.or(`next_run_at.is.null,next_run_at.lte.${new Date().toISOString()}`);
  const { data: schedules, error } = await query.limit(100);
  if (error) throw error;
  const deliveries = [];
  for (const schedule of schedules || []) {
    const snapshots = await admin.from("intelligence_snapshots").select("executive_summary, unified_metrics, anomalies, snapshot_date").eq("workspace_id", schedule.workspace_id).eq("ad_account_id", schedule.ad_account_id).order("snapshot_date", { ascending: false }).limit(1).maybeSingle();
    const snapshot = snapshots.data;
    const message = snapshot?.executive_summary || "Growdash: ainda não há resumo consolidado para esta conta. Verifique a sincronização das fontes.";
    try {
      const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: schedule.phone_e164, message, metadata: { schedule_id: schedule.id, metrics: snapshot?.unified_metrics || {}, anomalies: snapshot?.anomalies || [] } }) });
      if (!response.ok) throw new Error(`Webhook ${response.status}`);
      const next = new Date(Date.now() + 86_400_000).toISOString();
      await admin.from("whatsapp_report_schedules").update({ last_sent_at: new Date().toISOString(), next_run_at: next, last_status: "sent", last_error: null }).eq("id", schedule.id);
      deliveries.push({ id: schedule.id, status: "sent" });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Delivery failed";
      await admin.from("whatsapp_report_schedules").update({ last_status: "failed", last_error: message }).eq("id", schedule.id);
      deliveries.push({ id: schedule.id, status: "failed", error: message });
    }
  }
  return new Response(JSON.stringify({ processed: deliveries.length, deliveries }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
