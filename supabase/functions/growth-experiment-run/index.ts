import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const graphVersion = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
const admin = createClient(url, serviceKey);
const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const bannedClaims = /(garantid[oa]|cura|curar|100%|resultado garantido|sem esforço|antes e depois|milagre|sem risco)/i;
const money = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const allowedCtas = new Set(["LEARN_MORE", "SIGN_UP", "CONTACT_US", "GET_QUOTE", "APPLY_NOW", "BOOK_TRAVEL", "DOWNLOAD", "SHOP_NOW", "SUBSCRIBE", "WATCH_MORE", "MESSAGE_PAGE", "WHATSAPP_MESSAGE"]);

async function userFor(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const client = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data } = await client.auth.getUser();
  return data.user || null;
}

async function graph(accountToken: string, path: string, method = "GET", fields: Record<string, string> = {}) {
  const payload = new URLSearchParams({ access_token: accountToken, ...fields });
  const endpoint = `https://graph.facebook.com/${graphVersion}/${path}${method === "GET" ? `?${payload.toString()}` : ""}`;
  const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: method === "GET" ? undefined : payload });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(String(data?.error?.message || `META_HTTP_${response.status}`));
  return data;
}

async function block(workspaceId: string, experimentId: string, reason: string) {
  await admin.from("growth_experiments").update({ status: "blocked", block_reason: reason, updated_at: new Date().toISOString() }).eq("id", experimentId);
  await admin.from("growth_decisions").insert({ workspace_id: workspaceId, experiment_id: experimentId, decision: "block", reason, evidence: { reason } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await userFor(req);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const requestedId = typeof body?.experiment_id === "string" ? body.experiment_id : null;
    const { data: workspace } = await admin.from("workspaces").select("id").eq("owner_id", user.id).maybeSingle();
    if (!workspace) return json({ error: "WORKSPACE_NOT_FOUND" }, 404);
    const { data: settings } = await admin.from("traffic_agent_settings").select("enabled,autonomy_mode,auto_publish_enabled,max_concurrent_tests,test_budget_fraction,hard_test_cap,test_window_hours").eq("workspace_id", workspace.id).maybeSingle();
    if (!settings?.enabled || settings.autonomy_mode !== "autonomous_full") return json({ status: "paused", reason: "OWNER_AUTONOMY_APPROVAL_REQUIRED" });
    if (settings.auto_publish_enabled !== true) return json({ status: "paused", reason: "AUTO_PUBLISH_DISABLED" });
    const experimentQuery = admin.from("growth_experiments").select("*").eq("workspace_id", workspace.id).in("status", ["planned", "policy_review", "ready"]);
    const { data: experiments } = requestedId ? await experimentQuery.eq("id", requestedId).limit(1) : await experimentQuery.order("created_at", { ascending: true }).limit(5);
    const results: Array<Record<string, unknown>> = [];
    for (const experiment of experiments || []) {
      let createdAdsetId = "";
      const createdAdIds: string[] = [];
      let budgetReserved = false;
      try {
        const { count: activeCount } = await admin.from("growth_experiments").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("ad_account_id", experiment.ad_account_id).in("status", ["published", "measuring"]);
        if (Number(activeCount || 0) >= Number(settings.max_concurrent_tests || 2)) { await block(workspace.id, experiment.id, "MAX_CONCURRENT_TESTS"); results.push({ id: experiment.id, status: "blocked" }); continue; }
        const { data: account } = await admin.from("ad_accounts").select("account_id,access_token,connection_status,daily_budget").eq("id", experiment.ad_account_id).eq("user_id", user.id).maybeSingle();
        if (!account?.access_token || account.connection_status === "disconnected") { await block(workspace.id, experiment.id, "META_TOKEN_INVALID"); results.push({ id: experiment.id, status: "blocked" }); continue; }
        const { data: variants } = await admin.from("growth_experiment_variants").select("*,growth_creative_assets(id,asset_kind,storage_path,status,claims)").eq("experiment_id", experiment.id).eq("status", "ready");
        if (!variants?.length) { await block(workspace.id, experiment.id, "NO_POLICY_REVIEWED_VARIANTS"); results.push({ id: experiment.id, status: "blocked" }); continue; }
        const invalid = variants.some((variant: any) => bannedClaims.test(JSON.stringify({ copy: variant.provider_response || {}, claims: variant.growth_creative_assets?.claims || {} })));
        if (invalid) { await block(workspace.id, experiment.id, "POLICY_CLAIM_FLAG"); results.push({ id: experiment.id, status: "blocked" }); continue; }
        if (variants.some((variant: any) => variant.growth_creative_assets?.asset_kind === "video")) { await block(workspace.id, experiment.id, "VIDEO_UPLOAD_PROVIDER_UNAVAILABLE"); results.push({ id: experiment.id, status: "blocked" }); continue; }
        const accountDailyBudget = money(account.daily_budget);
        if (accountDailyBudget <= 0) { await block(workspace.id, experiment.id, "ACCOUNT_DAILY_BUDGET_UNAVAILABLE"); results.push({ id: experiment.id, status: "blocked" }); continue; }
        const budget = Math.min(money(experiment.test_budget), Number(settings.hard_test_cap || 500), accountDailyBudget * Number(settings.test_budget_fraction || 0.1));
        if (budget <= 0) { await block(workspace.id, experiment.id, "TEST_BUDGET_ZERO"); results.push({ id: experiment.id, status: "blocked" }); continue; }
        const existingProvider = experiment.provider_state || {};
        if (existingProvider.test_adset_id) { results.push({ id: experiment.id, status: experiment.status, test_adset_id: existingProvider.test_adset_id }); continue; }
        const copy = await graph(account.access_token, `${experiment.source_adset_id}/copies`, "POST", { deep_copy: "true", rename_options: JSON.stringify({ rename_strategy: "DEEP_RENAME", rename_prefix: "TESTE | " }) });
        const testAdsetId = String(copy?.copied_adset_id || copy?.id || "");
        if (!testAdsetId) throw new Error("META_ADSET_COPY_ID_MISSING");
        createdAdsetId = testAdsetId;
        await graph(account.access_token, testAdsetId, "POST", { status: "PAUSED", daily_budget: String(Math.round(budget * 100)), name: `TESTE | ${experiment.hypothesis.slice(0, 180)}` });
        const sourceAd = await graph(account.access_token, experiment.source_ad_id, "GET", { fields: "id,name,creative{object_story_spec,asset_feed_spec}" });
        const story = sourceAd?.creative?.object_story_spec;
        if (!story) throw new Error("SOURCE_CREATIVE_STORY_MISSING");
        const copiedAds = await graph(account.access_token, `${testAdsetId}/ads`, "GET", { fields: "id" });
        for (const copiedAd of copiedAds?.data || []) await graph(account.access_token, copiedAd.id, "POST", { status: "PAUSED" });
        const createdAds: Array<{ adId: string; variantId: string }> = [];
        for (const variant of variants as any[]) {
          const copyText = variant.provider_response?.copy || {};
          const nextStory = structuredClone(story);
          const linkData = nextStory.link_data || nextStory.video_data || nextStory.template_data;
          if (!linkData) throw new Error("SOURCE_CREATIVE_FORMAT_UNSUPPORTED");
          if (copyText.primary_text) linkData.message = copyText.primary_text;
          if (copyText.headline) linkData.name = copyText.headline;
          if (copyText.description) linkData.description = copyText.description;
          if (copyText.cta && linkData.call_to_action && allowedCtas.has(copyText.cta)) linkData.call_to_action.type = copyText.cta;
          const tracking = variant.tracking_payload || {};
          if (linkData.link && typeof linkData.link === "string") {
            try {
              const destination = new URL(linkData.link);
              for (const [key, value] of Object.entries(tracking)) if (typeof value === "string" && value) destination.searchParams.set(key, value);
              linkData.link = destination.toString();
            } catch { /* preserve the source URL when Meta returns a non-URL placeholder */ }
          }
          const asset = variant.growth_creative_assets;
          if (asset?.asset_kind === "video") throw new Error("VIDEO_UPLOAD_PROVIDER_UNAVAILABLE");
          if (asset?.asset_kind === "image" && asset.storage_path) {
            const signed = await admin.storage.from("growth-creatives").createSignedUrl(asset.storage_path, 3600);
            if (!signed.error && signed.data?.signedUrl && linkData.image_url) linkData.image_url = signed.data.signedUrl;
          }
          const creative = await graph(account.access_token, `act_${String(account.account_id).replace(/^act_/i, "")}/adcreatives`, "POST", { name: `Growth | ${experiment.id} | ${variant.variant_index}`, object_story_spec: JSON.stringify(nextStory) });
          if (!creative?.id) throw new Error("META_CREATIVE_ID_MISSING");
          const ad = await graph(account.access_token, `act_${String(account.account_id).replace(/^act_/i, "")}/ads`, "POST", { name: `Growth | ${experiment.id} | V${variant.variant_index + 1}`, adset_id: testAdsetId, creative: JSON.stringify({ creative_id: creative.id }), status: "PAUSED" });
          if (!ad?.id) throw new Error("META_AD_ID_MISSING");
          createdAdIds.push(String(ad.id));
          await admin.from("growth_experiment_variants").update({ status: "published", new_adset_id: testAdsetId, new_ad_id: ad.id, provider_creative_id: creative.id, provider_response: { ...variant.provider_response, creative_id: creative.id, ad_id: ad.id } }).eq("id", variant.id);
          createdAds.push({ adId: ad.id, variantId: variant.id });
        }
        if (!createdAds.length) throw new Error("NO_VARIANT_ADS_CREATED");
        for (const created of createdAds) await graph(account.access_token, created.adId, "POST", { status: "ACTIVE" });
        await graph(account.access_token, testAdsetId, "POST", { status: "ACTIVE" });
        await admin.from("growth_budget_ledger").upsert({ workspace_id: workspace.id, ad_account_id: experiment.ad_account_id, experiment_id: experiment.id, entry_type: "reserve", amount: budget, idempotency_key: `reserve:${experiment.id}`, evidence: { source: "growth-experiment-run", budget, window_hours: experiment.window_hours } }, { onConflict: "workspace_id,idempotency_key" });
        budgetReserved = true;
        await admin.from("growth_experiments").update({ status: "measuring", test_budget: budget, started_at: new Date().toISOString(), ends_at: new Date(Date.now() + Number(experiment.window_hours || 72) * 3600_000).toISOString(), provider_state: { ...existingProvider, test_adset_id: testAdsetId }, updated_at: new Date().toISOString() }).eq("id", experiment.id);
        await admin.from("growth_decisions").insert({ workspace_id: workspace.id, experiment_id: experiment.id, decision: "continue", reason: "TEST_PUBLISHED", evidence: { test_adset_id: testAdsetId, budget } });
        results.push({ id: experiment.id, status: "measuring", test_adset_id: testAdsetId, budget });
      } catch (error) {
        const reason = error instanceof Error ? error.message.slice(0, 500) : "EXPERIMENT_RUN_FAILED";
        let rollbackComplete = true;
        for (const adId of createdAdIds) {
          try { await graph((await admin.from("ad_accounts").select("access_token").eq("id", experiment.ad_account_id).maybeSingle()).data?.access_token || "", adId, "POST", { status: "PAUSED" }); } catch { rollbackComplete = false; }
        }
        if (createdAdsetId) {
          try { await graph((await admin.from("ad_accounts").select("access_token").eq("id", experiment.ad_account_id).maybeSingle()).data?.access_token || "", createdAdsetId, "POST", { status: "PAUSED" }); } catch { rollbackComplete = false; }
        }
        if (budgetReserved) await admin.from("growth_budget_ledger").upsert({ workspace_id: workspace.id, ad_account_id: experiment.ad_account_id, experiment_id: experiment.id, entry_type: "rollback", amount: Number(experiment.test_budget || 0), idempotency_key: `rollback:${experiment.id}`, evidence: { reason } }, { onConflict: "workspace_id,idempotency_key" });
        if (createdAdsetId || createdAdIds.length) {
          await admin.from("growth_experiments").update({ status: "rolled_back", block_reason: reason, rollback_state: { adset_id: createdAdsetId || null, ad_ids: createdAdIds, complete: rollbackComplete }, updated_at: new Date().toISOString() }).eq("id", experiment.id);
          await admin.from("growth_decisions").insert({ workspace_id: workspace.id, experiment_id: experiment.id, decision: "rollback", reason, evidence: { adset_id: createdAdsetId || null, ad_ids: createdAdIds, complete: rollbackComplete } });
          results.push({ id: experiment.id, status: "rolled_back", rollback_complete: rollbackComplete });
        } else {
          await block(workspace.id, experiment.id, reason);
          results.push({ id: experiment.id, status: "blocked" });
        }
      }
    }
    return json({ status: "completed", results });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "GROWTH_EXPERIMENT_RUN_FAILED" }, 500);
  }
});
