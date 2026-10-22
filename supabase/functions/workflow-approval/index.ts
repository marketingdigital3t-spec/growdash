import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const base = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") || "";
  const userClient = createClient(base, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Não autorizado" }, 401);
  const body = await req.json().catch(() => ({}));
  const approvalId = String(body.approval_id || "").trim();
  const decision = String(body.decision || "").trim().toLowerCase();
  if (!approvalId || !["approved", "rejected"].includes(decision)) return json({ error: "approval_id e decision (approved/rejected) são obrigatórios." }, 400);
  const admin = createClient(base, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: approval, error: approvalError } = await admin.from("growdash_workflow_approvals").select("id,run_id,workspace_id,status").eq("id", approvalId).maybeSingle();
  if (approvalError) return json({ error: approvalError.message }, 500);
  if (!approval) return json({ error: "Aprovação não encontrada." }, 404);
  const { data: member } = await admin.from("workspace_members").select("id").eq("workspace_id", approval.workspace_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!member) return json({ error: "Workspace não autorizado." }, 403);
  if (approval.status !== "pending") return json({ ok: true, status: approval.status, run_id: approval.run_id });
  const { error: updateError } = await admin.from("growdash_workflow_approvals").update({ status: decision, resolved_at: new Date().toISOString(), resolved_by: user.id }).eq("id", approval.id).eq("status", "pending");
  if (updateError) return json({ error: updateError.message }, 500);
  if (decision === "rejected") {
    await admin.from("growdash_automation_runs").update({ status: "error", error_message: "Aprovação manual rejeitada.", finished_at: new Date().toISOString() }).eq("id", approval.run_id).eq("status", "partial");
    return json({ ok: true, status: "rejected", run_id: approval.run_id });
  }
  const { data: run } = await admin.from("growdash_automation_runs").select("automation_id").eq("id", approval.run_id).maybeSingle();
  const secret = Deno.env.get("AUTOMATION_INTERNAL_SECRET") || "";
  if (!run?.automation_id || secret.length < 24) return json({ error: "Executor interno indisponível." }, 503);
  const response = await fetch(`${base}/functions/v1/workflow-execute`, { method: "POST", headers: { "Content-Type": "application/json", "x-growdash-automation-secret": secret }, body: JSON.stringify({ workflow_id: run.automation_id, mode: "resume", approval_id: approval.id, idempotency_key: `approval:${approval.id}` }) });
  const result = await response.json().catch(() => ({}));
  return json(result, response.status);
});
