type JsonObject = Record<string, unknown>;

export type MetaMessagingAttribution = {
  ad_id: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  form_id: null;
  form_name: null;
  platform: string | null;
  placement: string | null;
  is_organic: boolean | null;
  referral: JsonObject | null;
};

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function text(value: unknown, max = 500): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, max) : null;
}

function nested(source: JsonObject | null, path: string[]) {
  let current: unknown = source;
  for (const key of path) {
    const currentObject = object(current);
    if (!currentObject) return null;
    current = currentObject[key];
  }
  return text(current);
}

function first(sources: Array<JsonObject | null>, paths: string[]) {
  for (const source of sources) {
    for (const path of paths) {
      const value = nested(source, path.split("."));
      if (value) return value;
    }
  }
  return null;
}

/**
 * Click-to-message referrals are nested differently between Messenger,
 * Instagram and WhatsApp. This keeps only provider facts and never infers a
 * placement from the campaign objective or the channel name.
 */
export function extractMetaMessagingAttribution(event: JsonObject, objectName?: string): MetaMessagingAttribution {
  const message = object(event.message) || event;
  const context = object(message.context);
  const referral = object(message.referral) || object(context?.referral);
  const adsContext = object(referral?.ads_context_data);
  const sources = [referral, adsContext, message, event];
  const adId = first(sources, ["ad_id", "source_id", "ads_context_data.ad_id"]);
  const platform = first(sources, ["platform", "publisher_platform", "site_source_name"])
    || ((objectName || "").toLowerCase().includes("instagram") ? "instagram" : objectName === "page" ? "messenger" : objectName === "whatsapp" ? "whatsapp" : null);
  return {
    ad_id: adId,
    campaign_id: first(sources, ["campaign_id", "ads_context_data.campaign_id"]),
    adset_id: first(sources, ["adset_id", "ad_set_id", "ads_context_data.adset_id", "ads_context_data.ad_set_id"]),
    campaign_name: first(sources, ["campaign_name", "ads_context_data.campaign_name"]),
    adset_name: first(sources, ["adset_name", "ads_context_data.adset_name"]),
    ad_name: first(sources, ["ad_name", "ad_title", "ads_context_data.ad_name", "ads_context_data.ad_title"]),
    form_id: null,
    form_name: null,
    platform,
    placement: first(sources, ["placement", "platform_position", "ads_context_data.placement"]),
    is_organic: adId ? false : null,
    referral,
  };
}

export async function upsertMetaMessagingCrmLead(admin: any, input: {
  workspaceId: string;
  sourceProvider: string;
  externalId: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  adAccountId?: string | null;
  tracking: MetaMessagingAttribution;
  payload: JsonObject;
  receivedAt?: string;
}) {
  const receivedAt = input.receivedAt || new Date().toISOString();
  const base = {
    workspace_id: input.workspaceId,
    source_provider: input.sourceProvider,
    external_id: input.externalId,
  };
  const { data: existing, error: existingError } = await admin.from("crm_leads")
    .select("id,full_name,email,phone,ad_account_id,campaign_id,adset_id,ad_id,campaign_name,adset_name,ad_name,form_id,form_name,platform,placement,is_organic,payload")
    .match(base)
    .maybeSingle();
  if (existingError) throw existingError;
  const tracking = input.tracking;
  const values = {
    ...base,
    full_name: input.fullName || existing?.full_name || null,
    email: input.email || existing?.email || null,
    phone: input.phone || existing?.phone || null,
    ad_account_id: input.adAccountId || existing?.ad_account_id || null,
    campaign_id: tracking.campaign_id || existing?.campaign_id || null,
    adset_id: tracking.adset_id || existing?.adset_id || null,
    ad_id: tracking.ad_id || existing?.ad_id || null,
    campaign_name: tracking.campaign_name || existing?.campaign_name || null,
    adset_name: tracking.adset_name || existing?.adset_name || null,
    ad_name: tracking.ad_name || existing?.ad_name || null,
    form_id: tracking.form_id || existing?.form_id || null,
    form_name: tracking.form_name || existing?.form_name || null,
    platform: tracking.platform || existing?.platform || null,
    placement: tracking.placement || existing?.placement || null,
    is_organic: tracking.is_organic ?? existing?.is_organic ?? null,
    payload: { ...(object(existing?.payload) || {}), messaging: input.payload },
    last_received_at: receivedAt,
    updated_at: receivedAt,
  };
  const query = existing
    ? admin.from("crm_leads").update(values).eq("id", existing.id)
    : admin.from("crm_leads").insert({ ...values, first_received_at: receivedAt });
  const { data, error } = await query.select("id,workspace_id,source_provider,external_id,last_received_at").single();
  if (error) throw error;
  return data;
}
