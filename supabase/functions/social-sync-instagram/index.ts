import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function graphJson(url: URL) {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(url, { headers: { Accept: "application/json" } });
    if (response.status !== 429) break;
    await response.text();
    await sleep(800 * (attempt + 1));
  }
  const payload = await response?.json().catch(() => ({}));
  if (!response?.ok || payload?.error) throw new Error(payload?.error?.message ?? `Instagram HTTP ${response?.status ?? 502}`);
  return payload;
}

async function mediaInsights(base: string, mediaId: string, token: string) {
  const metrics = ["reach", "saved", "shares", "total_interactions", "views"];
  const result: Record<string, number> = {};
  const combined = new URL(`${base}/${mediaId}/insights`);
  combined.searchParams.set("metric", metrics.join(","));
  combined.searchParams.set("access_token", token);
  try {
    const payload = await graphJson(combined);
    for (const item of payload.data ?? []) result[item.name] = Number(item.values?.[0]?.value ?? item.value ?? 0);
    return result;
  } catch {
    // Media types support different metric sets. A failed metric must not make
    // the entire content sync fail, so retry individually and keep what exists.
    for (const metric of metrics) {
      const url = new URL(`${base}/${mediaId}/insights`);
      url.searchParams.set("metric", metric);
      url.searchParams.set("access_token", token);
      try {
        const payload = await graphJson(url);
        const item = payload.data?.[0];
        if (item) result[metric] = Number(item.values?.[0]?.value ?? item.value ?? 0);
      } catch {
        result[metric] = 0;
      }
    }
    return result;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const body = await req.json().catch(() => ({}));
    const socialAccountId = String(body?.social_account_id ?? "");
    if (!socialAccountId) return json({ error: "Conta social não informada" }, 400);
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: account, error: accountError } = await admin.from("social_accounts").select("*").eq("id", socialAccountId).maybeSingle();
    if (accountError) throw accountError;
    if (!account || account.user_id !== user.id) return json({ error: "Conta social não encontrada" }, 404);
    const { data: integration } = await admin.from("integrations").select("id,api_token,is_active,token_expires_at").eq("user_id", user.id).eq("provider", "instagram_business").eq("provider_account_id", account.provider_account_id).maybeSingle();
    if (!integration?.is_active || !integration.api_token) return json({ error: "Reconecte o Instagram para sincronizar." }, 409);
    if (integration.token_expires_at && new Date(integration.token_expires_at).getTime() <= Date.now()) {
      await admin.from("social_accounts").update({ connection_status: "expired", last_error: "Token expirado" }).eq("id", account.id);
      return json({ error: "A autorização do Instagram expirou. Reconecte a conta." }, 401);
    }
    const token = String(integration.api_token);
    const version = Deno.env.get("INSTAGRAM_GRAPH_API_VERSION") ?? "v25.0";
    const base = `https://graph.instagram.com/${version}`;
    const profileUrl = new URL(`${base}/${account.provider_account_id}`);
    profileUrl.searchParams.set("fields", "id,username,name,profile_picture_url,followers_count,media_count");
    profileUrl.searchParams.set("access_token", token);
    const profile = await graphJson(profileUrl);
    const mediaUrl = new URL(`${base}/${account.provider_account_id}/media`);
    mediaUrl.searchParams.set("fields", "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count");
    mediaUrl.searchParams.set("limit", "25");
    mediaUrl.searchParams.set("access_token", token);
    const mediaPayload = await graphJson(mediaUrl);
    const media = Array.isArray(mediaPayload.data) ? mediaPayload.data : [];
    let totalReach = 0;
    let totalInteractions = 0;
    for (const item of media) {
      const insights = await mediaInsights(base, String(item.id), token);
      const likes = Number(item.like_count ?? 0);
      const comments = Number(item.comments_count ?? 0);
      const saves = Number(insights.saved ?? 0);
      const shares = Number(insights.shares ?? 0);
      const reach = Number(insights.reach ?? 0);
      const interactions = Number(insights.total_interactions ?? likes + comments + saves + shares);
      totalReach += reach;
      totalInteractions += interactions;
      const { error } = await admin.from("social_media").upsert({
        social_account_id: account.id,
        provider_media_id: String(item.id),
        media_type: String(item.media_product_type ?? item.media_type ?? "post").toLowerCase(),
        caption: item.caption ?? null,
        permalink: item.permalink ?? null,
        media_url: item.media_url ?? null,
        thumbnail_url: item.thumbnail_url ?? null,
        published_at: item.timestamp ?? null,
        reach,
        impressions: Number(insights.views ?? 0),
        likes,
        comments,
        saves,
        shares,
        video_views: Number(insights.views ?? 0),
        interactions,
        engagement_rate: reach > 0 ? (interactions / reach) * 100 : 0,
        raw_metrics: insights,
        synced_at: new Date().toISOString(),
      }, { onConflict: "social_account_id,provider_media_id" });
      if (error) throw error;
    }
    const today = new Date().toISOString().slice(0, 10);
    const { data: previous } = await admin.from("social_insights_daily").select("followers").eq("social_account_id", account.id).lt("insight_date", today).order("insight_date", { ascending: false }).limit(1).maybeSingle();
    const followers = Number(profile.followers_count ?? account.followers_count ?? 0);
    await admin.from("social_insights_daily").upsert({ social_account_id: account.id, insight_date: today, followers, follower_delta: followers - Number(previous?.followers ?? followers), reach: totalReach, impressions: 0, interactions: totalInteractions }, { onConflict: "social_account_id,insight_date" });
    await admin.from("social_accounts").update({ username: profile.username ?? account.username, display_name: profile.name ?? profile.username ?? account.display_name, profile_picture_url: profile.profile_picture_url ?? account.profile_picture_url, followers_count: followers, media_count: Number(profile.media_count ?? account.media_count), connection_status: "connected", last_error: null, last_sync_at: new Date().toISOString() }).eq("id", account.id);
    return json({ ok: true, media: media.length, followers, message: `${media.length} conteúdos atualizados com dados oficiais do Instagram.` });
  } catch (error) {
    console.error("social-sync-instagram", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
