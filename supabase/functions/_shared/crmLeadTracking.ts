export type CrmLeadTracking = {
  meta_lead_id: string | null;
  form_id: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  form_name: string | null;
  platform: string | null;
  placement: string | null;
  is_organic: boolean | null;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function text(value: unknown, max = 500): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, max) : null;
}

function nested(source: JsonObject, path: string[]) {
  const value = path.reduce<unknown>((current, key) => {
    const object = asObject(current);
    return object ? object[key] : undefined;
  }, source);
  return text(value);
}

function first(sources: JsonObject[], paths: string[]) {
  for (const source of sources) {
    for (const path of paths) {
      const value = nested(source, path.split("."));
      if (value) return value;
    }
  }
  return null;
}

function booleanValue(sources: JsonObject[], paths: string[]) {
  for (const source of sources) {
    for (const path of paths) {
      const value = path.split(".").reduce<unknown>((current, key) => {
        const object = asObject(current);
        return object ? object[key] : undefined;
      }, source);
      if (typeof value === "boolean") return value;
      if (typeof value === "string" && /^(true|false)$/i.test(value.trim())) return value.trim().toLowerCase() === "true";
    }
  }
  return null;
}

/**
 * Canonical tracking contract accepted by the CRM intake webhook.
 * Sources may send fields at the root or under meta/tracking/facebook/ads.
 */
export function extractCrmLeadTracking(payload: JsonObject): CrmLeadTracking {
  const sources = [
    payload,
    asObject(payload.meta),
    asObject(payload.tracking),
    asObject(payload.facebook),
    asObject(payload.ads),
    asObject(payload.attribution),
  ].filter((source): source is JsonObject => Boolean(source));
  return {
    meta_lead_id: first(sources, ["meta_lead_id", "lead_id", "meta.lead_id"]),
    form_id: first(sources, ["form_id", "meta_form_id", "form.id", "meta.form_id"]),
    campaign_id: first(sources, ["campaign_id", "meta_campaign_id", "campaign.id", "meta.campaign_id"]),
    adset_id: first(sources, ["adset_id", "ad_set_id", "meta_adset_id", "adset.id", "ad_set.id", "meta.adset_id"]),
    ad_id: first(sources, ["ad_id", "meta_ad_id", "ad.id", "meta.ad_id"]),
    campaign_name: first(sources, ["campaign_name", "meta_campaign_name", "campaign.name", "meta.campaign_name"]),
    adset_name: first(sources, ["adset_name", "ad_set_name", "meta_adset_name", "adset.name", "ad_set.name", "meta.adset_name"]),
    ad_name: first(sources, ["ad_name", "meta_ad_name", "ad.name", "meta.ad_name"]),
    form_name: first(sources, ["form_name", "meta_form_name", "form.name", "meta.form_name"]),
    platform: first(sources, ["platform", "publisher_platform", "site_source_name", "meta_platform", "meta.platform"]),
    placement: first(sources, ["placement", "platform_position", "meta_placement", "meta.placement"]),
    is_organic: booleanValue(sources, ["is_organic", "meta_is_organic", "meta.is_organic"]),
  };
}
