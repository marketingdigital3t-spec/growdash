import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || serviceKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  const { data: workspace } = await admin.from("workspaces").select("id").eq("owner_id", user.id).maybeSingle();
  if (!workspace) return new Response(JSON.stringify({ error: "WORKSPACE_NOT_FOUND" }), { status: 404, headers });
  const body = await req.json().catch(() => ({}));
  const { error } = await admin.from("traffic_agent_runtime").upsert({ workspace_id: workspace.id, status: body.status === "error" ? "error" : body.status === "analyzing" ? "analyzing" : "online", browser_status: body.browser_status || "connected", computer_name: typeof body.computer_name === "string" ? body.computer_name.slice(0, 120) : null, last_heartbeat_at: new Date().toISOString(), last_error: typeof body.last_error === "string" ? body.last_error.slice(0, 500) : null, updated_at: new Date().toISOString() });
  if (error) return new Response(JSON.stringify({ error: "HEARTBEAT_FAILED" }), { status: 500, headers });
  return new Response(JSON.stringify({ status: "ok", at: new Date().toISOString() }), { headers });
});
