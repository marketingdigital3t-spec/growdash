import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
const admin = createClient(url, serviceKey);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);
  const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || serviceKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data: workspace } = await admin.from("workspaces").select("id").eq("owner_id", user.id).maybeSingle();
  if (!workspace) return json({ error: "WORKSPACE_NOT_FOUND" }, 404);
  const { data: proposals } = await admin.from("traffic_action_proposals").select("id,ad_account_id,entity_type,entity_id,approved_by,proposed_value,current_value").eq("workspace_id", workspace.id).eq("status", "approved").not("approved_by", "is", null).limit(20);
  const results: Array<Record<string, unknown>> = [];
  for (const proposal of proposals || []) {
    if (proposal.entity_type !== "adset" || !proposal.entity_id || !proposal.ad_account_id) continue;
    await admin.from("traffic_action_proposals").update({ status: "executing", updated_at: new Date().toISOString() }).eq("id", proposal.id).eq("status", "approved");
    const { data: account } = await admin.from("ad_accounts").select("account_id,access_token").eq("id", proposal.ad_account_id).eq("user_id", user.id).maybeSingle();
    const change = (proposal.proposed_value || {}) as { status?: string; daily_budget?: number };
    if (!account?.access_token) {
      await admin.from("traffic_action_proposals").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", proposal.id);
      await admin.from("traffic_action_audit").insert({ workspace_id: workspace.id, proposal_id: proposal.id, event_type: "failed", error_message: "META_TOKEN_UNAVAILABLE" });
      results.push({ id: proposal.id, status: "failed" });
      continue;
    }
    const payload = new URLSearchParams({ access_token: account.access_token });
    if (change.status) payload.set("status", change.status);
    if (change.daily_budget != null) payload.set("daily_budget", String(Math.round(Number(change.daily_budget) * 100)));
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${proposal.entity_id}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: payload });
    const provider = await response.json().catch(() => ({}));
    if (!response.ok || provider?.error) {
      const message = String(provider?.error?.message || `META_HTTP_${response.status}`).slice(0, 500);
      await admin.from("traffic_action_proposals").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", proposal.id);
      await admin.from("traffic_action_audit").insert({ workspace_id: workspace.id, proposal_id: proposal.id, event_type: "failed", error_message: message });
      results.push({ id: proposal.id, status: "failed", error: message });
      continue;
    }
    const { data: adset } = await admin.from("adsets").select("campaign_id,status,daily_budget").eq("id", proposal.entity_id).maybeSingle();
    const localUpdate = change.status ? { status: change.status, updated_at: new Date().toISOString() } : { daily_budget: change.daily_budget, updated_at: new Date().toISOString() };
    await admin.from("adsets").update(localUpdate).eq("id", proposal.entity_id);
    await admin.from("traffic_action_audit").insert({ workspace_id: workspace.id, proposal_id: proposal.id, event_type: "executed", actor_id: user.id, old_value: proposal.current_value, new_value: change, evidence: { provider } });
    await admin.from("campaign_changes").insert({ campaign_id: adset?.campaign_id, entity_type: "adset", entity_id: proposal.entity_id, change_type: "traffic_agent_approved", field: change.status ? "status" : "daily_budget", old_value: String(change.status ? adset?.status : adset?.daily_budget), new_value: String(change.status || change.daily_budget), created_by: user.id, note: "Alteração executada após aprovação explícita do proprietário" });
    await admin.from("traffic_action_proposals").update({ status: "executed", executed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", proposal.id);
    results.push({ id: proposal.id, status: "executed" });
  }
  return json({ status: "completed", executed: results.filter((item) => item.status === "executed").length, results });
});
