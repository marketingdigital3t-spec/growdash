import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { matchingWorkflowAutomations } from "../_shared/automationTrigger.ts";
import { extractMetaMessagingAttribution, upsertMetaMessagingCrmLead } from "../_shared/metaMessagingAttribution.ts";
import { syncCrmLeadToRD } from "../_shared/metaLeadRdSync.ts";
import { scheduleWhatsAppFollowups } from "../_shared/whatsappFollowups.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "x-whatsapp-verify-token, x-hub-signature-256, authorization, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function validSignature(rawBody: string, header: string | null) {
  const secret = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("META_APP_SECRET") ?? "";
  if (!secret || !header || !/^sha256=[a-f0-9]{64}$/i.test(header)) return false;
  const expected = new Uint8Array(header.slice(7).match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return await crypto.subtle.verify("HMAC", key, expected, new TextEncoder().encode(rawBody));
}

async function resolveReferralAd(admin: any, workspaceId: string, adId: string | null) {
  if (!adId) return { accountId: null, tracking: null };
  const { data: ad } = await admin.from("ads").select("id,name,adset_id").eq("id", adId).maybeSingle();
  if (!ad?.adset_id) return { accountId: null, tracking: { ad_id: adId, ad_name: null, adset_id: null, adset_name: null, campaign_id: null, campaign_name: null } };
  const { data: adset } = await admin.from("adsets").select("id,name,campaign_id").eq("id", ad.adset_id).maybeSingle();
  const { data: campaign } = adset?.campaign_id
    ? await admin.from("campaigns").select("id,name,ad_account_id").eq("id", adset.campaign_id).maybeSingle()
    : { data: null };
  if (!campaign?.ad_account_id) return { accountId: null, tracking: { ad_id: adId, ad_name: ad.name || null, adset_id: adset?.id || null, adset_name: adset?.name || null, campaign_id: campaign?.id || null, campaign_name: campaign?.name || null } };
  const { data: account } = await admin.from("ad_accounts").select("id,workspace_id").eq("id", campaign.ad_account_id).eq("workspace_id", workspaceId).maybeSingle();
  return {
    accountId: account?.id || null,
    tracking: { ad_id: adId, ad_name: ad.name || null, adset_id: adset?.id || null, adset_name: adset?.name || null, campaign_id: campaign.id || null, campaign_name: campaign.name || null },
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === Deno.env.get("WHATSAPP_VERIFY_TOKEN")) return new Response(challenge || "", { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const rawBody = await req.text();
  const signatureSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("META_APP_SECRET") ?? "";
  if (!(await validSignature(rawBody, req.headers.get("x-hub-signature-256")))) {
    return json({ error: signatureSecret ? "Assinatura Meta inválida" : "Webhook WhatsApp sem segredo de assinatura configurado" }, signatureSecret ? 401 : 503);
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const payload = JSON.parse(rawBody || "{}");
  const workflowUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/workflow-execute`;
  const internalSecret = Deno.env.get("AUTOMATION_INTERNAL_SECRET") ?? "";
  const results: Array<Record<string, unknown>> = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const { data: number } = await admin.from("whatsapp_numbers").select("id,workspace_id,agent_id,mode,ad_account_id").eq("phone_number_id", phoneNumberId).maybeSingle();
      if (!number) continue;
      const { data: automations } = await admin.from("growdash_automations").select("id,status,trigger_type,trigger_config,workflow_definition").eq("workspace_id", number.workspace_id).eq("status", "active");
      for (const message of value.messages || []) {
        const contact = (value.contacts || []).find((item: any) => item.wa_id === message.from);
        const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || null;
        const referralTracking = extractMetaMessagingAttribution(message, "whatsapp");
        if (referralTracking.referral) {
          const resolved = await resolveReferralAd(admin, number.workspace_id, referralTracking.ad_id);
          const mergedTracking = {
            ...referralTracking,
            ...(resolved.tracking || {}),
            platform: referralTracking.platform || "whatsapp",
          };
          const crmLead = await upsertMetaMessagingCrmLead(admin, {
            workspaceId: number.workspace_id,
            sourceProvider: "meta_whatsapp",
            externalId: `whatsapp:${phoneNumberId}:${message.from}`,
            fullName: contact?.profile?.name || null,
            phone: message.from || null,
            adAccountId: resolved.accountId,
            tracking: mergedTracking,
            payload: { phone_number_id: phoneNumberId, message },
          });
          await syncCrmLeadToRD(admin, String(crmLead.id));
        }
        const { data: conversation } = await admin.from("whatsapp_conversations").upsert({ workspace_id: number.workspace_id, whatsapp_number_id: number.id, wa_contact_id: message.from, contact_name: contact?.profile?.name || null, contact_phone: message.from, unread_count: 1, last_message_at: new Date(Number(message.timestamp || 0) * 1000).toISOString(), updated_at: new Date().toISOString() }, { onConflict: "whatsapp_number_id,wa_contact_id" }).select("id").single();
        if (!conversation) continue;
        await admin.from("whatsapp_messages").upsert({ workspace_id: number.workspace_id, conversation_id: conversation.id, wamid: message.id, direction: "inbound", message_type: message.type || "text", body: text, raw: message, sent_at: new Date(Number(message.timestamp || 0) * 1000).toISOString() }, { onConflict: "wamid" });
        await scheduleWhatsAppFollowups(admin, { workspaceId: number.workspace_id, whatsappNumberId: number.id, conversationId: conversation.id, agentId: number.agent_id, inboundAt: new Date(Number(message.timestamp || 0) * 1000).toISOString() });
        if (number.mode !== "human" && number.agent_id && internalSecret.length >= 24) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-agent-reply`, { method: "POST", headers: { "Content-Type": "application/json", "x-growdash-internal-secret": internalSecret }, body: JSON.stringify({ conversation_id: conversation.id, trigger_message_id: message.id }) });
        }
        const matching = matchingWorkflowAutomations(automations || [], { type: "whatsapp_message", id: String(message.id || ""), text: text || "", whatsapp_number_id: String(number.id), phone_number_id: String(phoneNumberId) });
        if (matching.length && internalSecret.length < 24) {
          results.push({ event_id: message.id, status: "error", error: "AUTOMATION_INTERNAL_SECRET não configurado" });
          continue;
        }
        for (const automation of matching) {
          const response = await fetch(workflowUrl, { method: "POST", headers: { "Content-Type": "application/json", "x-growdash-automation-secret": internalSecret }, body: JSON.stringify({ workflow_id: automation.id, mode: "webhook", input: { type: "whatsapp_message", id: message.id, text, whatsapp_number_id: number.id, phone_number_id: phoneNumberId, from: message.from, message_type: message.type, raw: message }, idempotency_key: `whatsapp:${automation.id}:${message.id}` }) });
          const data = await response.json().catch(() => ({}));
          results.push({ automation_id: automation.id, event_id: message.id, status: response.ok ? data?.status || "processed" : "failed", detail: data?.error || null });
        }
      }
      await admin.from("whatsapp_numbers").update({ last_webhook_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", number.id);
    }
  }
  return json({ received: true, processed_workflows: results.length, results });
});
