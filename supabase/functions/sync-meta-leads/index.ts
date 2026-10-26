import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { syncMetaLeadToRD } from "../_shared/metaLeadRdSync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GRAPH = `https://graph.facebook.com/${
  Deno.env.get("META_GRAPH_API_VERSION") || "v25.0"
}`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type LeadRow = {
  ad_account_id: string;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  form_id: string | null;
  meta_lead_id: string;
  created_time: string;
  field_data: any;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  lead_state: string | null;
  lead_state_source: string | null;
  lead_city: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  form_name: string | null;
  platform: string | null;
  placement: string | null;
  is_organic: boolean | null;
  attribution_status: "captured" | "partial";
  raw: any;
};

const STATE_KEYS = ["state", "estado", "uf", "província", "provincia"];
const CITY_KEYS = ["city", "cidade", "municipio", "município"];
const EMAIL_KEYS = ["email", "e-mail", "e_mail"];
const PHONE_KEYS = [
  "phone_number",
  "phone",
  "telefone",
  "whatsapp",
  "whats",
  "celular",
  "mobile",
  "contato",
  "tel",
  "número",
];
const NAME_KEYS = ["full_name", "name", "nome", "nome completo"];

const NAME_TO_UF: Record<string, string> = {
  "acre": "AC",
  "alagoas": "AL",
  "amapa": "AP",
  "amazonas": "AM",
  "bahia": "BA",
  "ceara": "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  "goias": "GO",
  "maranhao": "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  "para": "PA",
  "paraiba": "PB",
  "parana": "PR",
  "pernambuco": "PE",
  "piaui": "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  "rondonia": "RO",
  "roraima": "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  "sergipe": "SE",
  "tocantins": "TO",
};

const DDD_TO_UF: Record<string, string> = {
  "11": "SP",
  "12": "SP",
  "13": "SP",
  "14": "SP",
  "15": "SP",
  "16": "SP",
  "17": "SP",
  "18": "SP",
  "19": "SP",
  "21": "RJ",
  "22": "RJ",
  "24": "RJ",
  "27": "ES",
  "28": "ES",
  "31": "MG",
  "32": "MG",
  "33": "MG",
  "34": "MG",
  "35": "MG",
  "37": "MG",
  "38": "MG",
  "41": "PR",
  "42": "PR",
  "43": "PR",
  "44": "PR",
  "45": "PR",
  "46": "PR",
  "47": "SC",
  "48": "SC",
  "49": "SC",
  "51": "RS",
  "53": "RS",
  "54": "RS",
  "55": "RS",
  "61": "DF",
  "62": "GO",
  "64": "GO",
  "63": "TO",
  "65": "MT",
  "66": "MT",
  "67": "MS",
  "68": "AC",
  "69": "RO",
  "71": "BA",
  "73": "BA",
  "74": "BA",
  "75": "BA",
  "77": "BA",
  "79": "SE",
  "81": "PE",
  "87": "PE",
  "82": "AL",
  "83": "PB",
  "84": "RN",
  "85": "CE",
  "88": "CE",
  "86": "PI",
  "89": "PI",
  "91": "PA",
  "93": "PA",
  "94": "PA",
  "92": "AM",
  "97": "AM",
  "95": "RR",
  "96": "AP",
  "98": "MA",
  "99": "MA",
};
function dddToUF(phone: string | null): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length < 10) return null;
  return DDD_TO_UF[d.slice(0, 2)] || null;
}

function normalizeUF(s: string | null): string | null {
  if (!s) return null;
  const v = s.trim();
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  const byName = NAME_TO_UF[norm(v)];
  if (byName) return byName;
  return null;
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function pickField(fd: any[], wants: string[]): string | null {
  if (!Array.isArray(fd)) return null;
  for (const f of fd) {
    const name = norm(String(f?.name ?? ""));
    if (wants.some((w) => name === norm(w) || name.includes(norm(w)))) {
      const v = Array.isArray(f?.values) ? f.values[0] : f?.values;
      if (v) return String(v);
    }
  }
  return null;
}

function usableAttributionText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || /^\{\{[^{}]+\}\}$/.test(text)) return null;
  return text;
}

async function hydrateMissingAttribution(
  rows: LeadRow[],
  token: string,
  formNames: Map<string, string>,
  adNames: Map<string, string>,
  adsetNames: Map<string, string>,
  campaignNames: Map<string, string>,
) {
  const cache = new Map<string, any>();
  const getObject = async (id: string, fields: string) => {
    const key = `${id}:${fields}`;
    if (cache.has(key)) return cache.get(key);
    const response = await fetch(`${GRAPH}/${encodeURIComponent(id)}?fields=${fields}&access_token=${encodeURIComponent(token)}`);
    const payload = await response.json().catch(() => ({}));
    const value = response.ok && !payload?.error ? payload : null;
    cache.set(key, value);
    return value;
  };
  const deliveryCache = new Map<string, any>();
  const getLeadDelivery = async (id: string) => {
    if (deliveryCache.has(id)) return deliveryCache.get(id);
    // Meta may reject `placement`/`platform_position` for a lead while still
    // exposing `platform` and `is_organic`. Keep each optional field isolated
    // so one unsupported field never removes the delivery facts that are
    // available for the lead.
    const value: Record<string, unknown> = {};
    for (const field of [
      "platform",
      "site_source_name",
      "publisher_platform",
      "placement",
      "platform_position",
      "is_organic",
    ]) {
      const part = await getObject(id, field);
      if (part && typeof part === "object") Object.assign(value, part);
    }
    deliveryCache.set(id, value);
    return value;
  };
  const runBatches = async (ids: string[], task: (id: string) => Promise<void>) => {
    for (let i = 0; i < ids.length; i += 8) {
      await Promise.all(ids.slice(i, i + 8).map(task));
    }
  };
  for (const row of rows) {
    const raw = row.raw && typeof row.raw === "object" ? row.raw as any : {};
    row.campaign_name ||= usableAttributionText(raw.campaign_name || raw.meta_campaign_name);
    row.adset_name ||= usableAttributionText(raw.adset_name || raw.meta_adset_name);
    row.ad_name ||= usableAttributionText(raw.ad_name || raw.meta_ad_name);
    row.form_name ||= usableAttributionText(raw.form_name || raw.meta_form_name);
    row.platform ||= usableAttributionText(raw.platform || raw.site_source_name || raw.publisher_platform);
    row.placement ||= usableAttributionText(raw.placement || raw.platform_position);
    row.campaign_name = usableAttributionText(row.campaign_name);
    row.adset_name = usableAttributionText(row.adset_name);
    row.ad_name = usableAttributionText(row.ad_name);
    row.form_name = usableAttributionText(row.form_name);
    row.platform = usableAttributionText(row.platform);
    row.placement = usableAttributionText(row.placement);
    if (row.meta_lead_id && (!row.platform || !row.placement || row.is_organic == null)) {
      // Some Graph API versions reject delivery fields when combined with the
      // lead identity fields. Retry them separately so an optional field never
      // removes the lead or its campaign hierarchy.
      const delivery = await getLeadDelivery(String(row.meta_lead_id));
      row.platform ||= usableAttributionText(delivery?.platform || delivery?.site_source_name || delivery?.publisher_platform);
      row.placement ||= usableAttributionText(delivery?.placement || delivery?.platform_position);
      if (row.is_organic == null && typeof delivery?.is_organic === "boolean") row.is_organic = delivery.is_organic;
    }
  }
  const adIds = [...new Set(rows.filter((row) => row.ad_id && !usableAttributionText(row.ad_name)).map((row) => String(row.ad_id)))];
  await runBatches(adIds, async (id) => {
    const ad = await getObject(id, "name,adset{id,name},campaign{id,name}");
    if (ad?.name) adNames.set(id, String(ad.name));
    if (ad?.adset?.id && ad?.adset?.name) adsetNames.set(String(ad.adset.id), String(ad.adset.name));
    if (ad?.campaign?.id && ad?.campaign?.name) campaignNames.set(String(ad.campaign.id), String(ad.campaign.name));
  });
  const adsetIds = [...new Set(rows.filter((row) => row.adset_id && !usableAttributionText(row.adset_name)).map((row) => String(row.adset_id)))];
  await runBatches(adsetIds, async (id) => {
    const adset = await getObject(id, "name,campaign{id,name}");
    if (adset?.name) adsetNames.set(id, String(adset.name));
    if (adset?.campaign?.id && adset?.campaign?.name) campaignNames.set(String(adset.campaign.id), String(adset.campaign.name));
  });
  const campaignIds = [...new Set(rows.filter((row) => row.campaign_id && !usableAttributionText(row.campaign_name)).map((row) => String(row.campaign_id)))];
  await runBatches(campaignIds, async (id) => {
    const campaign = await getObject(id, "name");
    if (campaign?.name) campaignNames.set(id, String(campaign.name));
  });
  const formIds = [...new Set(rows.filter((row) => row.form_id && !usableAttributionText(row.form_name)).map((row) => String(row.form_id)))];
  await runBatches(formIds, async (id) => {
    const form = await getObject(id, "name");
    if (form?.name) formNames.set(id, String(form.name));
  });
  for (const row of rows) {
    row.campaign_name ||= row.campaign_id ? campaignNames.get(String(row.campaign_id)) || null : null;
    row.adset_name ||= row.adset_id ? adsetNames.get(String(row.adset_id)) || null : null;
    row.ad_name ||= row.ad_id ? adNames.get(String(row.ad_id)) || null : null;
    row.form_name ||= row.form_id ? formNames.get(String(row.form_id)) || null : null;
    row.platform ||= usableAttributionText((row.raw as any)?.site_source_name || (row.raw as any)?.publisher_platform);
    row.placement ||= usableAttributionText((row.raw as any)?.platform_position || (row.raw as any)?.placement);
    row.attribution_status = row.campaign_id && row.adset_id && row.ad_id && row.form_id && row.campaign_name && row.adset_name && row.ad_name && row.form_name && row.platform && row.placement
      ? "captured"
      : "partial";
  }
}

async function fetchAll(
  url: string,
  maxPages = Number.POSITIVE_INFINITY,
): Promise<{ data: any[]; pages: number; lastCursor?: string; repeatedCursor?: boolean; error?: string }> {
  const all: any[] = [];
  let next: string | undefined = url;
  let pages = 0;
  const seen = new Set<string>();
  let lastCursor: string | undefined;
  while (next && pages < maxPages) {
    if (seen.has(next)) {
      return { data: all, pages, lastCursor, repeatedCursor: true, error: "A Meta repetiu o cursor de paginação; sincronização interrompida para evitar duplicação." };
    }
    seen.add(next);
    const r: Response = await fetch(next);
    const json: any = await r.json();
    if (!r.ok) {
      return {
        data: all,
        pages,
        lastCursor,
        error: json?.error?.message || `Meta respondeu HTTP ${r.status}`,
      };
    }
    if (json.error) {
      return { data: all, pages, lastCursor, error: json.error.message || String(json.error) };
    }
    if (Array.isArray(json.data)) all.push(...json.data);
    next = json.paging?.next;
    lastCursor = next;
    pages++;
  }
  return { data: all, pages, lastCursor };
}

function timezoneOffsetMinutes(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" }).formatToParts(new Date(instant));
  const value = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = value.match(/GMT([+-])(\d{2})(?::?(\d{2}))?/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return match[1] === "-" ? -minutes : minutes;
}

function parseExactDateRange(body: Record<string, unknown>): {
  startDate: string;
  endDate: string;
  startEpoch: number;
  endExclusiveEpoch: number;
} | null {
  const startDate = String(body.startDate ?? body.start_date ?? "").trim();
  const endDate = String(body.endDate ?? body.end_date ?? "").trim();
  if (!startDate && !endDate) return null;
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    throw new Error(
      "startDate e endDate devem ser informados juntos no formato YYYY-MM-DD",
    );
  }
  if (startDate > endDate) {
    throw new Error("startDate não pode ser posterior a endDate");
  }

  const timezone = typeof body.timezone === "string" && body.timezone.trim()
    ? body.timezone.trim()
    : "America/Sao_Paulo";
  const startUtc = Date.parse(`${startDate}T00:00:00Z`);
  const endUtc = Date.parse(`${endDate}T00:00:00Z`);
  const startMs = startUtc - timezoneOffsetMinutes(startUtc, timezone) * 60_000;
  const endMs = endUtc - timezoneOffsetMinutes(endUtc, timezone) * 60_000 + 86400000;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error("Intervalo de datas inválido");
  }

  return {
    startDate,
    endDate,
    startEpoch: Math.floor(startMs / 1000),
    endExclusiveEpoch: Math.floor(endMs / 1000),
  };
}

function parseRecentTimestampRange(body: Record<string, unknown>): {
  startEpoch: number;
  endExclusiveEpoch: number;
} | null {
  const start = Date.parse(String(body.recentStartAt ?? body.recent_start_at ?? ""));
  const end = Date.parse(String(body.recentEndAt ?? body.recent_end_at ?? ""));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const maxWindow = 24 * 60 * 60 * 1000;
  if (end - start > maxWindow) return null;
  return { startEpoch: Math.floor(start / 1000), endExclusiveEpoch: Math.floor(end / 1000) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isService = bearer.length > 0 && bearer === SERVICE;

    let userId: string | null = null;
    if (!isService) {
      const sb = createClient(
        SUPABASE_URL,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          global: { headers: { Authorization: authHeader } },
        },
      );
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }
      userId = user.id;
    }

    const adAccountId: string | undefined = body.ad_account_id ||
      body.adAccountId;
    const adAccountIds = Array.isArray(body.ad_account_ids || body.adAccountIds)
      ? (body.ad_account_ids || body.adAccountIds).filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    const exactRange = parseExactDateRange(body);
    const recentRange = exactRange ? null : parseRecentTimestampRange(body);
    const permissionAudit = body?.permission_audit === true;
    const days: number = Math.max(1, Math.min(90, Number(body.days ?? 7)));
    const since = exactRange?.startEpoch ?? recentRange?.startEpoch ??
      Math.floor((Date.now() - days * 86400000) / 1000);

    // Explicitly disabled accounts must never be queried or treated as a
    // successful lead sync. They require an authorized reconnection first.
    let q = admin.from("ad_accounts").select(
      "id,name,account_id,access_token,user_id,connection_status",
    ).neq("connection_status", "disconnected");
    if (adAccountIds.length) q = q.in("id", adAccountIds);
    else if (adAccountId) q = q.eq("id", adAccountId);
    if (userId) q = q.eq("user_id", userId);
    const { data: accounts, error: accErr } = await q;
    if (accErr) throw accErr;

    let disconnectedQuery = admin.from("ad_accounts").select("id,name,account_id").eq("connection_status", "disconnected");
    if (adAccountIds.length) disconnectedQuery = disconnectedQuery.in("id", adAccountIds);
    else if (adAccountId) disconnectedQuery = disconnectedQuery.eq("id", adAccountId);
    if (userId) disconnectedQuery = disconnectedQuery.eq("user_id", userId);
    const { data: disconnectedAccounts, error: disconnectedError } = await disconnectedQuery;
    if (disconnectedError) throw disconnectedError;

    const accountResults: any[] = [];
    let totalUpserted = 0;
    let totalPages = 0;
    let lastCursor: string | null = null;
    const pageFormsByToken = new Map<string, Map<string, string[]>>();
    const pageIdsByFormByToken = new Map<string, Map<string, string>>();
    const pageSubscriptionWarningsByToken = new Map<string, string[]>();
    const appSubscriptionByToken = new Map<string, string | null>();
    const formNamesByToken = new Map<string, Map<string, string>>();
    const permissionsByToken = new Map<string, Set<string> | null>();

    async function inspectPermissions(token: string): Promise<Set<string> | null> {
      if (permissionsByToken.has(token)) return permissionsByToken.get(token) || null;
      try {
        const response = await fetch(
          `${GRAPH}/me/permissions?access_token=${encodeURIComponent(token)}`,
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.error || !Array.isArray(payload?.data)) {
          permissionsByToken.set(token, null);
          return null;
        }
        const granted = new Set<string>(
          payload.data
            .filter((item: any) => String(item?.status).toLowerCase() === "granted")
            .map((item: any) => String(item?.permission || ""))
            .filter(Boolean),
        );
        permissionsByToken.set(token, granted);
        return granted;
      } catch {
        permissionsByToken.set(token, null);
        return null;
      }
    }

    async function ensureAppPageWebhook(token: string): Promise<string | null> {
      if (appSubscriptionByToken.has(token)) return appSubscriptionByToken.get(token) || null;
      const appId = Deno.env.get("META_APP_ID")?.trim();
      const appSecret = Deno.env.get("META_APP_SECRET")?.trim();
      const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN")?.trim();
      if (!appId || !appSecret || !verifyToken) {
        const missing = [
          !appId && "META_APP_ID",
          !appSecret && "META_APP_SECRET",
          !verifyToken && "META_WEBHOOK_VERIFY_TOKEN",
        ].filter(Boolean).join(", ");
        const warning = `Assinatura global Meta não configurada (${missing}); o webhook da Growdash precisa ser habilitado no app.`;
        appSubscriptionByToken.set(token, warning);
        return warning;
      }
      try {
        const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-webhook`;
        const body = new URLSearchParams({
          object: "page",
          callback_url: callbackUrl,
          fields: "leadgen,messages",
          verify_token: verifyToken,
          access_token: `${appId}|${appSecret}`,
        });
        const response = await fetch(`${GRAPH}/${encodeURIComponent(appId)}/subscriptions`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.error || payload?.success === false) {
          const message = payload?.error?.message || `HTTP ${response.status}`;
          const warning = `As assinaturas globais leadgen/mensagens da Meta não foi confirmada: ${message}`;
          appSubscriptionByToken.set(token, warning);
          return warning;
        }
        appSubscriptionByToken.set(token, null);
        return null;
      } catch (error) {
        const warning = `As assinaturas globais leadgen/mensagens da Meta falhou: ${error instanceof Error ? error.message : String(error)}`;
        appSubscriptionByToken.set(token, warning);
        return warning;
      }
    }

    async function subscribePage(pageId: string, pageAccessToken: string, token: string) {
      const warnings = pageSubscriptionWarningsByToken.get(token) || [];
      try {
        const body = new URLSearchParams({
          subscribed_fields: "leadgen,messages",
          access_token: pageAccessToken,
        });
        const response = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.error || payload?.success === false) {
          warnings.push(`Página ${pageId}: assinatura leadgen/mensagens não confirmada (${payload?.error?.message || `HTTP ${response.status}`}).`);
        }
      } catch (error) {
        warnings.push(`Página ${pageId}: falha ao ativar assinatura leadgen/mensagens (${error instanceof Error ? error.message : String(error)}).`);
      }
      pageSubscriptionWarningsByToken.set(token, warnings);
    }

    async function discoverPageForms(token: string): Promise<Map<string, string[]>> {
      const cached = pageFormsByToken.get(token);
      if (cached) return cached;
      const result = new Map<string, string[]>();
      const pageIdsByForm = new Map<string, string>();
      const names = formNamesByToken.get(token) || new Map<string, string>();
      const pagesRes = await fetchAll(
        `${GRAPH}/me/accounts?fields=id,name,access_token,leadgen_forms.limit(200){id,name,account_id}&limit=100&access_token=${token}`,
      );
      if (!pagesRes.error) {
        for (const page of pagesRes.data || []) {
          const pageId = String(page?.id || "");
          const pageToken = String(page?.access_token || token);
          for (const form of page?.leadgen_forms?.data || []) {
            const accountKey = String(form?.account_id || "");
            if (!accountKey) continue;
            const list = result.get(accountKey) || [];
            if (form?.id) list.push(String(form.id));
            if (form?.id && form?.name) names.set(String(form.id), String(form.name));
            if (form?.id && pageId) pageIdsByForm.set(String(form.id), pageId);
            result.set(accountKey, list);
          }
          // The page owns the form and Meta's subscription is page-scoped, not
          // ad-account-scoped. Subscribe every administrable page returned by
          // this token; the form catalog below still routes each lead to its
          // exact ad account and prevents cross-account attribution.
          if (pageId) await subscribePage(pageId, pageToken, token);
        }
      } else {
        const warnings = pageSubscriptionWarningsByToken.get(token) || [];
        warnings.push(`Páginas Meta não puderam ser consultadas: ${pagesRes.error}`);
        pageSubscriptionWarningsByToken.set(token, warnings);
      }
      formNamesByToken.set(token, names);
      pageIdsByFormByToken.set(token, pageIdsByForm);
      pageFormsByToken.set(token, result);
      return result;
    }

    for (const acc of accounts ?? []) {
      try {
        const token = acc.access_token as string;
        const raw = acc.account_id as string;
        const actId = raw.startsWith("act_") ? raw : `act_${raw}`;
        const grantedPermissions = permissionAudit ? await inspectPermissions(token) : null;

        // Discover form_ids primarily via /leadgen_forms. The ads creative field is
        // unreliable across Meta API versions and was aborting the whole account.
        const adsUrl =
          `${GRAPH}/${actId}/ads?fields=id,name,adset_id,campaign_id,adset{name},campaign{name},creative{object_story_spec}&limit=50&access_token=${token}`;
        // Follow every ads page. Discovering only the first page silently
        // omitted forms from larger accounts and made lead KPIs look partial.
        let adsRes = await fetchAll(adsUrl);
        if (adsRes.error) {
          // Older tokens/API versions may reject nested creative fields. Keep
          // lead synchronization alive with the minimal ad listing, while
          // retaining the error only if the fallback also fails.
          const fallbackAds = await fetchAll(
            `${GRAPH}/${actId}/ads?fields=id,name,adset_id,campaign_id&limit=200&access_token=${token}`,
          );
          if (!fallbackAds.error) adsRes = fallbackAds;
          else adsRes = { ...adsRes, error: `ads: ${adsRes.error}; fallback: ${fallbackAds.error}` };
        }
        const formIds = new Set<string>();
        const discoveryWarnings: string[] = [];
        const appSubscriptionWarning = await ensureAppPageWebhook(token);
        if (appSubscriptionWarning) discoveryWarnings.push(appSubscriptionWarning);
        if (grantedPermissions && !grantedPermissions.has("leads_retrieval")) {
          discoveryWarnings.push(
            "Meta token sem a permissão leads_retrieval; reconecte a conta após aprovar essa permissão e o acesso às Páginas.",
          );
        }
        if (adsRes.error) discoveryWarnings.push(`ads: ${adsRes.error}`);
        // Lead forms are owned by Pages, not by the ad account. When Meta
        // exposes the form id in an ad creative, use that authoritative link
        // and avoid the unsupported /act_<id>/leadgen_forms request entirely.
        const collectFormIds = (value: any) => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) {
            for (const item of value) collectFormIds(item);
            return;
          }
          for (const [key, nested] of Object.entries(value)) {
            const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
            if ((normalizedKey === "leadgenformid" || normalizedKey === "formid" || normalizedKey === "leadformid") && nested) {
              formIds.add(String(nested));
            } else if (nested && typeof nested === "object") {
              collectFormIds(nested);
            }
          }
        };
        for (const ad of adsRes.data || []) collectFormIds(ad?.creative);
        // Also discover via /leadgen_forms on the account (covers forms not bound to specific ads)
        const formsUrl =
          `${GRAPH}/${actId}/leadgen_forms?fields=id,name&limit=200&access_token=${token}`;
        const canReadLeadForms = !grantedPermissions || grantedPermissions.has("leads_retrieval");
        const formsRes = canReadLeadForms
          ? await fetchAll(formsUrl)
          : { data: [], pages: 0, error: "leads_retrieval ausente" };
        const formNames = formNamesByToken.get(token) || new Map<string, string>();
        for (const form of formsRes.data || []) {
          if (form?.id && form?.name) formNames.set(String(form.id), String(form.name));
        }
        formNamesByToken.set(token, formNames);
        if (formsRes.error && canReadLeadForms) {
          const pageForms = await discoverPageForms(token);
          for (const id of pageForms.get(raw.replace(/^act_/, "")) || []) formIds.add(id);
        }
        if (!pageFormsByToken.has(token)) await discoverPageForms(token);
        for (const warning of pageSubscriptionWarningsByToken.get(token) || []) {
          if (!discoveryWarnings.includes(warning)) discoveryWarnings.push(warning);
        }
        // An account-level endpoint error is non-fatal when creatives already
        // supplied form ids; the latter is the supported source for those ads.
        if (formsRes.error && formIds.size === 0) discoveryWarnings.push(`forms: ${formsRes.error}`);
        for (const f of formsRes.data || []) {
          if (f?.id) formIds.add(String(f.id));
        }

        // Keep a server-side form -> account route so the webhook can resolve
        // a brand-new lead before the ad catalog has seen its ad/adset.
        if (formIds.size) {
          const pageIdsByForm = pageIdsByFormByToken.get(token) || new Map<string, string>();
          const catalogRows = Array.from(formIds).map((formId) => ({
            form_id: formId,
            ad_account_id: acc.id,
            page_id: pageIdsByForm.get(formId) || null,
            name: formNames.get(formId) || null,
            last_seen_at: new Date().toISOString(),
            raw: { source: "sync-meta-leads" },
          }));
          const { error: catalogError } = await admin
            .from("meta_lead_form_catalog")
            .upsert(catalogRows, { onConflict: "form_id", ignoreDuplicates: false });
          if (catalogError) discoveryWarnings.push(`form catalog: ${catalogError.message}`);
        }

        const adNames = new Map<string, string>();
        const adsetNames = new Map<string, string>();
        const campaignNames = new Map<string, string>();
        for (const ad of adsRes.data || []) {
          if (ad?.id && ad?.name) adNames.set(String(ad.id), String(ad.name));
          if (ad?.adset_id && ad?.adset?.name) adsetNames.set(String(ad.adset_id), String(ad.adset.name));
          if (ad?.campaign_id && ad?.campaign?.name) campaignNames.set(String(ad.campaign_id), String(ad.campaign.name));
        }
        const campaignIds = Array.from(new Set((adsRes.data || []).map((ad: any) => String(ad?.campaign_id || "")).filter(Boolean)));
        const adsetIds = Array.from(new Set((adsRes.data || []).map((ad: any) => String(ad?.adset_id || "")).filter(Boolean)));
        const adIds = Array.from(new Set((adsRes.data || []).map((ad: any) => String(ad?.id || "")).filter(Boolean)));
        if (campaignIds.length) {
          const { data, error } = await admin.from("campaigns").select("id,name").in("id", campaignIds);
          if (error) throw error;
          for (const row of data || []) campaignNames.set(String(row.id), String(row.name));
        }
        if (adsetIds.length) {
          const { data, error } = await admin.from("adsets").select("id,name").in("id", adsetIds);
          if (error) throw error;
          for (const row of data || []) adsetNames.set(String(row.id), String(row.name));
        }
        if (adIds.length) {
          const { data, error } = await admin.from("ads").select("id,name").in("id", adIds);
          if (error) throw error;
          for (const row of data || []) adNames.set(String(row.id), String(row.name));
        }

        let leadsUpserted = 0;
        const formErrors: string[] = [];

        // When leads_retrieval is unavailable, Meta may still allow the ad
        // catalog (ads/adsets/campaigns) to be read. Repair the attribution
        // snapshot already stored in our mirror from those immutable IDs so a
        // historical permission gap does not leave the CRM permanently blank.
        // This path never fabricates form/platform/placement values: those
        // remain null unless the original raw lead payload contains them.
        let existingQuery = admin
          .from("meta_leads")
          .select("*")
          .eq("ad_account_id", acc.id)
          .gte("created_time", new Date(since * 1000).toISOString())
          .limit(10000);
        if (exactRange || recentRange) {
          existingQuery = existingQuery.lt(
            "created_time",
            new Date((exactRange || recentRange)!.endExclusiveEpoch * 1000).toISOString(),
          );
        }
        const { data: existingLeads, error: existingLeadsError } = await existingQuery;
        if (existingLeadsError) {
          formErrors.push(`catalog repair: ${existingLeadsError.message}`);
        } else if (existingLeads?.length) {
          const existingRows = existingLeads as unknown as LeadRow[];
          const before = new Map(existingRows.map((row: any) => [String(row.meta_lead_id), JSON.stringify({
            campaign_name: row.campaign_name,
            adset_name: row.adset_name,
            ad_name: row.ad_name,
            form_name: row.form_name,
            platform: row.platform,
            placement: row.placement,
            attribution_status: row.attribution_status,
          })]));
          await hydrateMissingAttribution(existingRows, token, formNames, adNames, adsetNames, campaignNames);
          const changedRows = existingRows.filter((row: any) => before.get(String(row.meta_lead_id)) !== JSON.stringify({
            campaign_name: row.campaign_name,
            adset_name: row.adset_name,
            ad_name: row.ad_name,
            form_name: row.form_name,
            platform: row.platform,
            placement: row.placement,
            attribution_status: row.attribution_status,
          }));
          for (let i = 0; i < changedRows.length; i += 500) {
            const { error: repairError } = await admin
              .from("meta_leads")
              .upsert(changedRows.slice(i, i + 500), {
                onConflict: "meta_lead_id",
                ignoreDuplicates: false,
              });
            if (repairError) {
              formErrors.push(`catalog repair upsert: ${repairError.message}`);
              break;
            }
            leadsUpserted += Math.min(500, changedRows.length - i);
          }
          for (const row of changedRows) {
            await syncMetaLeadToRD(admin, String(row.meta_lead_id));
          }
        }

        for (const formId of formIds) {
          const filters: Array<Record<string, string | number>> = [
            {
              field: "time_created",
              operator: "GREATER_THAN",
              value: since - 1,
            },
          ];
          if (exactRange || recentRange) {
            filters.push({
              field: "time_created",
              operator: "LESS_THAN",
              value: (exactRange || recentRange)!.endExclusiveEpoch,
            });
          }
          const filtering = encodeURIComponent(JSON.stringify(filters));
          const leadsUrl =
            `${GRAPH}/${formId}/leads?fields=id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,form_name,platform,site_source_name,placement,platform_position,is_organic,field_data&limit=200&filtering=${filtering}&access_token=${token}`;
          let r = await fetchAll(leadsUrl);
          if (r.error) {
            // Some Graph API versions reject optional name/placement fields
            // on /leads. Retry with the stable lead fields so one unsupported
            // field cannot make the whole form disappear from the mirror.
            const fallbackLeadsUrl =
              `${GRAPH}/${formId}/leads?fields=id,created_time,ad_id,adset_id,campaign_id,form_id,field_data&limit=200&filtering=${filtering}&access_token=${token}`;
            const fallback = await fetchAll(fallbackLeadsUrl);
            if (!fallback.error) r = fallback;
          }
          totalPages += r.pages;
          if (r.lastCursor) lastCursor = r.lastCursor;
          if (r.error) {
            formErrors.push(`form ${formId}: ${r.error}`);
            continue;
          }
          // Meta may occasionally ignore one of the filtering clauses. Enforce the
          // exact closed calendar range locally before persisting any record.
          const leadsInRange = exactRange || recentRange
            ? r.data.filter((lead: any) => {
              const createdEpoch = Math.floor(
                Date.parse(String(lead?.created_time ?? "")) / 1000,
              );
              return Number.isFinite(createdEpoch) &&
                createdEpoch >= (exactRange || recentRange)!.startEpoch &&
                createdEpoch < (exactRange || recentRange)!.endExclusiveEpoch;
            })
            : r.data;
          const rows: LeadRow[] = leadsInRange.map((l: any) => {
            const fd = l.field_data || [];
            const email = pickField(fd, EMAIL_KEYS);
            const phone = pickField(fd, PHONE_KEYS);
            const formState = normalizeUF(pickField(fd, STATE_KEYS));
            let state: string | null = formState;
            let source: string | null = formState ? "form" : null;
            if (!state) {
              const fromDDD = dddToUF(phone);
              if (fromDDD) {
                state = fromDDD;
                source = "ddd";
              }
            }
            return {
              ad_account_id: acc.id,
              campaign_id: l.campaign_id ?? null,
              adset_id: l.adset_id ?? null,
              ad_id: l.ad_id ?? null,
              form_id: l.form_id ?? formId,
              meta_lead_id: String(l.id),
              created_time: l.created_time,
              field_data: fd,
              email,
              phone,
              full_name: pickField(fd, NAME_KEYS),
              lead_state: state,
              lead_state_source: source,
              lead_city: pickField(fd, CITY_KEYS),
              campaign_name: String(l.campaign_name || campaignNames.get(String(l.campaign_id || "")) || "") || null,
              adset_name: String(l.adset_name || adsetNames.get(String(l.adset_id || "")) || "") || null,
              ad_name: String(l.ad_name || adNames.get(String(l.ad_id || "")) || "") || null,
              form_name: String(l.form_name || formNames.get(String(l.form_id || formId)) || "") || null,
              platform: String(l.platform || l.site_source_name || l.publisher_platform || "") || null,
              placement: String(l.placement || l.platform_position || "") || null,
              is_organic: typeof l.is_organic === "boolean" ? l.is_organic : null,
              attribution_status: l.campaign_id && l.adset_id && l.ad_id && (l.form_id || formId) ? "captured" : "partial",
              raw: l,
            };
          });

          // A lead can arrive before the catalog sync, and some Graph API
          // versions return only immutable IDs on /<form>/leads. Resolve the
          // missing names from the canonical Graph objects before persistence;
          // IDs remain the only matching key and failures stay partial.
          await hydrateMissingAttribution(rows, token, formNames, adNames, adsetNames, campaignNames);

          // Enrich rows still missing state via RD deals (match by email only — rd_deals has no phone column)
          const missing = rows.filter((x) => !x.lead_state && x.email);
          if (missing.length) {
            const emails = Array.from(
              new Set(missing.map((m) => m.email!.toLowerCase())),
            );
            const rdMap = new Map<string, string>();
            const { data: rd } = await admin
              .from("rd_deals")
              .select("contact_email, lead_state")
              .in("contact_email", emails);
            for (const d of (rd || []) as any[]) {
              const uf = normalizeUF(d.lead_state);
              if (uf && d.contact_email) {
                rdMap.set(String(d.contact_email).toLowerCase(), uf);
              }
            }
            for (const row of missing) {
              const fromRd = row.email
                ? rdMap.get(row.email.toLowerCase())
                : null;
              if (fromRd) {
                row.lead_state = fromRd;
                row.lead_state_source = "rd";
              }
            }
          }

          for (let i = 0; i < rows.length; i += 500) {
            const chunk = rows.slice(i, i + 500);
            const { error: upErr } = await admin
              .from("meta_leads")
              .upsert(chunk, {
                onConflict: "meta_lead_id",
                ignoreDuplicates: false,
              });
            if (upErr) {
              formErrors.push(`upsert form ${formId}: ${upErr.message}`);
              break;
            }
            leadsUpserted += chunk.length;
            for (const row of chunk) {
              await syncMetaLeadToRD(admin, String(row.meta_lead_id));
            }
          }
        }

        totalUpserted += leadsUpserted;
        accountResults.push({
          account: acc.name,
          formsFound: formIds.size,
          leads: leadsUpserted,
          errors: [...discoveryWarnings, ...formErrors].length
            ? [...discoveryWarnings, ...formErrors]
            : undefined,
        });
      } catch (e) {
        accountResults.push({ account: acc.name, error: (e as Error).message });
      }
    }

    const hasWarnings = accountResults.some((result: any) => Array.isArray(result.errors) && result.errors.length > 0);
    const hasFatalErrors = accountResults.some((result: any) => Boolean(result.error));
    const skippedDisconnected = disconnectedAccounts?.length || 0;
    const failedAccounts = accountResults.filter((result: any) => Boolean(result.error)).length;
    const status = accounts?.length === 0
      ? "skipped"
      : hasFatalErrors && failedAccounts >= accounts.length
      ? "failed"
      : hasFatalErrors || hasWarnings
      ? "partial"
      : "success";
    const success = !hasFatalErrors && !hasWarnings;
    return new Response(
      JSON.stringify({
        success,
        status,
        skipped_disconnected: skippedDisconnected,
        disconnected_accounts: (disconnectedAccounts || []).map((account: any) => ({ id: account.id, account_id: account.account_id, name: account.name })),
        upserted: totalUpserted,
        pagination: { pages: totalPages, last_cursor: lastCursor },
        accounts: accountResults,
        errors: accountResults.flatMap((result: any) => [
          ...(Array.isArray(result.errors) ? result.errors : []),
          ...(result.error ? [result.error] : []),
        ]),
        warnings: accountResults.flatMap((result: any) => Array.isArray(result.errors) ? result.errors : []),
        range: exactRange
          ? { startDate: exactRange.startDate, endDate: exactRange.endDate }
          : recentRange
          ? { startAt: new Date(recentRange.startEpoch * 1000).toISOString(), endAt: new Date(recentRange.endExclusiveEpoch * 1000).toISOString() }
          : { days },
      }),
      // `status` carries per-provider outcome; HTTP 200 keeps the structured
      // partial coverage/errors readable through supabase.functions.invoke.
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
