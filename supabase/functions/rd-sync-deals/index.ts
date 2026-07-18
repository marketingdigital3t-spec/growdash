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

const DDD_TO_UF: Record<string, string> = {
  "11":"SP","12":"SP","13":"SP","14":"SP","15":"SP","16":"SP","17":"SP","18":"SP","19":"SP",
  "21":"RJ","22":"RJ","24":"RJ","27":"ES","28":"ES","31":"MG","32":"MG","33":"MG","34":"MG","35":"MG","37":"MG","38":"MG",
  "41":"PR","42":"PR","43":"PR","44":"PR","45":"PR","46":"PR","47":"SC","48":"SC","49":"SC","51":"RS","53":"RS","54":"RS","55":"RS",
  "61":"DF","62":"GO","64":"GO","63":"TO","65":"MT","66":"MT","67":"MS","68":"AC","69":"RO","71":"BA","73":"BA","74":"BA","75":"BA","77":"BA","79":"SE",
  "81":"PE","87":"PE","82":"AL","83":"PB","84":"RN","85":"CE","88":"CE","86":"PI","89":"PI","91":"PA","93":"PA","94":"PA","92":"AM","97":"AM","95":"RR","96":"AP","98":"MA","99":"MA",
};
function phoneToUF(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return d.length >= 10 ? DDD_TO_UF[d.slice(0, 2)] || null : null;
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

function extractPaymentMethod(sources: any[]): string | null {
  const raw = findCustomField(sources, [
    "formadepagamento",
    "forma_pagamento",
    "forma pagamento",
    "formapagamento",
    "metododepagamento",
    "metodopagamento",
    "metodo de pagamento",
    "método de pagamento",
    "pagamento",
    "payment",
    "paymentmethod",
  ]);
  if (!raw) return null;
  const n = String(raw).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!n) return null;
  if (n.includes("pix")) return "pix";
  if (n.includes("boleto")) return "boleto";
  if (n.includes("cart") || n.includes("credit") || n.includes("debit")) return "cartao";
  if (n.includes("transfer") || n.includes("ted") || n.includes("doc") || n.includes("dinheiro") || n.includes("cash") || n.includes("especie") || n.includes("outro")) return "outros";
  return "outros";
}

interface FieldConfig {
  key: string;
  rd_source: string;
  rd_field_label: string;
  rd_field_aliases: string[];
  field_type: string;
  options: any;
}

function extractConfiguredFields(
  configs: FieldConfig[],
  dealCfs: any[],
  contactCfs: any[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of configs) {
    const sources = c.rd_source === "contact" ? [contactCfs] : c.rd_source === "deal" ? [dealCfs] : [dealCfs, contactCfs];
    const aliases = [c.rd_field_label, ...(c.rd_field_aliases || [])].filter(Boolean);
    const v = findCustomField(sources, aliases);
    if (v != null && String(v).trim() !== "") out[c.key] = String(v).trim();
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

/** Converte ISO timestamp para YYYY-MM-DD no fuso America/Sao_Paulo (BRT, UTC-3).
 *  Evita que vendas fechadas após 21h BRT sejam contadas no dia seguinte. */
function toBrtDateString(iso: string): string {
  const d = new Date(iso);
  // BRT é UTC-3 (sem horário de verão atualmente). Subtrai 3h e usa UTC.
  const shifted = new Date(d.getTime() - 3 * 3600 * 1000);
  return shifted.toISOString().split("T")[0];
}

// Métricas globais por execução
const metrics = { retries: 0, errors: 0, details: 0, contacts: 0 };

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
  let caller: any = null;

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
      service_user_id,
      cron_trigger,
      analytics_mode = false,
      start_date,
      end_date,
      max_deals = 1000,
      realtime = false,
      max_pages,
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

    // Service-role path (cron/orchestrator): trust supplied user_id when bearer matches SERVICE_ROLE_KEY
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isServiceCall = !!(cron_trigger && service_user_id && serviceKey && authHeader === `Bearer ${serviceKey}`);

    if (isServiceCall) {
      userId = String(service_user_id);
    } else {
      caller = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userRes } = await caller.auth.getUser();
      userId = userRes.user?.id || null;
      if (!userId) {
        return new Response(JSON.stringify({ error: "Usuário inválido" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    // Chamadas manuais usam o mesmo cliente com RLS da interface. Assim,
    // proprietários, masters e usuários explicitamente atribuídos enxergam
    // exatamente os mesmos funis aqui e na tela, sem ampliar acesso entre
    // clientes. O cron continua limitado ao owner informado pelo service role.
    const funnelQuery = (isServiceCall ? admin : caller!)
      .from("rd_funnels")
      .select("id, user_id, ad_account_id, rd_funnel_id, name")
      .eq("id", funnel_id);
    if (isServiceCall) funnelQuery.eq("user_id", userId);
    const { data: funnel } = await funnelQuery.maybeSingle();

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

    // Credenciais e registros sincronizados continuam pertencendo ao owner
    // original do vínculo, mesmo quando um master executa a manutenção.
    userId = String(funnel.user_id);

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
      trigger_source: isReprocess ? "reprocess" : (trigger_source || (realtime ? "auto_realtime" : "manual")),
    }).select("id").single();
    runId = runRow?.id || null;

    const { data: products } = await admin.from("products").select("id, name, tax_rate").eq("user_id", userId);
    const productList = products || [];

    const { data: fieldConfigsRows } = await admin
      .from("rd_field_configs")
      .select("key, rd_source, rd_field_label, rd_field_aliases, field_type, options")
      .eq("ad_account_id", funnel.ad_account_id);
    const fieldConfigs: FieldConfig[] = (fieldConfigsRows as any[]) || [];

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
          const isWon = Boolean(s?.win ?? s?.is_won ?? s?.won)
            || lname.includes("ganho") || lname.includes("venda real") || lname.includes("venda concl")
            || lname.includes("fechado ganho") || lname.includes("won") || lname.includes("cliente");
          const isLost = Boolean(s?.loss ?? s?.is_lost ?? s?.lost)
            || lname.includes("perdido") || lname.includes("perda") || lname.includes("lost");
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
      const amountTotal = parseFloat(d.amount_total || d.amount || "0") || 0;
      const stageName = d.deal_stage?.name || null;
      const stageId = d.deal_stage?.id ? String(d.deal_stage.id) : null;
      const won = Boolean(stageId && stageWonMap.get(stageId)) || isWonDeal(d);
      // A API do RD envia `win: false` também para negócios ainda abertos.
      // Portanto, perda só pode ser inferida pela etapa de perda ou por um
      // motivo de perda explícito; caso contrário o funil inteiro fica errado.
      const lost = !won && (Boolean(stageId && stageLostMap.get(stageId)) || d.deal_lost_reason != null);
      const bucket = bucketFromStage(stageName, won, lost);
      const lostReason = d.deal_lost_reason?.name || d.deal_lost_reason || null;

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
      const allCfSources = [dealCustomFields, contactCustomFields];

      const waPhone = phones?.[0]?.whatsapp_full_internacional || null;
      const contactState = contact.state || contact.address_state
        || findCustomField(allCfSources, ["state", "estado", "uf", "lead_state", "estadouf"])
        || phoneToUF(waPhone)
        || phoneToUF(contactPhone)
        || null;
      const contactCity = contact.city || contact.address_city
        || findCustomField(allCfSources, ["city", "cidade", "lead_city", "cidadelead"]) || null;

      const saleDate = d.closed_at
        ? toBrtDateString(d.closed_at)
        : toBrtDateString(new Date().toISOString());


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

      const cfSources = [dealCustomFields, contactCustomFields];
      const utms = d.utms || d.utm || baseContact?.utms || firstContact?.utms || d.deal_source || d.lead_origin || {};
      const pickUtm = (name: string, aliases: string[]) =>
        d[`utm_${name}`] || utms?.[name] || utms?.[`utm_${name}`] || findCustomField(cfSources, aliases);

      const utm_source   = pickUtm("source",   ["utmsource",   "utm_source",   "source",   "fonte"]) || null;
      const utm_medium   = pickUtm("medium",   ["utmmedium",   "utm_medium",   "medium",   "midia", "mídia"]) || null;
      const utm_campaign = pickUtm("campaign", ["utmcampaign", "utm_campaign", "campaign", "campanha"]) || null;
      const utm_term     = pickUtm("term",     ["utmterm",     "utm_term",     "term",     "termo"]) || null;
      const utm_content  = pickUtm("content",  ["utmcontent",  "utm_content",  "content",  "conteudo", "conteúdo"]) || null;

      const leadEntryDate = d.created_at
        ? new Date(d.created_at).toISOString().split("T")[0]
        : null;

      const dealOwnerName = d.user?.name || d.deal_user?.name || d.owner?.name || null;

      const customFieldsExtracted = extractConfiguredFields(fieldConfigs, dealCustomFields, contactCustomFields);

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
          stage_updated_at: d.updated_at || d.last_activity_at || null,
          closed_at: d.closed_at || null,
          raw: d,
          custom_fields: customFieldsExtracted,
        }, { onConflict: "user_id,rd_deal_id" });
      } catch (e) {
        console.log(`[rd_deals upsert] ${rdDealId} failed: ${(e as Error).message}`);
        metrics.errors++;
      }



      // A partir daqui só persistimos `sales` para deals ganhos.
      if (!won) return;

      const { data: existing } = await admin.from("sales")
        .select("id, payment_method, payment_method_source, notes, lead_state, lead_city, utm_source, utm_medium, utm_campaign, utm_term, utm_content, contact_name, contact_phone, contact_email, lead_entry_date")
        .eq("rd_deal_id", rdDealId).maybeSingle();

      const rdPayment = extractPaymentMethod([dealCustomFields, contactCustomFields]);

      // Constrói payload preservando valores manuais já preenchidos.
      // Regra: campos vindos do RD só são gravados quando o registro existente
      // estiver vazio. Pagamento: RD sobrescreve, exceto se usuário marcou manual.
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
        match_method: "rd_sync",
        campaign_ids: [],
        custom_fields: customFieldsExtracted,
      };

      if (existing) {
        const update: Record<string, any> = {
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
        if (rdPayment && (existing as any).payment_method_source !== "manual") {
          update.payment_method = rdPayment;
          update.payment_method_source = "rd";
        }
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
          payment_method: rdPayment ?? "pix",
          payment_method_source: rdPayment ? "rd" : "default",
          notes: null,
        });
        totalCreated++;
      }
    }

    async function persistAnalyticsBatch(items: any[]) {
      if (!items.length) return;
      const rows = items.map((d) => {
        const rdDealId = String(d.id || d._id);
        const stageName = d.deal_stage?.name || null;
        const stageId = d.deal_stage?.id ? String(d.deal_stage.id) : null;
        const won = Boolean(stageId && stageWonMap.get(stageId)) || isWonDeal(d);
        const lost = !won && (Boolean(stageId && stageLostMap.get(stageId)) || Boolean(d.deal_lost_reason));
        const baseContact = d.contact || d.deal_contact || {};
        const inlineContacts = asArray(d.contacts ?? d.set_contacts ?? d.deal_contacts);
        const inline = inlineContacts[0]?.contact || inlineContacts[0] || {};
        const contact = { ...inline, ...baseContact };
        const contactFields = contact.contact_custom_fields || [];
        const dealFields = d.deal_custom_fields || d.custom_fields || [];
        const contactState = contact.state || contact.address_state
          || findCustomField([dealFields, contactFields], ["state", "estado", "uf", "lead_state", "estadouf"])
          || null;
        const contactCity = contact.city || contact.address_city
          || findCustomField([dealFields, contactFields], ["city", "cidade", "lead_city", "cidadelead"])
          || null;
        const row: Record<string, unknown> = {
          user_id: userId!,
          ad_account_id: funnel!.ad_account_id,
          rd_funnel_id: funnel!.id,
          rd_deal_id: rdDealId,
          rd_stage_id: stageId,
          rd_stage_name: stageName,
          rd_stage_order: stageId && stageOrderMap.has(stageId) ? stageOrderMap.get(stageId) : null,
          stage_bucket: bucketFromStage(stageName, won, lost),
          win: won,
          amount_total: parseFloat(d.amount_total || d.amount || "0") || 0,
          lead_created_at: d.created_at || null,
          stage_updated_at: d.updated_at || d.stage_updated_at || null,
          closed_at: d.closed_at || null,
          raw: d,
        };
        if (contactState) row.lead_state = contactState;
        if (contactCity) row.lead_city = contactCity;
        if (contact.name || d.contact_name) row.contact_name = contact.name || d.contact_name;
        if (contact.email) row.contact_email = contact.email;
        if (d.deal_lost_reason?.name || d.deal_lost_reason) row.lost_reason = d.deal_lost_reason?.name || d.deal_lost_reason;
        if (d.user?.name || d.deal_user?.name || d.owner?.name) row.deal_owner_name = d.user?.name || d.deal_user?.name || d.owner?.name;
        if (d.deal_products?.[0]?.name) row.rd_product_name = d.deal_products[0].name;
        for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const) {
          if (d[key]) row[key] = d[key];
        }
        return row;
      });
      const { error } = await admin.from("rd_deals").upsert(rows, { onConflict: "user_id,rd_deal_id" });
      if (error) throw error;
      totalUpdated += rows.length;
    }

    const BATCH_SIZE = 2;
    const BATCH_PAUSE_MS = 400;

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
      const requestedPages = Number(max_pages);
      const maxPages = realtime
        ? Math.max(1, Math.min(Number.isFinite(requestedPages) ? requestedPages : 1, 3))
        : analytics_mode
          ? Math.max(1, Math.min(Number.isFinite(requestedPages) ? requestedPages : 50, 50))
          : 50;
      const startMs = start_date ? new Date(`${start_date}T00:00:00-03:00`).getTime() : null;
      const endMs = end_date ? new Date(`${end_date}T23:59:59.999-03:00`).getTime() : null;
      const maxAnalyticsDeals = Math.max(1, Math.min(Number(max_deals) || 10000, 10000));
      while (page <= maxPages) {
        const url = `https://crm.rdstation.com/api/v1/deals?token=${encodeURIComponent(token)}&deal_pipeline_id=${encodeURIComponent(funnel.rd_funnel_id)}&page=${page}&limit=200&order=created_at&direction=desc`;
        const r = await fetchWithRetry(url);
        if (!r.ok) {
          const txt = await r.text();
          await finishRun({ status: "failed", deals: totalDeals, created: totalCreated, updated: totalUpdated, skipped: totalSkipped, errorMessage: `RD API ${r.status}: ${txt.slice(0, 200)}`, funnelName: funnel.name });
          return new Response(JSON.stringify({ error: `RD API ${r.status}: ${txt.slice(0, 200)}`, page }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const payload = await r.json();
        const deals = payload.deals || payload || [];
        if (!Array.isArray(deals) || deals.length === 0) break;

        if (analytics_mode) {
          const rangedDeals = deals.filter((deal: any) => {
            const rawDate = deal.created_at || deal.updated_at;
            if (!rawDate) return true;
            const timestamp = new Date(rawDate).getTime();
            return (!startMs || timestamp >= startMs) && (!endMs || timestamp <= endMs);
          }).slice(0, Math.max(0, maxAnalyticsDeals - totalDeals));
          await persistAnalyticsBatch(rangedDeals);
          totalDeals += rangedDeals.length;

          const timestamps = deals
            .map((deal: any) => new Date(deal.created_at || deal.updated_at || 0).getTime())
            .filter((value: number) => Number.isFinite(value) && value > 0);
          const reachedOlderBoundary = Boolean(startMs && timestamps.some((value: number) => value < startMs));
          if (deals.length < 200 || totalDeals >= maxAnalyticsDeals || reachedOlderBoundary) break;
          page++;
          continue;
        }

        const realtimeLimit = Math.max(1, Math.min(Number(max_deals) || 60, 200));
        const dealsToProcess = realtime
          ? deals.slice(0, Math.max(0, realtimeLimit - totalDeals))
          : deals;
        totalDeals += dealsToProcess.length;

        for (let i = 0; i < dealsToProcess.length; i += BATCH_SIZE) {
          const batch = dealsToProcess.slice(i, i + BATCH_SIZE);
          const details = await Promise.all(batch.map(processDeal));
          for (const d of details) await persistDeal(d);
          await sleep(BATCH_PAUSE_MS);
        }

        if (deals.length < 200 || (realtime && totalDeals >= realtimeLimit)) break;
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
