import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { executeRDWrite, RDWriteError } from "../_shared/rdWrite.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const TRACKING_KEYS = ["source", "campaign", "adset", "creative", "form", "platform", "placement", "isOrganic"] as const;
type TrackingKey = typeof TRACKING_KEYS[number];
type Tracking = Partial<Record<TrackingKey, string | boolean | null>>;
const LABELS: Record<TrackingKey, string[]> = {
  source: ["origem", "source", "utm_source", "origem do lead"],
  campaign: ["campanha", "campaign", "utm_campaign", "nome da campanha"],
  adset: ["conjunto", "adset", "utm_term", "nome do conjunto"],
  creative: ["criativo", "anuncio", "anúncio", "ad", "utm_content", "nome do anuncio", "nome do anúncio"],
  form: ["formulario", "formulário", "form", "form_name", "formulario meta"],
  platform: ["plataforma", "platform", "publisher_platform", "site_source_name"],
  placement: ["posicionamento", "placement", "platform_position"],
  isOrganic: ["origem organica", "origem orgânica", "is_organic", "organico", "orgânico"],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const norm = (value: unknown) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const clean = (value: unknown) => { const result = value == null ? "" : String(value).trim(); return result || null; };
const fieldLabel = (field: any) => String(field?.custom_field?.label || field?.label || field?.custom_field_id?.label || field?.name || "").trim();
const fieldValue = (field: any) => { const value = field?.value ?? field?.values ?? null; if (Array.isArray(value)) return clean(value[0]); if (value && typeof value === "object") return clean(value.label ?? value.value); return clean(value); };

function normalizeTracking(input: unknown): Tracking {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const result: Tracking = {};
  for (const key of TRACKING_KEYS) {
    if (!(key in (input as Record<string, unknown>))) continue;
    const value = (input as Record<string, unknown>)[key];
    if (key === "isOrganic") result[key] = value === true || value === "true" || value === "yes" || value === "sim" ? true : value === false || value === "false" || value === "no" || value === "não" || value === "nao" ? false : null;
    else result[key] = clean(value);
  }
  return result;
}

function automaticTracking(deal: any): Tracking {
  return {
    source: deal.utm_source,
    campaign: deal.meta_campaign_name || deal.utm_campaign,
    adset: deal.meta_adset_name || deal.utm_term,
    creative: deal.meta_ad_name || deal.utm_content,
    form: deal.meta_form_name || deal.meta_form_id,
    platform: deal.meta_platform,
    placement: deal.meta_placement,
    isOrganic: typeof deal.meta_is_organic === "boolean" ? deal.meta_is_organic : null,
  };
}

function patchFields(fields: any[], tracking: Tracking) {
  const missing: string[] = [];
  const touched = new Set<TrackingKey>();
  const next = fields.map((field: any) => {
    const label = norm(fieldLabel(field));
    const key = TRACKING_KEYS.find((candidate) => LABELS[candidate].some((alias) => norm(alias) === label));
    if (!key || !(key in tracking)) return field;
    touched.add(key);
    const value = key === "isOrganic" ? (tracking[key] == null ? null : tracking[key] ? "Sim" : "Não") : clean(tracking[key]);
    const updated = { ...field };
    if (Array.isArray(field?.values)) updated.values = value == null ? [] : [value];
    else updated.value = value;
    return updated;
  });
  for (const key of Object.keys(tracking) as TrackingKey[]) if (!touched.has(key)) missing.push(key);
  return { next, missing };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado" }, 401);
  try {
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return json({ error: "Usuário inválido" }, 401);
    const body = await req.json().catch(() => ({}));
    const connectionId = typeof body?.rd_connection_id === "string" ? body.rd_connection_id : "";
    const rdDealId = typeof body?.rd_deal_id === "string" ? body.rd_deal_id : "";
    const useAutomatic = body?.use_automatic === true;
    const requested = normalizeTracking(body?.tracking);
    const tracking = useAutomatic ? {} : requested;
    const correlationId = typeof body?.correlation_id === "string" && body.correlation_id ? body.correlation_id : crypto.randomUUID();
    if (!connectionId || !rdDealId || (!useAutomatic && !Object.keys(tracking).length)) return json({ error: "rd_connection_id, rd_deal_id e tracking são obrigatórios" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: deal, error: dealError } = await admin.from("rd_deals").select("id,rd_connection_id,rd_deal_id,raw,custom_fields,manual_tracking,utm_source,utm_campaign,utm_term,utm_content,meta_campaign_name,meta_adset_name,meta_ad_name,meta_form_name,meta_form_id,meta_platform,meta_placement,meta_is_organic").eq("rd_connection_id", connectionId).eq("rd_deal_id", rdDealId).maybeSingle();
    if (dealError) throw dealError;
    if (!deal) return json({ error: "Negociação não encontrada na conexão RD selecionada" }, 404);
    const raw = deal.raw && typeof deal.raw === "object" ? deal.raw : {};
    const rawDeal = raw.deal && typeof raw.deal === "object" ? raw.deal : raw;
    const fields = Array.isArray(rawDeal.deal_custom_fields)
      ? rawDeal.deal_custom_fields
      : Array.isArray(raw.deal_custom_fields) ? raw.deal_custom_fields : [];
    const nextManual = useAutomatic ? {} : tracking;
    const before = { manual_tracking: deal.manual_tracking || {}, deal_custom_fields: fields };
    const patched = patchFields(fields, useAutomatic ? automaticTracking(deal) : tracking);
    const after = { manual_tracking: nextManual, deal_custom_fields: patched.next };
    if (JSON.stringify(before) === JSON.stringify(after)) return json({ ok: true, noop: true, deal_id: deal.id });
    const providerFieldsChanged = JSON.stringify(fields) !== JSON.stringify(patched.next);
    let auditId: string | undefined;
    let skipped = false;
    if (providerFieldsChanged) {
      const result = await executeRDWrite({ admin, userId, connectionId, action: "update_deal", target: { rd_deal_id: rdDealId, tracking: true }, before, after, correlationId: `${correlationId}:fields`, method: "PUT", path: `/deals/${encodeURIComponent(rdDealId)}`, body: { deal: { deal_custom_fields: patched.next } } });
      auditId = result.auditId;
      skipped = result.skipped;
    }
    if (patched.missing.length) {
      const noteTracking = useAutomatic ? automaticTracking(deal) : tracking;
      const lines = [useAutomatic ? "Rastreamento automático restaurado — Growdash" : "Rastreamento manual atualizado — Growdash", ...TRACKING_KEYS.map((key) => `${key}: ${noteTracking[key] == null ? "Não informado" : String(noteTracking[key])}`), `Campos sem campo personalizado correspondente no RD: ${patched.missing.join(", ")}`];
      const noteResult = await executeRDWrite({ admin, userId, connectionId, action: "add_note", target: { rd_deal_id: rdDealId, tracking: true }, before: {}, after: { body: lines.join("\n") }, correlationId: `${correlationId}:note`, method: "POST", path: "/activities", body: { deal_id: rdDealId, type: "note", description: lines.join("\n") } });
      auditId ||= noteResult.auditId;
      skipped = skipped && noteResult.skipped;
    }
    const nextRaw = { ...raw, deal: { ...rawDeal, deal_custom_fields: patched.next }, deal_custom_fields: patched.next };
    const { error: mirrorError } = await admin.from("rd_deals").update({ manual_tracking: nextManual, manual_tracking_updated_at: useAutomatic ? null : new Date().toISOString(), raw: nextRaw, updated_at: new Date().toISOString() }).eq("id", deal.id).eq("rd_connection_id", connectionId);
    if (mirrorError) return json({ ok: true, partial: true, audit_id: auditId, error: "O RD foi atualizado, mas o espelho local aguarda reconciliação." }, 202);
    return json({ ok: true, audit_id: auditId, skipped, deal_id: deal.id, tracking: nextManual, automatic: useAutomatic, rd_unmapped: patched.missing });
  } catch (error) {
    if (error instanceof RDWriteError) return json({ error: error.message, code: error.code }, error.status);
    console.error("rd-update-tracking", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
