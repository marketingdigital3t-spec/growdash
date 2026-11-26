import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const hash = async (value: string) => { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""); };
const state = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const clientId = Deno.env.get("HUBSPOT_CLIENT_ID");
  const clientSecret = Deno.env.get("HUBSPOT_CLIENT_SECRET");
  if (!clientId || !clientSecret) return json({ error: "HubSpot ainda não está configurado no servidor.", code: "HUBSPOT_NOT_CONFIGURED", action: "Cadastre HUBSPOT_CLIENT_ID e HUBSPOT_CLIENT_SECRET nos secrets do Supabase." }, 503);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Sessão inválida" }, 401);
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const rawState = state();
  await admin.from("hubspot_oauth_states").delete().lt("expires_at", new Date().toISOString());
  const { error } = await admin.from("hubspot_oauth_states").insert({ state_hash: await hash(rawState), user_id: user.id, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
  if (error) return json({ error: "Não foi possível iniciar a conexão segura." }, 500);
  const redirectUri = Deno.env.get("HUBSPOT_OAUTH_REDIRECT_URI") ?? `${supabaseUrl}/functions/v1/hubspot-oauth-callback`;
  const url = new URL("https://app.hubspot.com/oauth/authorize");
  url.searchParams.set("client_id", clientId); url.searchParams.set("redirect_uri", redirectUri); url.searchParams.set("scope", Deno.env.get("HUBSPOT_OAUTH_SCOPES") ?? "crm.objects.contacts.read crm.objects.deals.read crm.schemas.deals.read"); url.searchParams.set("state", rawState);
  return json({ authUrl: url.toString(), expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() });
});
