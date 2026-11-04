import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
const admin = createClient(url, serviceKey);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);
  const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || serviceKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data: workspace } = await admin.from("workspaces").select("id").eq("owner_id", user.id).maybeSingle();
  if (!workspace) return json({ error: "WORKSPACE_NOT_FOUND" }, 404);
  const now = new Date().toISOString();
  // Limites de risco são lidos aqui e re-impostos na execução: não adianta o
  // analyzer ter limitado a proposta se o executor não conferir de novo.
  const { data: riskSettings } = await admin
    .from("traffic_agent_settings")
    .select("max_budget_change_percent,max_daily_budget_change,execution_mode")
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  const maxBudgetChangePercent = Number(riskSettings?.max_budget_change_percent ?? 20);
  const maxDailyBudgetChange = Number(riskSettings?.max_daily_budget_change ?? 500);
  const { data: proposals, error: proposalQueryError } = await admin.from("traffic_action_proposals").select("id,ad_account_id,entity_type,entity_id,approved_by,proposed_value,current_value,valid_until").eq("workspace_id", workspace.id).eq("status", "approved").not("approved_by", "is", null).or(`valid_until.is.null,valid_until.gt.${now}`).limit(20);
  if (proposalQueryError) return json({ error: "PROPOSAL_QUERY_FAILED" }, 500);
  const results: Array<Record<string, unknown>> = [];
  for (const proposal of proposals || []) {
    if (proposal.entity_type !== "adset" || !proposal.entity_id || !proposal.ad_account_id) continue;
    const { data: claimed, error: claimError } = await admin.from("traffic_action_proposals").update({ status: "executing", updated_at: new Date().toISOString() }).eq("id", proposal.id).eq("status", "approved").select("id").maybeSingle();
    if (claimError || !claimed) continue;
    const { data: account } = await admin.from("ad_accounts").select("account_id,access_token").eq("id", proposal.ad_account_id).eq("user_id", user.id).maybeSingle();
    const change = (proposal.proposed_value || {}) as { status?: string; daily_budget?: number };
    if (!account?.access_token) {
      await admin.from("traffic_action_proposals").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", proposal.id);
      await admin.from("traffic_action_audit").insert({ workspace_id: workspace.id, proposal_id: proposal.id, event_type: "failed", error_message: "META_TOKEN_UNAVAILABLE" });
      results.push({ id: proposal.id, status: "failed" });
      continue;
    }
    const failProposal = async (message: string, evidence?: Record<string, unknown>) => {
      await admin.from("traffic_action_proposals").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", proposal.id);
      await admin.from("traffic_action_audit").insert({ workspace_id: workspace.id, proposal_id: proposal.id, event_type: "failed", error_message: message, ...(evidence ? { evidence } : {}) });
      results.push({ id: proposal.id, status: "failed", error: message });
    };
    // Leitura do estado REAL na Meta antes de qualquer mutação. Validar depois
    // do POST é tarde: a mudança já aconteceu e o gasto já foi feito.
    const remoteRead = await fetch(
      `https://graph.facebook.com/${graphVersion}/${proposal.entity_id}?fields=status,daily_budget&access_token=${account.access_token}`,
    );
    const remoteAdset = await remoteRead.json().catch(() => ({}));
    if (!remoteRead.ok || remoteAdset?.error) {
      await failProposal(String(remoteAdset?.error?.message || `META_READ_HTTP_${remoteRead.status}`).slice(0, 500));
      continue;
    }
    const expected = (proposal.current_value || {}) as { status?: string; daily_budget?: number };
    const remoteStatus = String(remoteAdset.status ?? "").toUpperCase();
    const remoteBudget = Number(remoteAdset.daily_budget ?? 0) / 100;
    const stateChanged = (expected.status && remoteStatus !== String(expected.status).toUpperCase()) ||
      (expected.daily_budget != null && Math.abs(remoteBudget - Number(expected.daily_budget)) > 0.01);
    if (stateChanged) {
      await failProposal("REMOTE_STATE_CHANGED_SINCE_APPROVAL", { expected, actual: { status: remoteAdset.status, daily_budget: remoteBudget } });
      continue;
    }
    // Os limites aprovados são re-impostos aqui: a proposta pode ter sido criada
    // com uma base antiga e o teto precisa valer sobre o estado atual da Meta.
    if (change.daily_budget != null) {
      const targetBudget = Number(change.daily_budget);
      const absoluteDelta = Math.abs(targetBudget - remoteBudget);
      const percentDelta = remoteBudget > 0 ? (absoluteDelta / remoteBudget) * 100 : absoluteDelta > 0 ? 100 : 0;
      if (absoluteDelta > maxDailyBudgetChange + 0.001 || percentDelta > maxBudgetChangePercent + 0.001) {
        await failProposal("BUDGET_CHANGE_EXCEEDS_APPROVED_LIMITS", {
          remote_budget: remoteBudget,
          target_budget: targetBudget,
          absolute_delta: absoluteDelta,
          percent_delta: Number(percentDelta.toFixed(2)),
          max_daily_budget_change: maxDailyBudgetChange,
          max_budget_change_percent: maxBudgetChangePercent,
        });
        continue;
      }
    }
    const payload = new URLSearchParams({ access_token: account.access_token });
    if (change.status) payload.set("status", change.status);
    if (change.daily_budget != null) payload.set("daily_budget", String(Math.round(Number(change.daily_budget) * 100)));
    await admin.from("traffic_action_audit").insert({ workspace_id: workspace.id, proposal_id: proposal.id, event_type: "executing", actor_id: user.id, old_value: expected, new_value: change });
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${proposal.entity_id}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: payload });
    const provider = await response.json().catch(() => ({}));
    if (!response.ok || provider?.error) {
      await failProposal(String(provider?.error?.message || `META_HTTP_${response.status}`).slice(0, 500));
      continue;
    }
    const { data: adset, error: adsetError } = await admin.from("adsets").select("campaign_id,status,daily_budget").eq("id", proposal.entity_id).maybeSingle();
    if (adsetError || !adset) {
      await failProposal(adsetError?.message || "ADSET_NOT_FOUND");
      continue;
    }
    const localUpdate = change.status ? { status: change.status, updated_at: new Date().toISOString() } : { daily_budget: change.daily_budget, updated_at: new Date().toISOString() };
    const { error: localError } = await admin.from("adsets").update(localUpdate).eq("id", proposal.entity_id);
    if (localError) {
      await admin.from("traffic_action_proposals").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", proposal.id);
      await admin.from("traffic_action_audit").insert({ workspace_id: workspace.id, proposal_id: proposal.id, event_type: "failed", error_message: `LOCAL_MIRROR_UPDATE_FAILED: ${localError.message}`, evidence: { provider } });
      results.push({ id: proposal.id, status: "failed", error: "LOCAL_MIRROR_UPDATE_FAILED" });
      continue;
    }
    const { error: auditError } = await admin.from("traffic_action_audit").insert({ workspace_id: workspace.id, proposal_id: proposal.id, event_type: "executed", actor_id: user.id, old_value: proposal.current_value, new_value: change, evidence: { provider } });
    const { error: changeError } = await admin.from("campaign_changes").insert({ campaign_id: adset.campaign_id, entity_type: "adset", entity_id: proposal.entity_id, change_type: "traffic_agent_approved", field: change.status ? "status" : "daily_budget", old_value: String(change.status ? adset.status : adset.daily_budget), new_value: String(change.status || change.daily_budget), created_by: user.id, note: "Alteração executada após aprovação explícita do proprietário" });
    if (auditError || changeError) {
      await admin.from("traffic_action_proposals").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", proposal.id);
      results.push({ id: proposal.id, status: "failed", error: "AUDIT_MIRROR_WRITE_FAILED" });
      continue;
    }
    const { error: finalError } = await admin.from("traffic_action_proposals").update({ status: "executed", executed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", proposal.id).eq("status", "executing");
    if (finalError) {
      await admin.from("traffic_action_audit").insert({ workspace_id: workspace.id, proposal_id: proposal.id, event_type: "failed", error_message: `PROPOSAL_FINALIZE_FAILED: ${finalError.message}` });
      results.push({ id: proposal.id, status: "failed", error: "PROPOSAL_FINALIZE_FAILED" });
      continue;
    }
    results.push({ id: proposal.id, status: "executed" });
  }
  return json({ status: "completed", executed: results.filter((item) => item.status === "executed").length, results });
});
