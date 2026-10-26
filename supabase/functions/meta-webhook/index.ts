import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { syncCrmLeadToRD, syncMetaLeadToRD } from "../_shared/metaLeadRdSync.ts";
import { extractMetaMessagingAttribution, upsertMetaMessagingCrmLead } from "../_shared/metaMessagingAttribution.ts";
import { finishSyncExecution, startSyncExecution } from "../_shared/syncExecution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-hub-signature-256, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type MetaAccount = { id: string; user_id: string; workspace_id: string | null; access_token: string; account_id: string };

function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function pickField(fields: unknown, names: string[]) {
  if (!Array.isArray(fields)) return null;
  const wanted = names.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const field of fields) {
    const key = String(field?.name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!wanted.some((name) => key === name || key.includes(name))) continue;
    const value = Array.isArray(field?.values) ? field.values[0] : field?.values;
    if (value != null && String(value).trim()) return String(value);
  }
  return null;
}

async function resolveAccount(admin: any, adId: string | null, formId: string | null): Promise<MetaAccount | null> {
  let accountId: string | null = null;
  if (adId) {
    const { data: ad } = await admin.from("ads").select("adset_id").eq("id", adId).maybeSingle();
    if (ad?.adset_id) {
      const { data: adset } = await admin.from("adsets").select("campaign_id").eq("id", ad.adset_id).maybeSingle();
      if (adset?.campaign_id) {
        const { data: campaign } = await admin.from("campaigns").select("ad_account_id").eq("id", adset.campaign_id).maybeSingle();
        accountId = campaign?.ad_account_id ?? null;
      }
    }
  }
  if (!accountId && formId) {
    const { data: lead } = await admin.from("meta_leads").select("ad_account_id").eq("form_id", formId).order("created_time", { ascending: false }).limit(1).maybeSingle();
    accountId = lead?.ad_account_id ?? null;
  }
  if (!accountId && formId) {
    const { data: form } = await admin.from("meta_lead_form_catalog").select("ad_account_id").eq("form_id", formId).maybeSingle();
    accountId = form?.ad_account_id ?? null;
  }
  if (!accountId && (adId || formId)) {
    // A first-ever lead can arrive before the scheduled catalog sync. Resolve
    // it against the provider-owned object using each connected account token;
    // this is bounded to the small set of accounts in the workspace.
    const { data: accounts } = await admin
      .from("ad_accounts")
      .select("id,user_id,workspace_id,access_token,account_id")
      .neq("connection_status", "disconnected")
      .limit(50);
    for (const candidate of accounts || []) {
      const object = await graphObject(adId || formId, adId ? "account_id" : "account_id,page_id", candidate);
      const providerAccountId = String(object?.account_id || "").replace(/^act_/, "");
      const savedAccountId = String(candidate.account_id || "").replace(/^act_/, "");
      if (providerAccountId && savedAccountId && providerAccountId === savedAccountId) {
        accountId = candidate.id;
        break;
      }
    }
  }
  if (!accountId) return null;
  const { data: account } = await admin.from("ad_accounts").select("id,user_id,workspace_id,access_token,account_id").eq("id", accountId).maybeSingle();
  return account ?? null;
}

async function fetchLead(leadId: string, account: MetaAccount) {
  const version = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
  const baseUrl = `https://graph.facebook.com/${version}/${encodeURIComponent(leadId)}`;
  const accessToken = `access_token=${encodeURIComponent(account.access_token)}`;
  const request = async (fields: string) => {
    const response = await fetch(`${baseUrl}?fields=${fields}&${accessToken}`);
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  // Meta rejects the complete field list when one optional delivery field is
  // unavailable for the app/version. Keep the immutable lead identity in a
  // separate request, then enrich names and delivery independently so one
  // rejected field never erases campaign, adset, ad or form attribution.
  const base = await request("id,created_time,ad_id,adset_id,campaign_id,form_id,field_data");
  if (!base.response.ok || base.payload?.error) {
    throw new Error(base.payload?.error?.message || `Meta lead HTTP ${base.response.status}`);
  }
  const optional = async (fields: string[]) => {
    const merged: Record<string, unknown> = {};
    for (const field of fields) {
      const part = await request(field);
      if (part.response.ok && !part.payload?.error && part.payload && typeof part.payload === "object") {
        Object.assign(merged, part.payload);
      }
    }
    return merged;
  };
  // Optional lead fields are not uniformly available across Graph API
  // versions. Request them independently so an unavailable placement field
  // cannot discard names, platform, or the immutable lead identity.
  const names = await optional(["ad_name", "adset_name", "campaign_name", "form_name"]);
  const delivery = await optional(["platform", "site_source_name", "publisher_platform", "placement", "platform_position", "is_organic"]);
  return enrichLeadReferences({
    ...base.payload,
    ...names,
    ...delivery,
  }, account);
}

async function graphObject(id: string | null | undefined, fields: string, account: MetaAccount) {
  if (!id) return null;
  const version = Deno.env.get("META_GRAPH_API_VERSION") || "v25.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(id)}?fields=${fields}&access_token=${encodeURIComponent(account.access_token)}`);
  const payload = await response.json().catch(() => ({}));
  return response.ok && !payload?.error ? payload : null;
}

async function enrichLeadReferences(lead: any, account: MetaAccount) {
  const next = { ...lead };
  // Lead webhooks are acknowledged immediately. These lookups are best-effort
  // snapshots of names; a permission/API-version failure must never discard
  // the lead or replace its immutable IDs.
  if (next.ad_id && (!next.ad_name || !next.adset_id || !next.campaign_id)) {
    const ad = await graphObject(String(next.ad_id), "name,adset_id,campaign_id", account);
    if (ad) {
      next.ad_name ??= ad.name ?? null;
      next.adset_id ??= ad.adset_id ?? null;
      next.campaign_id ??= ad.campaign_id ?? null;
    }
  }
  if (next.adset_id && (!next.adset_name || !next.campaign_id)) {
    const adset = await graphObject(String(next.adset_id), "name,campaign_id", account);
    if (adset) {
      next.adset_name ??= adset.name ?? null;
      next.campaign_id ??= adset.campaign_id ?? null;
    }
  }
  if (next.campaign_id && !next.campaign_name) {
    const campaign = await graphObject(String(next.campaign_id), "name", account);
    if (campaign) next.campaign_name = campaign.name ?? null;
  }
  if (next.form_id && !next.form_name) {
    const form = await graphObject(String(next.form_id), "name", account);
    if (form) next.form_name = form.name ?? null;
  }
  if (next.id && (!next.platform || !next.placement || typeof next.is_organic !== "boolean")) {
    const delivery: Record<string, unknown> = {};
    for (const field of [
      "platform",
      "site_source_name",
      "publisher_platform",
      "placement",
      "platform_position",
      "is_organic",
    ]) {
      const part = await graphObject(String(next.id), field, account);
      if (part && typeof part === "object") Object.assign(delivery, part);
    }
    if (delivery) {
      next.platform ??= delivery.platform ?? delivery.site_source_name ?? delivery.publisher_platform ?? null;
      next.placement ??= delivery.placement ?? delivery.platform_position ?? null;
      if (typeof next.is_organic !== "boolean" && typeof delivery.is_organic === "boolean") next.is_organic = delivery.is_organic;
    }
  }
  return next;
}

async function sha256(value: string) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function validSignature(raw: string, signature: string | null) {
  const secret = Deno.env.get("META_APP_SECRET");
  if (!secret) return false;
  if (!signature?.startsWith("sha256=")) return false;
  const encoded = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(encoded)) return false;
  const expected = new Uint8Array(encoded.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.verify("HMAC", key, expected, new TextEncoder().encode(raw));
}

async function dispatchLeadWorkflows(admin: any, workspaceId: string | null, lead: Record<string, unknown>, eventId: string) {
  if (!workspaceId) return [];
  const internalSecret = Deno.env.get("AUTOMATION_INTERNAL_SECRET") ?? "";
  if (internalSecret.length < 24) return [{ status: "skipped", reason: "AUTOMATION_INTERNAL_SECRET não configurado" }];
  const { data: automations, error } = await admin.from("growdash_automations").select("id,name,workflow_definition").eq("workspace_id", workspaceId).eq("status", "active");
  if (error) throw error;
  const results: Array<Record<string, unknown>> = [];
  for (const automation of automations || []) {
    const definition = automation.workflow_definition as { nodes?: Array<{ type?: string }> } | null;
    if (!definition?.nodes?.some((node) => node.type === "lead.trigger")) continue;
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/workflow-execute`, { method: "POST", headers: { "Content-Type": "application/json", "x-growdash-automation-secret": internalSecret }, body: JSON.stringify({ workflow_id: automation.id, mode: "webhook", input: { source: "meta_lead", meta_lead_id: lead.meta_lead_id, lead, event_id: eventId }, idempotency_key: `meta-lead:${automation.id}:${String(lead.meta_lead_id || eventId)}` }) });
    const payload = await response.json().catch(() => ({}));
    results.push({ automation_id: automation.id, automation_name: automation.name, status: response.ok ? payload?.status || "processed" : "failed", detail: payload?.error ?? null });
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  if (req.method === "GET") {
    const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
    if (!verifyToken || url.searchParams.get("hub.verify_token") !== verifyToken) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    return new Response(url.searchParams.get("hub.challenge") ?? "", { headers: { ...corsHeaders, "Content-Type": "text/plain" } });
  }
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-hub-signature-256")))) return json({ error: "Assinatura Meta inválida" }, 401);
  let admin: any = null;
  let syncRunId: string | null = null;
  try {
    const payload = JSON.parse(raw);
    admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const events: Array<{ provider_event_id: string; event_type: string; payload: any }> = [];
    for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
      const entryId = String(entry?.id ?? "unknown");
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        const value = change?.value ?? {};
        const eventType = String(change?.field ?? payload?.object ?? "meta_event");
        const providerEventId = String(value?.leadgen_id ?? value?.lead_id ?? value?.message_id ?? value?.id ?? `${entryId}:${eventType}:${JSON.stringify(value)}`);
        events.push({ provider_event_id: providerEventId, event_type: eventType, payload: { object: payload?.object ?? null, entry_id: entryId, value } });
      }
      if (Array.isArray(entry?.messaging)) for (const message of entry.messaging) {
        const providerEventId = String(message?.message?.mid ?? message?.timestamp ?? `${entryId}:messaging:${JSON.stringify(message)}`);
        events.push({ provider_event_id: providerEventId, event_type: "messaging", payload: { object: payload?.object ?? null, entry_id: entryId, message } });
      }
    }
    syncRunId = await startSyncExecution(admin, {
      provider: "meta",
      triggerSource: "meta_webhook",
      scopeKey: `webhook:${events.map((event) => event.provider_event_id).slice(0, 100).join(",") || "empty"}`,
      scope: {
        event_types: Array.from(new Set(events.map((event) => event.event_type))),
        event_count: events.length,
      },
    });
    let inserted = 0;
    let processed = 0;
    const errors: string[] = [];
    const rdTracking: unknown[] = [];
    const workflowTracking: unknown[] = [];
    for (const event of events) {
      const eventPayload = JSON.stringify(event.payload);
      const value = event.payload?.value ?? {};
      const leadId = event.event_type === "leadgen" ? String(value.leadgen_id ?? "") : "";
      const messagePayload = event.event_type === "messaging" ? event.payload?.message ?? {} : {};
      let messageAttribution = event.event_type === "messaging"
        ? extractMetaMessagingAttribution(messagePayload, String(event.payload?.object ?? ""))
        : null;
      const adId = value.ad_id ? String(value.ad_id) : messageAttribution?.ad_id ?? null;
      const formId = value.form_id ? String(value.form_id) : null;
      const account = await resolveAccount(admin, adId, formId);
      if (messageAttribution?.ad_id && account) {
        const enriched = await enrichLeadReferences({ id: messageAttribution.ad_id, ...messageAttribution }, account);
        messageAttribution = {
          ...messageAttribution,
          campaign_id: messageAttribution.campaign_id || enriched.campaign_id || null,
          adset_id: messageAttribution.adset_id || enriched.adset_id || null,
          ad_id: messageAttribution.ad_id || enriched.ad_id || null,
          campaign_name: messageAttribution.campaign_name || enriched.campaign_name || null,
          adset_name: messageAttribution.adset_name || enriched.adset_name || null,
          ad_name: messageAttribution.ad_name || enriched.ad_name || null,
        };
      }
      const { data, error } = await admin.from("meta_webhook_events").insert({
        workspace_id: account?.workspace_id ?? null,
        ad_account_id: account?.id ?? null,
        provider_event_id: event.provider_event_id,
        event_type: event.event_type,
        payload_sha256: await sha256(eventPayload),
        payload: event.payload,
        attempts: 1,
      }).select("id").maybeSingle();
      if (error && !/duplicate|unique/i.test(error.message)) throw error;
      if (!data) continue;
      inserted++;
      if (leadId && account) {
        try {
          const lead = await fetchLead(leadId, account);
          const fieldData = Array.isArray(lead.field_data) ? lead.field_data : [];
          const { error: leadError } = await admin.from("meta_leads").upsert({
            ad_account_id: account.id,
            campaign_id: lead.campaign_id ?? null,
            adset_id: lead.adset_id ?? null,
            ad_id: lead.ad_id ?? adId,
            form_id: lead.form_id ?? formId,
            meta_lead_id: String(lead.id ?? leadId),
            created_time: lead.created_time ?? new Date().toISOString(),
            field_data: fieldData,
            email: pickField(fieldData, ["email", "e-mail"]),
            // Native Meta forms often use custom labels such as
            // `digite_aqui_seu_whats` instead of the provider's canonical
            // `phone_number`. Include the common Portuguese variants so the
            // lead can be matched to its RD negotiation by phone when the
            // email is absent or formatted differently.
            phone: pickField(fieldData, ["phone_number", "phone", "telefone", "whatsapp", "whats", "celular", "mobile", "contato", "tel"]),
            full_name: pickField(fieldData, ["full_name", "name", "nome"]),
            lead_city: pickField(fieldData, ["city", "cidade"]),
            campaign_name: lead.campaign_name ?? null,
            adset_name: lead.adset_name ?? null,
            ad_name: lead.ad_name ?? null,
            form_name: lead.form_name ?? null,
            platform: lead.platform ?? lead.site_source_name ?? lead.publisher_platform ?? null,
            placement: lead.placement ?? lead.platform_position ?? null,
            is_organic: typeof lead.is_organic === "boolean" ? lead.is_organic : null,
            attribution_status: lead.campaign_id && lead.adset_id && lead.ad_id && lead.form_id && lead.campaign_name && lead.adset_name && lead.ad_name && lead.form_name && (lead.platform || lead.site_source_name || lead.publisher_platform) && (lead.placement || lead.platform_position) ? "captured" : "partial",
            raw: lead,
          }, { onConflict: "meta_lead_id" });
          if (leadError) throw leadError;
          processed++;
          // The webhook is the real-time handoff: after the Growdash mirror is
          // committed, attempt the governed write/readback on the matching RD
          // negotiation. If RD is not linked or writes are disabled, the lead
          // remains safely stored and the next RD webhook can retry it.
          rdTracking.push(await syncMetaLeadToRD(admin, String(lead.id ?? leadId)));
          workflowTracking.push(...await dispatchLeadWorkflows(admin, account.workspace_id, lead, event.provider_event_id));
          await admin.from("meta_webhook_events").update({ processed_at: new Date().toISOString(), error_message: null }).eq("id", data.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${event.provider_event_id}: ${message}`);
          await admin.from("meta_webhook_events").update({ error_message: message }).eq("id", data.id);
        }
      } else if (!leadId) {
        // Click-to-message webhooks do not expose a Meta Lead ID, but their
        // referral carries the originating ad. Preserve that attribution in
        // the CRM inbox; placement remains null unless Meta sends it.
        if (messageAttribution?.ad_id && account?.workspace_id) {
          const sender = String(messagePayload?.sender?.id || messagePayload?.from || "").trim();
          const externalId = `meta:${event.payload?.entry_id || "unknown"}:${sender || event.provider_event_id}`;
          const crmLead = await upsertMetaMessagingCrmLead(admin, {
            workspaceId: account.workspace_id,
            sourceProvider: "meta_messaging",
            externalId,
            fullName: messagePayload?.sender?.name || null,
            adAccountId: account.id,
            tracking: messageAttribution,
            payload: event.payload,
          });
          rdTracking.push(await syncCrmLeadToRD(admin, String(crmLead.id)));
        }
        await admin.from("meta_webhook_events").update({ processed_at: new Date().toISOString(), error_message: null }).eq("id", data.id);
      }
    }
    await finishSyncExecution(admin, syncRunId, {
      status: errors.length ? "partial" : "success",
      success: true,
      error: errors.length ? errors.join("; ") : null,
      warnings: errors,
      recordsRead: events.length,
      recordsUpserted: processed,
    });
    return json({ ok: true, sync_run_id: syncRunId, received: events.length, inserted, processed, duplicate: events.length - inserted, errors, rd_tracking: rdTracking, workflow_tracking: workflowTracking }, 200);
  } catch (error) {
    await finishSyncExecution(admin, syncRunId, { status: "failed", error: error instanceof Error ? error.message : String(error) });
    return json({ error: error instanceof Error ? error.message : "Falha ao processar webhook Meta" }, 500);
  }
});
