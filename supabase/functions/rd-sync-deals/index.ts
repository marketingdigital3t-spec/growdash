import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalize(s: string) {
  return s.toLowerCase().replace(/\[.*?\]/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

function keyNorm(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findCustomField(sources: any[], aliases: string[]): string | null {
  const wanted = aliases.map(keyNorm);
  for (const arr of sources) {
    if (!Array.isArray(arr)) continue;
    for (const f of arr) {
      const label = f?.custom_field?.label || f?.label || f?.custom_field_id?.label || f?.name || "";
      const k = keyNorm(label);
      if (wanted.includes(k)) {
        const v = f?.value ?? f?.values ?? null;
        if (v == null) continue;
        if (Array.isArray(v)) return v[0] ? String(v[0]) : null;
        return String(v);
      }
    }
  }
  return null;
}

function findCustomFields(sources: any[], aliases: string[]): string[] {
  const wanted = aliases.map(keyNorm);
  const values: string[] = [];
  for (const arr of sources) {
    if (!Array.isArray(arr)) continue;
    for (const f of arr) {
      const label = f?.custom_field?.label || f?.label || f?.custom_field_id?.label || f?.name || "";
      const k = keyNorm(label);
      if (!wanted.includes(k)) continue;
      const raw = f?.value ?? f?.values ?? null;
      const list = Array.isArray(raw) ? raw : [raw];
      for (const value of list) {
        if (value != null && String(value).trim()) values.push(String(value).trim());
      }
    }
  }
  return values;
}

function parseMoneyValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const candidate of [
      record.amount,
      record.value,
      record.total,
      record.price,
      record.text,
      record.label,
      record.name,
    ]) {
      const parsed = parseMoneyValue(candidate);
      if (parsed != null) return parsed;
    }
    return null;
  }
  let text = String(value).trim();
  if (!text) return null;
  text = text.replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!text || text === "-" || text === "," || text === ".") return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    text = lastComma > lastDot
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (lastComma >= 0) {
    text = text.replace(",", ".");
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function findMoneyCustomField(sources: any[], aliases: string[]): number | null {
  const wanted = aliases.map(keyNorm);
  for (const arr of sources) {
    if (!Array.isArray(arr)) continue;
    for (const f of arr) {
      const label = f?.custom_field?.label || f?.label || f?.custom_field_id?.label || f?.name || "";
      const key = keyNorm(label);
      if (!wanted.some((wantedKey) => key === wantedKey || key.includes(wantedKey))) continue;
      const raw = f?.value ?? f?.values ?? null;
      const list = Array.isArray(raw) ? raw : [raw];
      for (const value of list) {
        const parsed = parseMoneyValue(value);
        if (parsed != null) return parsed;
      }
    }
  }
  return null;
}

function collectCustomFieldSources(...roots: any[]): any[] {
  const sources: any[] = [];
  const seen = new Set<any>();
  const visit = (value: any, depth = 0) => {
    if (value == null || depth > 4) return;
    if (Array.isArray(value)) {
      const hasCustomShape = value.some((item) =>
        item?.custom_field || item?.custom_field_id || item?.label || item?.name,
      );
      if (hasCustomShape && !seen.has(value)) {
        seen.add(value);
        sources.push(value);
      }
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (typeof value !== "object") return;
    for (const key of [
      "deal_custom_fields",
      "custom_fields",
      "cf_custom_fields",
      "contact_custom_fields",
      "fields",
      "extra_fields",
      "metadata",
      "contact",
      "deal_contact",
      "deal_lead",
    ]) {
      visit(value[key], depth + 1);
    }
  };

  for (const root of roots) visit(root);
  return sources;
}

function productMoney(product: any): number {
  const quantity = Number(product?.quantity || product?.amount_products || product?.qty || 1) || 1;
  const total = parseMoneyValue(product?.total || product?.total_price || product?.amount_total || product?.amount);
  if (total != null) return total;
  const unit = parseMoneyValue(product?.price || product?.unit_price || product?.value || product?.deal_product?.price);
  return unit != null ? unit * quantity : 0;
}

function resolveDealAmount(d: any, sources: any[]): number {
  const customAmount = findMoneyCustomField(sources, [
    "venda realizada",
    "vendas realizadas",
    "venda concluida",
    "venda concluída",
    "valor venda realizada",
    "valor pago",
    "valor pago venda realizada",
    "valor da venda",
    "valor venda",
    "valor total",
    "total pago",
    "valor recebido",
    "valor fechado",
    "valor da venda realizada",
    "valor do pagamento",
    "faturamento",
    "receita",
    "preco",
    "preço",
    "pagamento realizado",
    "pagamento aprovado",
    "valor da negociacao",
    "valor negociacao",
    "valor da negociação",
    "valor negociação",
    "ticket",
    "ticket medio",
    "ticket médio",
    "payment",
    "paid amount",
    "deal amount",
    "deal value",
    "amount total",
    "amount_total",
  ]);
  if (customAmount != null) return customAmount;

  for (const value of [d.amount_total, d.amount, d.value, d.deal_value, d.total]) {
    const parsed = parseMoneyValue(value);
    if (parsed != null) return parsed;
  }

  const products = [
    ...asArray(d.deal_products),
    ...asArray(d.products),
    ...asArray(d.items),
    ...asArray(d.deal?.deal_products),
  ];
  const productTotal = products.reduce((sum, product) => sum + productMoney(product), 0);
  return productTotal || 0;
}

function compactNorm(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function uniqueStrings(values: Array<unknown>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (!text) continue;
    const key = compactNorm(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function cleanContactName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s*\[.*?\]\s*$/, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function isWonDeal(d: any): boolean {
  if (d.win === true) return true;
  const stage = (d.deal_stage?.name || "").toLowerCase();
  return stage.includes("venda realizada") || stage.includes("ganho") || stage.includes("won") || stage.includes("fechado");
}

function bucketFromStage(stageName: string | null | undefined, win: boolean, lost: boolean): string {
  if (win) return "client";
  if (lost) return "lost";
  const s = (stageName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes("perdido") || s.includes("lost")) return "lost";
  if (s.includes("venda") || s.includes("ganho") || s.includes("won") || s.includes("cliente") || s.includes("fechado")) return "client";
  if (s.includes("oport") || s.includes("negoc") || s.includes("propos")) return "opportunity";
  if (s.includes("sql") || s.includes("qualif")) return "sql";
  if (s.includes("mql") || s.includes("marketing")) return "mql";
  return "lead";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Métricas globais por execução
const metrics = { retries: 0, errors: 0, details: 0, contacts: 0 };

type MetaAttribution = {
  campaignId: string | null;
  campaignIds: string[];
  matchMethod: string | null;
};

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  const backoffs = [500, 1500, 4000];
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
      if ([429, 500, 502, 503, 504].includes(r.status) && i < attempts - 1) {
        const ra = parseInt(r.headers.get("Retry-After") || "0", 10);
        const wait = ra > 0 ? ra * 1000 : backoffs[i];
        metrics.retries++;
        console.log(`[retry] ${r.status} on ${url.split("?")[0]} — waiting ${wait}ms (attempt ${i + 1}/${attempts})`);
        await sleep(wait);
        continue;
      }
      return r;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        metrics.retries++;
        console.log(`[retry] network error — waiting ${backoffs[i]}ms (attempt ${i + 1}/${attempts})`);
        await sleep(backoffs[i]);
        continue;
      }
    }
  }
  metrics.errors++;
  throw lastErr || new Error("fetchWithRetry exhausted attempts");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  metrics.retries = 0; metrics.errors = 0; metrics.details = 0; metrics.contacts = 0;
  let runId: string | null = null;
  let userId: string | null = null;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  async function finishRun(opts: {
    status: "success" | "partial" | "failed";
    deals: number; created: number; updated: number; skipped: number;
    errorMessage?: string | null;
    funnelName?: string;
  }) {
    const duration = Date.now() - startedAt;
    if (runId) {
      await admin.from("sync_runs").update({
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        status: opts.status,
        deals_fetched: opts.deals,
        created_count: opts.created,
        updated_count: opts.updated,
        skipped_count: opts.skipped,
        details_fetched: metrics.details,
        contacts_fetched: metrics.contacts,
        retries_total: metrics.retries,
        errors_total: metrics.errors,
        error_message: opts.errorMessage ?? null,
      }).eq("id", runId);
    }
    // Alertas
    if (userId && (opts.status !== "success" || duration > 60000)) {
      const severity = opts.status === "failed" ? "critical" : "warning";
      const message = opts.status === "failed"
        ? `Sincronização do RD${opts.funnelName ? ` (${opts.funnelName})` : ""} falhou: ${opts.errorMessage || "erro desconhecido"}`
        : `Sincronização do RD${opts.funnelName ? ` (${opts.funnelName})` : ""} demorou ${(duration/1000).toFixed(1)}s (acima do esperado).`;
      await admin.from("alerts").insert({
        user_id: userId, alert_type: "rd_sync", severity, message,
      });
    }
    console.log(`[sync_runs] finished status=${opts.status} duration=${duration}ms retries=${metrics.retries} errors=${metrics.errors} details=${metrics.details} contacts=${metrics.contacts}`);
  }

  try {
    const body = await req.json();
    const {
      funnel_id,
      only_missing_names,
      missing_names_limit = 80,
      realtime = false,
      max_pages,
      max_deals,
      trigger_source,
    } = body || {};
    let deal_ids = body?.deal_ids;
    if (!funnel_id) {
      return new Response(JSON.stringify({ error: "funnel_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    userId = userRes.user?.id || null;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: funnel } = await admin
      .from("rd_funnels")
      .select("id, ad_account_id, rd_funnel_id, name")
      .eq("id", funnel_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!funnel) {
      return new Response(JSON.stringify({ error: "Funil não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!funnel.rd_funnel_id) {
      return new Response(JSON.stringify({ error: "Funil sem rd_funnel_id vinculado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: integration } = await admin
      .from("integrations")
      .select("api_token")
      .eq("user_id", userId)
      .eq("provider", "rd_station_crm")
      .eq("is_active", true)
      .maybeSingle();

    if (!integration?.api_token) {
      return new Response(JSON.stringify({ error: "RD Station CRM não conectado. Configure o token nas Configurações." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = integration.api_token;

    if (only_missing_names) {
      const { data: missingRows, error: missingError } = await admin
        .from("rd_deals")
        .select("rd_deal_id")
        .eq("rd_funnel_id", funnel.id)
        .or("contact_name.is.null,contact_name.eq.")
        .order("lead_created_at", { ascending: false, nullsFirst: false })
        .limit(Math.min(Number(missing_names_limit) || 80, 120));
      if (missingError) throw missingError;
      deal_ids = (missingRows ?? []).map((row: any) => row.rd_deal_id);
    }

    // Cria sync_run (status=running)
    const isReprocess = Array.isArray(deal_ids) && deal_ids.length > 0;
    const { data: runRow } = await admin.from("sync_runs").insert({
      user_id: userId,
      funnel_id: funnel.id,
      provider: "rd_station_crm",
      status: "running",
      trigger_source: trigger_source || (isReprocess ? "reprocess" : realtime ? "auto_realtime" : "manual"),
    }).select("id").single();
    runId = runRow?.id || null;

    const { data: products } = await admin.from("products").select("id, name, tax_rate").eq("user_id", userId);
    const productList = products || [];
    const metaAttributionCache = new Map<string, Promise<{
      campaigns: Array<{ id: string; name: string | null }>;
      adsets: Array<{ id: string; name: string | null; campaign_id: string | null }>;
      ads: Array<{ id: string; name: string | null; adset_id: string | null; campaign_id: string | null }>;
    }>>();

    const loadMetaAttribution = (adAccountId: string) => {
      if (!metaAttributionCache.has(adAccountId)) {
        metaAttributionCache.set(adAccountId, (async () => {
          const { data: campaigns } = await admin
            .from("campaigns")
            .select("id,name")
            .eq("ad_account_id", adAccountId);

          const campaignIds = (campaigns || []).map((campaign: any) => campaign.id);
          const { data: adsets } = campaignIds.length > 0
            ? await admin.from("adsets").select("id,name,campaign_id").in("campaign_id", campaignIds)
            : { data: [] as any[] };

          const adsetIds = (adsets || []).map((adset: any) => adset.id);
          const { data: ads } = adsetIds.length > 0
            ? await admin.from("ads").select("id,name,adset_id").in("adset_id", adsetIds)
            : { data: [] as any[] };

          const adsetCampaign = new Map((adsets || []).map((adset: any) => [String(adset.id), adset.campaign_id]));

          return {
            campaigns: (campaigns || []) as Array<{ id: string; name: string | null }>,
            adsets: (adsets || []) as Array<{ id: string; name: string | null; campaign_id: string | null }>,
            ads: (ads || []).map((ad: any) => ({
              id: ad.id,
              name: ad.name,
              adset_id: ad.adset_id,
              campaign_id: adsetCampaign.get(String(ad.adset_id)) ?? null,
            })),
          };
        })());
      }
      return metaAttributionCache.get(adAccountId)!;
    };

    async function resolveMetaAttribution(adAccountId: string, candidates: {
      campaign: unknown[];
      adset: unknown[];
      ad: unknown[];
    }): Promise<MetaAttribution> {
      const meta = await loadMetaAttribution(adAccountId);
      const campaignValues = uniqueStrings(candidates.campaign);
      const adsetValues = uniqueStrings(candidates.adset);
      const adValues = uniqueStrings(candidates.ad);

      const byId = (values: string[], rows: Array<{ id: string }>) => {
        const ids = new Set(rows.map((row) => String(row.id)));
        return values.find((value) => ids.has(String(value)));
      };
      const byName = <T extends { id: string; name: string | null }>(values: string[], rows: T[]) => {
        for (const value of values) {
          const normalized = compactNorm(value);
          if (!normalized) continue;
          const exact = rows.find((row) => compactNorm(row.name) === normalized);
          if (exact) return exact;
          const partial = rows.find((row) => {
            const name = compactNorm(row.name);
            return name.length > 3 && (name.includes(normalized) || normalized.includes(name));
          });
          if (partial) return partial;
        }
        return null;
      };

      const campaignId = byId(campaignValues, meta.campaigns);
      if (campaignId) return { campaignId, campaignIds: [campaignId], matchMethod: "utm_campaign_id" };

      const adId = byId(adValues, meta.ads);
      if (adId) {
        const ad = meta.ads.find((row) => row.id === adId);
        return { campaignId: ad?.campaign_id ?? null, campaignIds: ad?.campaign_id ? [ad.campaign_id] : [], matchMethod: "utm_content_ad_id" };
      }

      const adsetId = byId(adsetValues, meta.adsets);
      if (adsetId) {
        const adset = meta.adsets.find((row) => row.id === adsetId);
        return { campaignId: adset?.campaign_id ?? null, campaignIds: adset?.campaign_id ? [adset.campaign_id] : [], matchMethod: "utm_term_adset_id" };
      }

      const campaignByName = byName(campaignValues, meta.campaigns);
      if (campaignByName) return { campaignId: campaignByName.id, campaignIds: [campaignByName.id], matchMethod: "utm_campaign_name" };

      const adByName = byName(adValues, meta.ads);
      if (adByName?.campaign_id) return { campaignId: adByName.campaign_id, campaignIds: [adByName.campaign_id], matchMethod: "utm_content_ad_name" };

      const adsetByName = byName(adsetValues, meta.adsets);
      if (adsetByName?.campaign_id) return { campaignId: adsetByName.campaign_id, campaignIds: [adsetByName.campaign_id], matchMethod: "utm_term_adset_name" };

      return { campaignId: null, campaignIds: [], matchMethod: null };
    }

    // Buscar e cachear etapas reais do funil no RD
    const stageOrderMap = new Map<string, number>();
    const stageWonMap = new Map<string, boolean>();
    const stageLostMap = new Map<string, boolean>();
    try {
      const sr = await fetchWithRetry(
        `https://crm.rdstation.com/api/v1/deal_stages?token=${encodeURIComponent(token)}&deal_pipeline_id=${encodeURIComponent(funnel.rd_funnel_id)}&limit=200`,
      );
      if (sr.ok) {
        const sjson = await sr.json();
        const stagesArr: any[] = sjson?.deal_stages || sjson || [];
        const rows = stagesArr.map((s, idx) => {
          const name = String(s?.name || "");
          const lname = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const isWon = lname.includes("ganho") || lname.includes("venda real") || lname.includes("venda concl") || lname.includes("fechado ganho") || lname.includes("won") || lname.includes("cliente");
          const isLost = lname.includes("perdido") || lname.includes("perda") || lname.includes("lost");
          const ord = Number(s?.order ?? s?.position ?? idx);
          const sid = String(s?.id || s?._id);
          stageOrderMap.set(sid, ord);
          stageWonMap.set(sid, isWon);
          stageLostMap.set(sid, isLost);
          return {
            rd_funnel_id: funnel.id,
            ad_account_id: funnel.ad_account_id,
            user_id: userId!,
            rd_stage_id: sid,
            name,
            nickname: s?.nickname || null,
            order: ord,
            is_won: isWon,
            is_lost: isLost,
            updated_at: new Date().toISOString(),
          };
        });
        if (rows.length > 0) {
          await admin.from("rd_funnel_stages").upsert(rows, { onConflict: "rd_funnel_id,rd_stage_id" });
          console.log(`[stages] sincronizadas ${rows.length} etapas reais do funil ${funnel.name}`);
        }
      } else {
        console.log(`[stages] fetch failed status=${sr.status}`);
      }
    } catch (e) {
      console.log(`[stages] erro: ${(e as Error).message}`);
    }

    let totalCreated = 0, totalUpdated = 0, totalSkipped = 0, totalDeals = 0;
    let debugLogged = false;

    async function persistTouches(input: {
      rdDealId: string;
      userId: string;
      adAccountId: string;
      leadAt: string;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      utm_content: string | null;
      utm_term: string | null;
      matched_campaign_id: string | null;
      source: string;
    }) {
      if (!input.utm_source && !input.utm_medium && !input.utm_campaign && !input.utm_content && !input.utm_term) return;

      const touchAt = new Date(input.leadAt).toISOString();
      const { data: existing } = await admin
        .from("rd_deal_touches")
        .select("id")
        .eq("rd_deal_id", input.rdDealId)
        .eq("touch_at", touchAt)
        .eq("utm_campaign", input.utm_campaign || "")
        .maybeSingle();

      if (existing?.id) return;

      const { data: lastTouch } = await admin
        .from("rd_deal_touches")
        .select("touch_order")
        .eq("rd_deal_id", input.rdDealId)
        .order("touch_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (lastTouch?.touch_order ?? 0) + 1;
      if (lastTouch) {
        await admin.from("rd_deal_touches").update({ is_last: false }).eq("rd_deal_id", input.rdDealId);
      }

      const { error } = await admin.from("rd_deal_touches").insert({
        rd_deal_id: input.rdDealId,
        ad_account_id: input.adAccountId,
        user_id: input.userId,
        touch_at: touchAt,
        utm_source: input.utm_source,
        utm_medium: input.utm_medium,
        utm_campaign: input.utm_campaign,
        utm_content: input.utm_content,
        utm_term: input.utm_term,
        matched_campaign_id: input.matched_campaign_id,
        touch_order: nextOrder,
        is_first: nextOrder === 1,
        is_last: true,
        source: input.source,
      });

      if (error) {
        console.log(`[rd_deal_touches] ${input.rdDealId} failed: ${error.message}`);
        metrics.errors++;
        return;
      }

      const { data: firstTouch } = await admin
        .from("rd_deal_touches")
        .select("utm_campaign")
        .eq("rd_deal_id", input.rdDealId)
        .order("touch_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      await admin.from("rd_deals").update({
        first_touch_utm_campaign: firstTouch?.utm_campaign ?? input.utm_campaign,
        last_touch_utm_campaign: input.utm_campaign,
        touch_count: nextOrder,
      }).eq("rd_deal_id", input.rdDealId);
    }

    async function processDeal(d: any) {
      const id = String(d.id || d._id);
      let detail: any = d;
      let detailOk = false;
      try {
        const dr = await fetchWithRetry(`https://crm.rdstation.com/api/v1/deals/${id}?token=${encodeURIComponent(token)}`);
        if (dr.ok) { detail = { ...d, ...(await dr.json()) }; metrics.details++; detailOk = true; }
        else { console.log(`[deal ${id}] detail FAILED status=${dr.status}`); metrics.errors++; }
      } catch (e) { console.log(`[deal ${id}] detail threw: ${(e as Error).message}`); metrics.errors++; }
      let dealContacts: any[] = [];
      try {
        const cr = await fetchWithRetry(`https://crm.rdstation.com/api/v1/deals/${id}/contacts?token=${encodeURIComponent(token)}`);
        if (cr.ok) {
          const cj = await cr.json();
          dealContacts = asArray(cj?.contacts ?? cj?.data ?? cj);
          metrics.contacts++;
        } else {
          console.log(`[deal ${id}] /contacts FAILED status=${cr.status}`);
        }
      } catch (e) { console.log(`[deal ${id}] /contacts threw: ${(e as Error).message}`); }

      // Fallback: enriquecer contatos inline do detalhe via /contacts/{id} quando não vier nome
      const inlineContacts: any[] = asArray(detail.contacts ?? detail.set_contacts ?? detail.deal_contacts);
      const haveNamed = dealContacts.some((c) => cleanContactName(c?.name ?? c?.contact?.name));
      if (!haveNamed && inlineContacts.length > 0) {
        const enriched: any[] = [];
        for (const c of inlineContacts.slice(0, 3)) {
          const cid = c?.id || c?._id || c?.contact_id || c?.contact?.id || c?.contact?._id;
          if (!cid) { if (c?.name) enriched.push(c); continue; }
          try {
            const r = await fetchWithRetry(`https://crm.rdstation.com/api/v1/contacts/${cid}?token=${encodeURIComponent(token)}`);
            if (r.ok) { const cj = await r.json(); enriched.push(cj || c); }
            else enriched.push(c);
          } catch { enriched.push(c); }
        }
        if (enriched.length > 0) dealContacts = enriched;
      }

      if (!debugLogged && detailOk) {
        debugLogged = true;
        const cfs = detail.deal_custom_fields || detail.custom_fields || [];
        const labels = (Array.isArray(cfs) ? cfs : []).map((f: any) =>
          ({ label: f?.custom_field?.label || f?.label || f?.name, value: f?.value ?? f?.values }));
        console.log(`[rd-debug ${id}] deal keys=`, Object.keys(detail).join(","));
        console.log(`[rd-debug ${id}] deal_custom_fields=`, JSON.stringify(labels).slice(0, 1500));
        console.log(`[rd-debug ${id}] contact keys=`, Object.keys(detail.contact || {}).join(","));
        console.log(`[rd-debug ${id}] _contacts sample=`, JSON.stringify(dealContacts[0] || null).slice(0, 800));
      }
      return { ...detail, _contacts: dealContacts };
    }

    async function persistDeal(d: any) {
      const rdDealId = String(d.id || d._id);
      const stageName = d.deal_stage?.name || null;
      const stageId = d.deal_stage?.id ? String(d.deal_stage.id) : null;
      const stageIsWon = stageId ? stageWonMap.get(stageId) === true : false;
      const stageIsLost = stageId ? stageLostMap.get(stageId) === true : false;
      const won = isWonDeal(d) || stageIsWon;
      const lost = !won && (d.win === false || d.deal_lost_reason != null || stageIsLost);
      const bucket = bucketFromStage(stageName, won, lost);
      const lostReason = d.deal_lost_reason?.name || d.deal_lost_reason || null;
      const stageUpdatedAt = d.stage_updated_at || d.updated_at || d.last_activity_at || null;
      const closedAt = d.closed_at || (won ? (stageUpdatedAt || d.created_at || new Date().toISOString()) : null);

      const baseContact = d.contact || d.deal_contact || {};
      const inlineContacts = asArray(d.contacts ?? d.set_contacts ?? d.deal_contacts);
      const inline = inlineContacts.length > 0 ? inlineContacts[0] : {};
      const firstContact = Array.isArray(d._contacts) && d._contacts.length > 0 ? d._contacts[0] : {};
      const nestedContact = firstContact.contact || inline.contact || baseContact.contact || {};
      const contact = { ...inline, ...firstContact, ...baseContact };
      const phones = (baseContact.phones?.length ? baseContact.phones : (firstContact.phones?.length ? firstContact.phones : (nestedContact.phones?.length ? nestedContact.phones : inline.phones))) || [];
      const emails = (baseContact.emails?.length ? baseContact.emails : (firstContact.emails?.length ? firstContact.emails : (nestedContact.emails?.length ? nestedContact.emails : inline.emails))) || [];

      const rawName = firstString(baseContact.name, firstContact.name, nestedContact.name, inline.name, d.contact_name, d.deal_lead?.name, d.name);
      const contactName = cleanContactName(rawName);
      const contactPhone = phones.length > 0 ? (phones[0]?.phone || phones[0] || null) : (baseContact.phone || firstContact.phone || nestedContact.phone || null);
      const contactEmail = emails.length > 0
        ? (emails[0]?.email || emails[0] || null)
        : (baseContact.email || firstContact.email || nestedContact.email || inline.email || null);

      const contactCustomFields = firstContact?.contact_custom_fields || baseContact?.contact_custom_fields || [];
      const dealCustomFields = d.deal_custom_fields || d.custom_fields || d.cf_custom_fields || [];
      const allCfSources = collectCustomFieldSources(d, baseContact, firstContact, nestedContact, inline, dealCustomFields, contactCustomFields);
      const amountTotal = resolveDealAmount(d, allCfSources);

      const contactState = contact.state || contact.address_state
        || findCustomField(allCfSources, ["state", "estado", "uf", "lead_state", "estadouf"]) || null;
      const contactCity = contact.city || contact.address_city
        || findCustomField(allCfSources, ["city", "cidade", "lead_city", "cidadelead"]) || null;

      const saleDateSource = closedAt || stageUpdatedAt || d.updated_at || d.created_at || new Date().toISOString();
      const saleDate = new Date(saleDateSource).toISOString().split("T")[0];

      let productId: string | null = null;
      let rdProductName: string | null = null;
      if (d.deal_products?.length > 0) rdProductName = d.deal_products[0].name || null;
      let taxAmount = 0;
      let netRevenue = amountTotal;
      if (rdProductName && productList.length > 0) {
        const norm = normalize(rdProductName);
        let match = productList.find((p) => normalize(p.name) === norm);
        if (!match && norm.includes("online")) match = productList.find((p) => normalize(p.name).includes("online"));
        if (!match && norm.includes("presencial")) match = productList.find((p) => normalize(p.name).includes("presencial"));
        if (!match) match = productList.find((p) => norm.includes(normalize(p.name)));
        if (match) {
          productId = match.id;
          if (match.tax_rate) {
            taxAmount = amountTotal * (match.tax_rate / 100);
            netRevenue = amountTotal - taxAmount;
          }
        }
      }

      const rdCampaignName = d.campaign?.name || (typeof d.campaign === "string" ? d.campaign : null) || d.deal_source?.name || null;

      const cfSources = allCfSources;
      const utms = d.utms || d.utm || baseContact?.utms || firstContact?.utms || nestedContact?.utms || d.deal_source || d.lead_origin || {};
      const pickUtm = (name: string, aliases: string[]) =>
        d[`utm_${name}`] || utms?.[name] || utms?.[`utm_${name}`] || contact?.[`utm_${name}`] || nestedContact?.[`utm_${name}`] || findCustomField(cfSources, aliases);

      const utm_source   = pickUtm("source",   ["utmsource",   "utm_source",   "source",   "fonte"]) || null;
      const utm_medium   = pickUtm("medium",   ["utmmedium",   "utm_medium",   "medium",   "midia", "mídia"]) || null;
      const utm_campaign = pickUtm("campaign", ["utmcampaign", "utm_campaign", "campaign", "campanha"]) || null;
      const utm_term     = pickUtm("term",     ["utmterm",     "utm_term",     "term",     "termo"]) || null;
      const utm_content  = pickUtm("content",  ["utmcontent",  "utm_content",  "content",  "conteudo", "conteúdo"]) || null;

      const attribution = await resolveMetaAttribution(funnel!.ad_account_id, {
        campaign: [
          utm_campaign,
          rdCampaignName,
          ...findCustomFields(cfSources, ["campaignid", "campaign_id", "meta_campaign_id", "idcampanha", "campanhaid"]),
        ],
        adset: [
          utm_term,
          ...findCustomFields(cfSources, ["adsetid", "adset_id", "meta_adset_id", "conjuntodeanuncio", "conjuntoid"]),
        ],
        ad: [
          utm_content,
          ...findCustomFields(cfSources, ["adid", "ad_id", "meta_ad_id", "creative", "criativo", "anuncioid"]),
        ],
      });

      const leadEntryDate = d.created_at
        ? new Date(d.created_at).toISOString().split("T")[0]
        : null;

      const dealOwnerName = d.user?.name || d.deal_user?.name || d.owner?.name || null;

      // Upsert rd_deals (todos os deals, não apenas ganhos)
      try {
        await admin.from("rd_deals").upsert({
          user_id: userId!,
          ad_account_id: funnel!.ad_account_id,
          rd_funnel_id: funnel!.id,
          rd_deal_id: rdDealId,
          rd_stage_id: stageId,
          rd_stage_name: stageName,
          rd_stage_order: stageId && stageOrderMap.has(stageId) ? stageOrderMap.get(stageId) : null,
          deal_owner_name: dealOwnerName,
          rd_product_name: rdProductName,
          stage_bucket: bucket,
          win: won,
          lost_reason: lostReason,
          amount_total: amountTotal,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          contact_name: contactName,
          contact_email: contactEmail,
          lead_state: contactState,
          lead_city: contactCity,
          lead_created_at: d.created_at || null,
          stage_updated_at: stageUpdatedAt,
          closed_at: closedAt,
          raw: d,
        }, { onConflict: "user_id,rd_deal_id" });

        await persistTouches({
          rdDealId,
          userId: userId!,
          adAccountId: funnel!.ad_account_id,
          leadAt: d.created_at || stageUpdatedAt || closedAt || new Date().toISOString(),
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          utm_term,
          matched_campaign_id: attribution.campaignId,
          source: "rd_sync",
        });
      } catch (e) {
        console.log(`[rd_deals upsert] ${rdDealId} failed: ${(e as Error).message}`);
        metrics.errors++;
      }



      // A partir daqui só persistimos `sales` para deals ganhos.
      if (!won) return;

      const { data: existing } = await admin.from("sales")
        .select("id, payment_method, notes, lead_state, lead_city, utm_source, utm_medium, utm_campaign, utm_term, utm_content, contact_name, contact_phone, contact_email, lead_entry_date")
        .eq("rd_deal_id", rdDealId).maybeSingle();

      // Constrói payload preservando valores manuais já preenchidos.
      // Regra: campos vindos do RD só são gravados quando o registro existente
      // estiver vazio. Pagamento nunca é sobrescrito; é manual.
      const preserve = <T,>(current: T | null | undefined, incoming: T | null | undefined): T | null =>
        (current != null && current !== "" ? current : (incoming ?? null)) as T | null;

      const baseData: Record<string, any> = {
        user_id: userId!,
        rd_deal_id: rdDealId,
        ad_account_id: funnel!.ad_account_id,
        gross_revenue: amountTotal,
        net_revenue: netRevenue,
        tax_amount: taxAmount,
        status: "confirmed",
        sale_date: saleDate,
        product_id: productId,
        quantity: d.deal_products?.length || 1,
        rd_product_name: rdProductName,
        rd_campaign_name: rdCampaignName,
        rd_funnel_id: funnel!.id,
        matched_campaign_id: attribution.campaignId,
        match_method: attribution.matchMethod ?? "rd_sync_unmatched",
        campaign_ids: attribution.campaignIds,
      };

      if (existing) {
        const update = {
          ...baseData,
          lead_entry_date: preserve(existing.lead_entry_date, leadEntryDate),
          lead_state:      preserve(existing.lead_state, contactState),
          lead_city:       preserve(existing.lead_city, contactCity),
          contact_name:    preserve(existing.contact_name, contactName),
          contact_phone:   preserve(existing.contact_phone, contactPhone),
          contact_email:   preserve(existing.contact_email, contactEmail),
          utm_source:      preserve(existing.utm_source, utm_source),
          utm_medium:      preserve(existing.utm_medium, utm_medium),
          utm_campaign:    preserve(existing.utm_campaign, utm_campaign),
          utm_term:        preserve(existing.utm_term, utm_term),
          utm_content:     preserve(existing.utm_content, utm_content),
        };
        await admin.from("sales").update(update).eq("rd_deal_id", rdDealId);
        totalUpdated++;
      } else {
        await admin.from("sales").insert({
          ...baseData,
          lead_entry_date: leadEntryDate,
          lead_state: contactState,
          lead_city: contactCity,
          contact_name: contactName,
          contact_phone: contactPhone,
          contact_email: contactEmail,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          payment_method: "pix",
          notes: null,
        });
        totalCreated++;
      }
    }

    const BATCH_SIZE = realtime ? 4 : 2;
    const BATCH_PAUSE_MS = realtime ? 100 : 400;

    if (isReprocess) {
      // Buscar diretamente cada deal informado
      for (let i = 0; i < deal_ids.length; i += BATCH_SIZE) {
        const batch = deal_ids.slice(i, i + BATCH_SIZE);
        const enriched = await Promise.all(batch.map((id: string) => processDeal({ id })));
        totalDeals += enriched.length;
        for (const d of enriched) await persistDeal(d);
        await sleep(BATCH_PAUSE_MS);
      }
    } else {
      let page = 1;
      const maxPages = Math.max(1, Math.min(Number(max_pages) || (realtime ? 1 : 50), realtime ? 3 : 50));
      const maxDeals = Math.max(1, Math.min(Number(max_deals) || (realtime ? 40 : 10_000), realtime ? 100 : 10_000));
      while (page <= maxPages) {
        const url = `https://crm.rdstation.com/api/v1/deals?token=${encodeURIComponent(token)}&deal_pipeline_id=${encodeURIComponent(funnel.rd_funnel_id)}&page=${page}&limit=200`;
        const r = await fetchWithRetry(url);
        if (!r.ok) {
          const txt = await r.text();
          await finishRun({ status: "failed", deals: totalDeals, created: totalCreated, updated: totalUpdated, skipped: totalSkipped, errorMessage: `RD API ${r.status}: ${txt.slice(0, 200)}`, funnelName: funnel.name });
          return new Response(JSON.stringify({ error: `RD API ${r.status}: ${txt.slice(0, 200)}`, page }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const payload = await r.json();
        let deals = payload.deals || payload || [];
        if (!Array.isArray(deals) || deals.length === 0) break;
        const remaining = Math.max(0, maxDeals - totalDeals);
        if (remaining <= 0) break;
        deals = deals.slice(0, remaining);
        totalDeals += deals.length;

        for (let i = 0; i < deals.length; i += BATCH_SIZE) {
          const batch = deals.slice(i, i + BATCH_SIZE);
          const details = await Promise.all(batch.map(processDeal));
          for (const d of details) await persistDeal(d);
          await sleep(BATCH_PAUSE_MS);
        }

        if (deals.length < 200 || totalDeals >= maxDeals) break;
        page++;
      }
    }

    const status = metrics.errors > 0 ? "partial" : "success";
    await finishRun({ status, deals: totalDeals, created: totalCreated, updated: totalUpdated, skipped: totalSkipped, funnelName: funnel.name });

    return new Response(JSON.stringify({ ok: true, created: totalCreated, updated: totalUpdated, skipped: totalSkipped, deals: totalDeals, details_fetched: metrics.details, contacts_fetched: metrics.contacts, retries: metrics.retries, errors: metrics.errors }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = (err as Error).message;
    await finishRun({ status: "failed", deals: 0, created: 0, updated: 0, skipped: 0, errorMessage: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
