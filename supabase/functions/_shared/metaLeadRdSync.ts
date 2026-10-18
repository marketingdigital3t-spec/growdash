import { executeRDWrite } from "./rdWrite.ts";

type AdminClient = any;

type MetaLead = {
  meta_lead_id: string;
  ad_account_id: string;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  form_id: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  form_name: string | null;
  platform: string | null;
  placement: string | null;
  is_organic: boolean | null;
  email: string | null;
  phone: string | null;
  created_time: string;
  raw: Record<string, unknown> | null;
};

type RdDeal = {
  id: string;
  user_id: string;
  rd_connection_id: string | null;
  rd_deal_id: string;
  ad_account_id: string;
  contact_email: string | null;
  contact_phone: string | null;
  lead_created_at: string | null;
  stage_updated_at: string | null;
  closed_at: string | null;
  raw: Record<string, any> | null;
};

type TrackingResult = {
  status: "written" | "skipped" | "partial" | "failed";
  rd_deal_id?: string;
  reason?: string;
  note?: "written" | "skipped";
  custom_fields?: "written" | "skipped";
  verified?: boolean;
  error?: string;
};

const TRACKING_FIELDS = [
  { key: "campaign_name", label: "Campanha", aliases: ["campanha", "campaign", "campaign_name", "nome campanha", "nome da campanha"] },
  { key: "adset_name", label: "Conjunto", aliases: ["conjunto", "adset", "adset_name", "nome conjunto", "nome do conjunto"] },
  { key: "ad_name", label: "Anúncio", aliases: ["anuncio", "anúncio", "ad", "ad_name", "nome anuncio", "nome anúncio"] },
  { key: "form_name", label: "Formulário", aliases: ["formulario", "formulário", "form", "form_name", "nome formulario", "nome formulário"] },
  { key: "platform", label: "Plataforma", aliases: ["plataforma", "platform", "publisher_platform", "site_source_name", "origem plataforma"] },
  { key: "placement", label: "Posicionamento", aliases: ["posicionamento", "placement", "platform_position"] },
] as const;

function clean(value: unknown): string | null {
  const text = value == null ? "" : String(value).trim();
  return text || null;
}

function norm(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeEmail(value: unknown): string | null {
  const email = clean(value)?.toLowerCase() || null;
  return email && email.includes("@") ? email : null;
}

function normalizePhone(value: unknown): string | null {
  const phone = clean(value)?.replace(/\D/g, "") || "";
  return phone || null;
}

function dateOf(value: unknown): number | null {
  if (!value) return null;
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function leadHasCompleteTracking(lead: MetaLead): boolean {
  return Boolean(lead.campaign_id && lead.adset_id && lead.ad_id && lead.form_id)
    && TRACKING_FIELDS.every((field) => clean(lead[field.key]));
}

function trackingFingerprint(lead: MetaLead): string {
  return [
    `campaign_id=${clean(lead.campaign_id) || ""}`,
    `adset_id=${clean(lead.adset_id) || ""}`,
    `ad_id=${clean(lead.ad_id) || ""}`,
    `form_id=${clean(lead.form_id) || ""}`,
    ...TRACKING_FIELDS.map((field) => `${field.key}=${clean(lead[field.key]) || ""}`),
  ].join("|");
}

async function stableUuid(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function fieldLabel(field: any): string {
  return String(field?.custom_field?.label || field?.label || field?.custom_field_id?.label || field?.name || "").trim();
}

function fieldValue(field: any): string | null {
  const value = field?.value ?? field?.values ?? null;
  if (Array.isArray(value)) return clean(value[0]);
  if (value && typeof value === "object") return clean(value.label ?? value.value);
  return clean(value);
}

function customFieldPatch(raw: Record<string, any> | null, configs: any[], lead: MetaLead) {
  const source = raw?.deal_custom_fields;
  if (!Array.isArray(source) || source.length === 0) return null;
  let changed = false;
  const next = source.map((field: any) => {
    const label = norm(fieldLabel(field));
    const config = configs.find((item) => {
      const aliases = [item?.rd_field_label, ...(item?.rd_field_aliases || [])].filter(Boolean);
      return aliases.some((alias: string) => norm(alias) === label);
    });
    const target = TRACKING_FIELDS.find((item) => {
      const aliases = config
        ? [config.rd_field_label, ...(config.rd_field_aliases || [])]
        : item.aliases;
      return aliases.some((alias: string) => norm(alias) === label);
    });
    if (!target) return field;
    const value = clean(lead[target.key]);
    if (!value || fieldValue(field) === value) return field;
    changed = true;
    const updated = { ...field };
    if (Array.isArray(field?.values)) updated.values = [value];
    else updated.value = value;
    return updated;
  });
  return changed ? next : null;
}

function noteBody(lead: MetaLead): string {
  const lines = [
    "Rastreamento Meta Ads — Growdash",
    `Lead Meta: ${lead.meta_lead_id}`,
    `Campanha: ${clean(lead.campaign_name) || "Não informado"}`,
    `Conjunto: ${clean(lead.adset_name) || "Não informado"}`,
    `Anúncio: ${clean(lead.ad_name) || "Não informado"}`,
    `Formulário: ${clean(lead.form_name) || "Não informado"}`,
    `Plataforma: ${clean(lead.platform) || "Não informado"}`,
    `Posicionamento: ${clean(lead.placement) || "Não informado"}`,
  ];
  return lines.join("\n");
}

async function providerDealReadback(token: string, rdDealId: string, expectedFields: any[] | null) {
  const response = await fetch(`https://crm.rdstation.com/api/v1/deals/${encodeURIComponent(rdDealId)}?token=${encodeURIComponent(token)}`);
  if (!response.ok) return false;
  if (!expectedFields?.length) return true;
  const payload = await response.json().catch(() => ({}));
  const fields = Array.isArray(payload?.deal_custom_fields)
    ? payload.deal_custom_fields
    : Array.isArray(payload?.deal?.deal_custom_fields)
      ? payload.deal.deal_custom_fields
      : Array.isArray(payload?.custom_fields)
        ? payload.custom_fields
        : [];
  return expectedFields.every((expected: any) => {
    const label = fieldLabel(expected);
    const current = fields.find((item: any) => norm(fieldLabel(item)) === norm(label));
    return current && fieldValue(current) === fieldValue(expected);
  });
}

function dealMatchesLead(deal: RdDeal, lead: MetaLead): { match: boolean; score: number } {
  const emailMatches = !!normalizeEmail(lead.email) && normalizeEmail(lead.email) === normalizeEmail(deal.contact_email);
  const phoneMatches = !!normalizePhone(lead.phone) && normalizePhone(lead.phone) === normalizePhone(deal.contact_phone);
  if (!emailMatches && !phoneMatches) return { match: false, score: 0 };
  const leadAt = dateOf(lead.created_time);
  const dealAt = dateOf(deal.lead_created_at || deal.stage_updated_at || deal.closed_at);
  const distance = leadAt != null && dealAt != null ? Math.abs(leadAt - dealAt) : 0;
  if (distance > 180 * 24 * 60 * 60 * 1000) return { match: false, score: 0 };
  return { match: true, score: (emailMatches && phoneMatches ? 30 : emailMatches ? 20 : 10) - distance / 1e12 };
}

async function writeAttribution(admin: AdminClient, lead: MetaLead, deal: RdDeal): Promise<TrackingResult> {
  if (!deal.rd_connection_id) return { status: "skipped", rd_deal_id: deal.rd_deal_id, reason: "rd_connection_missing" };
  const trackingComplete = leadHasCompleteTracking(lead);

  const { data: connection, error: connectionError } = await admin
    .from("rd_account_connections")
    .select("id,user_id,api_token,status,write_enabled")
    .eq("id", deal.rd_connection_id)
    .maybeSingle();
  if (connectionError) return { status: "failed", rd_deal_id: deal.rd_deal_id, error: connectionError.message };
  if (!connection?.write_enabled) return { status: "skipped", rd_deal_id: deal.rd_deal_id, reason: "rd_write_disabled" };
  if (connection.status !== "connected" || !connection.api_token) return { status: "skipped", rd_deal_id: deal.rd_deal_id, reason: "rd_connection_not_ready" };

  const { data: configs } = await admin
    .from("rd_field_configs")
    .select("rd_field_label,rd_field_aliases,rd_source")
    .eq("ad_account_id", lead.ad_account_id)
    .eq("rd_source", "deal");
  const patchedFields = customFieldPatch(deal.raw, configs || [], lead);
  const fingerprint = trackingFingerprint(lead);
  const noteCorrelation = await stableUuid(`meta-rd-note:${lead.meta_lead_id}:${deal.rd_deal_id}:${fingerprint}`);
  const result: TrackingResult = {
    status: trackingComplete ? "written" : "partial",
    rd_deal_id: deal.rd_deal_id,
    note: "skipped",
    custom_fields: "skipped",
    reason: trackingComplete ? undefined : "meta_tracking_incomplete",
  };

  try {
    const noteWrite = await executeRDWrite({
      admin,
      userId: connection.user_id,
      connectionId: connection.id,
      action: "add_note",
      target: { rd_deal_id: deal.rd_deal_id, meta_lead_id: lead.meta_lead_id },
      before: {},
      after: { body: noteBody(lead), fingerprint },
      correlationId: noteCorrelation,
      method: "POST",
      path: "/activities",
      body: { deal_id: deal.rd_deal_id, type: "note", description: noteBody(lead) },
    });
    result.note = noteWrite.skipped ? "skipped" : "written";

    if (patchedFields) {
      const fieldCorrelation = await stableUuid(`meta-rd-fields:${lead.meta_lead_id}:${deal.rd_deal_id}:${fingerprint}`);
      const fieldWrite = await executeRDWrite({
        admin,
        userId: connection.user_id,
        connectionId: connection.id,
        action: "update_deal",
        target: { rd_deal_id: deal.rd_deal_id, meta_lead_id: lead.meta_lead_id },
        before: { deal_custom_fields: deal.raw?.deal_custom_fields || [] },
        after: { deal_custom_fields: patchedFields, fingerprint },
        correlationId: fieldCorrelation,
        method: "PUT",
        path: `/deals/${encodeURIComponent(deal.rd_deal_id)}`,
        body: { deal: { deal_custom_fields: patchedFields } },
      });
      result.custom_fields = fieldWrite.skipped ? "skipped" : "written";
    }

    result.verified = await providerDealReadback(String(connection.api_token), deal.rd_deal_id, patchedFields);
    if (!result.verified) {
      result.status = "failed";
      result.error = "RD readback did not confirm the tracking update";
    }
    return result;
  } catch (error) {
    return { status: "failed", rd_deal_id: deal.rd_deal_id, error: error instanceof Error ? error.message : String(error) };
  }
}

async function loadLead(admin: AdminClient, metaLeadId: string): Promise<MetaLead | null> {
  const { data, error } = await admin
    .from("meta_leads")
    .select("meta_lead_id,ad_account_id,campaign_id,adset_id,ad_id,form_id,campaign_name,adset_name,ad_name,form_name,platform,placement,is_organic,email,phone,created_time,raw")
    .eq("meta_lead_id", metaLeadId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function findDealsForLead(admin: AdminClient, lead: MetaLead): Promise<RdDeal[]> {
  const candidates: RdDeal[] = [];
  const email = normalizeEmail(lead.email);
  const phone = normalizePhone(lead.phone);
  if (email) {
    const { data, error } = await admin
      .from("rd_deals")
      .select("id,user_id,rd_connection_id,rd_deal_id,ad_account_id,contact_email,contact_phone,lead_created_at,stage_updated_at,closed_at,raw")
      .eq("ad_account_id", lead.ad_account_id)
      .ilike("contact_email", email)
      .limit(100);
    if (error) throw error;
    candidates.push(...(data || []));
  }
  if (phone) {
    const { data, error } = await admin
      .from("rd_deals")
      .select("id,user_id,rd_connection_id,rd_deal_id,ad_account_id,contact_email,contact_phone,lead_created_at,stage_updated_at,closed_at,raw")
      .eq("ad_account_id", lead.ad_account_id)
      .eq("contact_phone", phone)
      .limit(100);
    if (error) throw error;
    candidates.push(...(data || []));
    if (!(data || []).length) {
      // RD commonly returns Brazilian phones with +55, spaces or punctuation.
      // The expression index protects SQL-side joins, but PostgREST cannot
      // filter an expression directly, so only use this bounded fallback when
      // the canonical value lookup found nothing.
      const { data: formatted, error: formattedError } = await admin
        .from("rd_deals")
        .select("id,user_id,rd_connection_id,rd_deal_id,ad_account_id,contact_email,contact_phone,lead_created_at,stage_updated_at,closed_at,raw")
        .eq("ad_account_id", lead.ad_account_id)
        .not("contact_phone", "is", null)
        .order("lead_created_at", { ascending: false })
        .limit(5000);
      if (formattedError) throw formattedError;
      candidates.push(...(formatted || []).filter((deal: RdDeal) => normalizePhone(deal.contact_phone) === phone));
    }
  }
  const unique = [...new Map(candidates.map((deal) => [deal.rd_deal_id, deal])).values()];
  return unique
    .map((deal: RdDeal) => ({ deal, match: dealMatchesLead(deal, lead) }))
    .filter((item: any) => item.match.match)
    .sort((a: any, b: any) => b.match.score - a.match.score)
    .map((item: any) => item.deal);
}

async function findLeadForDeal(admin: AdminClient, deal: RdDeal): Promise<MetaLead | null> {
  const candidates: MetaLead[] = [];
  const email = normalizeEmail(deal.contact_email);
  const phone = normalizePhone(deal.contact_phone);
  if (email) {
    const { data, error } = await admin
      .from("meta_leads")
      .select("meta_lead_id,ad_account_id,campaign_id,adset_id,ad_id,form_id,campaign_name,adset_name,ad_name,form_name,platform,placement,is_organic,email,phone,created_time,raw")
      .eq("ad_account_id", deal.ad_account_id)
      .ilike("email", email)
      .limit(100);
    if (error) throw error;
    candidates.push(...(data || []));
  }
  if (phone) {
    const { data, error } = await admin
      .from("meta_leads")
      .select("meta_lead_id,ad_account_id,campaign_id,adset_id,ad_id,form_id,campaign_name,adset_name,ad_name,form_name,platform,placement,is_organic,email,phone,created_time,raw")
      .eq("ad_account_id", deal.ad_account_id)
      .eq("phone", phone)
      .limit(100);
    if (error) throw error;
    candidates.push(...(data || []));
    if (!(data || []).length) {
      const { data: formatted, error: formattedError } = await admin
        .from("meta_leads")
        .select("meta_lead_id,ad_account_id,campaign_id,adset_id,ad_id,form_id,campaign_name,adset_name,ad_name,form_name,platform,placement,is_organic,email,phone,created_time,raw")
        .eq("ad_account_id", deal.ad_account_id)
        .not("phone", "is", null)
        .order("created_time", { ascending: false })
        .limit(5000);
      if (formattedError) throw formattedError;
      candidates.push(...(formatted || []).filter((lead: MetaLead) => normalizePhone(lead.phone) === phone));
    }
  }
  return [...new Map(candidates.map((lead) => [lead.meta_lead_id, lead])).values()]
    .map((lead: MetaLead) => ({ lead, match: dealMatchesLead(deal, lead) }))
    .filter((item: any) => item.match.match)
    .sort((a: any, b: any) => b.match.score - a.match.score)
    .map((item: any) => item.lead)[0] || null;
}

export async function syncMetaLeadToRD(admin: AdminClient, metaLeadId: string) {
  try {
    const lead = await loadLead(admin, metaLeadId);
    if (!lead) return { status: "skipped", reason: "meta_lead_not_found" };
    const deals = await findDealsForLead(admin, lead);
    if (!deals.length) return { status: "skipped", reason: "rd_deal_not_found" };
    const results = [];
    for (const deal of deals.slice(0, 3)) results.push(await writeAttribution(admin, lead, deal));
    return { status: results.some((item) => item.status === "written") ? "written" : results[0]?.status || "skipped", results };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}

export async function syncRDDealToMeta(admin: AdminClient, connectionId: string, rdDealId: string) {
  try {
    const { data: deal, error } = await admin
      .from("rd_deals")
      .select("id,user_id,rd_connection_id,rd_deal_id,ad_account_id,contact_email,contact_phone,lead_created_at,stage_updated_at,closed_at,raw")
      .eq("rd_connection_id", connectionId)
      .eq("rd_deal_id", rdDealId)
      .maybeSingle();
    if (error) throw error;
    if (!deal) return { status: "skipped", reason: "rd_deal_not_found" };
    const lead = await findLeadForDeal(admin, deal as RdDeal);
    if (!lead) return { status: "skipped", reason: "meta_lead_not_found" };
    return await writeAttribution(admin, lead, deal as RdDeal);
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}
