// Reconcile orphan sales: para cada `sale` cujo `rd_deal_id` não existe em
// `rd_deals`, busca o deal no RD Station CRM, popula `rd_deals` e completa
// os campos vazios em `sales` (lead_state, lead_city, contact_*).
//
// Roda no contexto do usuário autenticado (usa o token de integração dele).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function keyNorm(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}
function findCustomField(sources: any[], aliases: string[]): string | null {
  const wanted = aliases.map(keyNorm);
  for (const arr of sources) {
    if (!Array.isArray(arr)) continue;
    for (const f of arr) {
      const label = f?.custom_field?.label || f?.label || f?.custom_field_id?.label || f?.name || "";
      if (wanted.includes(keyNorm(label))) {
        const v = f?.value ?? f?.values ?? null;
        if (v == null) continue;
        if (Array.isArray(v)) return v[0] ? String(v[0]) : null;
        return String(v);
      }
    }
  }
  return null;
}
function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.replace(/\s*\[.*?\]\s*$/, "").trim();
  return c || null;
}
function firstString(...values: unknown[]): string | null {
  for (const v of values) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}
function asArray(v: unknown): any[] { return Array.isArray(v) ? v : []; }
function isWon(d: any) {
  if (d?.win === true) return true;
  const s = (d?.deal_stage?.name || "").toLowerCase();
  return s.includes("venda real") || s.includes("ganho") || s.includes("won") || s.includes("fechado");
}
function bucketFromStage(stageName: string | null | undefined, win: boolean, lost: boolean) {
  if (win) return "client";
  if (lost) return "lost";
  const s = (stageName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes("perdido") || s.includes("lost")) return "lost";
  if (s.includes("venda") || s.includes("ganho") || s.includes("cliente") || s.includes("fechado")) return "client";
  if (s.includes("oport") || s.includes("negoc") || s.includes("propos")) return "opportunity";
  if (s.includes("sql") || s.includes("qualif")) return "sql";
  if (s.includes("mql")) return "mql";
  return "lead";
}
function toBrtDateString(iso: string): string {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() - 3 * 3600 * 1000);
  return shifted.toISOString().split("T")[0];
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const limit = Math.min(Number(body?.limit) || 200, 500);

    // Token RD
    const { data: integration } = await admin
      .from("integrations")
      .select("api_token")
      .eq("user_id", userId)
      .eq("provider", "rd_station_crm")
      .eq("is_active", true)
      .maybeSingle();

    if (!integration?.api_token) {
      return new Response(JSON.stringify({ error: "RD Station CRM não conectado." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = integration.api_token;

    // Funis do usuário (para resolver rd_funnel_id quando faltar)
    const { data: funnelsData } = await admin
      .from("rd_funnels")
      .select("id, ad_account_id, rd_funnel_id, name")
      .eq("user_id", userId);
    const funnelById = new Map<string, any>();
    const funnelByAdAccount = new Map<string, any>();
    for (const f of funnelsData || []) {
      funnelById.set(f.id, f);
      if (!funnelByAdAccount.has(f.ad_account_id)) funnelByAdAccount.set(f.ad_account_id, f);
    }

    // Localiza vendas com rd_deal_id e faz anti-join client-side com rd_deals
    const { data: sales, error: salesErr } = await admin
      .from("sales")
      .select("id, rd_deal_id, ad_account_id, rd_funnel_id, lead_state, lead_city, contact_name, contact_phone, contact_email, utm_source, utm_medium, utm_campaign, utm_term, utm_content, sale_date")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .not("rd_deal_id", "is", null)
      .limit(2000);
    if (salesErr) throw salesErr;

    const dealIds = Array.from(new Set((sales || []).map((s) => s.rd_deal_id).filter(Boolean)));
    const existingSet = new Set<string>();
    if (dealIds.length > 0) {
      const chunk = 200;
      for (let i = 0; i < dealIds.length; i += chunk) {
        const slice = dealIds.slice(i, i + chunk);
        const { data: existing } = await admin
          .from("rd_deals")
          .select("rd_deal_id")
          .in("rd_deal_id", slice);
        for (const r of existing || []) existingSet.add(String(r.rd_deal_id));
      }
    }
    const orphans = (sales || []).filter((s) => !existingSet.has(String(s.rd_deal_id))).slice(0, limit);

    if (dryRun) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, orphans_total: orphans.length }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let dealsFetched = 0, dealsCreated = 0, salesUpdated = 0, notFound = 0, errors = 0;

    for (const sale of orphans) {
      const rdId = String(sale.rd_deal_id);
      const deal = await fetchJson(`https://crm.rdstation.com/api/v1/deals/${rdId}?token=${encodeURIComponent(token)}`);
      if (!deal || !deal.id) { notFound++; continue; }
      dealsFetched++;

      // Contacts
      let dealContacts: any[] = [];
      const cj = await fetchJson(`https://crm.rdstation.com/api/v1/deals/${rdId}/contacts?token=${encodeURIComponent(token)}`);
      if (cj) dealContacts = asArray(cj?.contacts ?? cj?.data ?? cj);

      // Enrich first contact if no name
      if (!dealContacts.some((c) => cleanName(c?.name))) {
        const inline = asArray(deal.contacts ?? deal.set_contacts ?? deal.deal_contacts);
        for (const c of inline.slice(0, 2)) {
          const cid = c?.id || c?._id || c?.contact?.id;
          if (!cid) continue;
          const r = await fetchJson(`https://crm.rdstation.com/api/v1/contacts/${cid}?token=${encodeURIComponent(token)}`);
          if (r) dealContacts.push(r);
        }
      }

      const baseContact = deal.contact || deal.deal_contact || {};
      const firstContact = dealContacts[0] || {};
      const inline = asArray(deal.contacts ?? deal.set_contacts ?? deal.deal_contacts)[0] || {};
      const nested = firstContact.contact || inline.contact || baseContact.contact || {};
      const phones = (baseContact.phones || firstContact.phones || nested.phones || inline.phones) || [];
      const emails = (baseContact.emails || firstContact.emails || nested.emails || inline.emails) || [];
      const contactName = cleanName(firstString(baseContact.name, firstContact.name, nested.name, inline.name, deal.name));
      const contactPhone = phones.length > 0 ? (phones[0]?.phone || phones[0] || null) : null;
      const contactEmail = emails.length > 0 ? (emails[0]?.email || emails[0] || null) : null;

      const dealCfs = deal.deal_custom_fields || deal.custom_fields || deal.cf_custom_fields || [];
      const contactCfs = firstContact?.contact_custom_fields || baseContact?.contact_custom_fields || [];
      const cfSources = [dealCfs, contactCfs];
      const contactState = baseContact.state || baseContact.address_state || firstContact.state || nested.state
        || findCustomField(cfSources, ["state", "estado", "uf", "lead_state"]) || null;
      const contactCity = baseContact.city || baseContact.address_city || firstContact.city || nested.city
        || findCustomField(cfSources, ["city", "cidade", "lead_city"]) || null;

      const utms = deal.utms || deal.utm || baseContact?.utms || firstContact?.utms || {};
      const pick = (n: string, aliases: string[]) =>
        deal[`utm_${n}`] || utms?.[n] || utms?.[`utm_${n}`] || findCustomField(cfSources, aliases);
      const utm_source   = pick("source",   ["utmsource", "source", "fonte"]) || null;
      const utm_medium   = pick("medium",   ["utmmedium", "medium", "midia"]) || null;
      const utm_campaign = pick("campaign", ["utmcampaign", "campaign", "campanha"]) || null;
      const utm_term     = pick("term",     ["utmterm", "term", "termo"]) || null;
      const utm_content  = pick("content",  ["utmcontent", "content", "conteudo"]) || null;

      const won = isWon(deal);
      const lost = deal.win === false || (deal.deal_lost_reason != null && !won);
      const stageName = deal.deal_stage?.name || null;
      const stageId = deal.deal_stage?.id ? String(deal.deal_stage.id) : null;

      // Resolve ad_account/funnel
      let funnel = sale.rd_funnel_id ? funnelById.get(sale.rd_funnel_id) : null;
      if (!funnel) funnel = funnelByAdAccount.get(sale.ad_account_id);
      if (!funnel) {
        // último recurso: qualquer funil do usuário
        funnel = (funnelsData || [])[0];
      }
      if (!funnel) { errors++; continue; }

      const amountTotal = parseFloat(deal.amount_total || deal.amount || "0") || 0;

      // Upsert rd_deals
      const { error: upErr } = await admin.from("rd_deals").upsert({
        user_id: userId,
        ad_account_id: funnel.ad_account_id,
        rd_funnel_id: funnel.id,
        rd_deal_id: rdId,
        rd_stage_id: stageId,
        rd_stage_name: stageName,
        deal_owner_name: deal.user?.name || deal.deal_user?.name || null,
        rd_product_name: deal.deal_products?.[0]?.name || null,
        stage_bucket: bucketFromStage(stageName, won, lost),
        win: won,
        lost_reason: deal.deal_lost_reason?.name || deal.deal_lost_reason || null,
        amount_total: amountTotal,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        contact_name: contactName,
        contact_email: contactEmail,
        lead_state: contactState,
        lead_city: contactCity,
        lead_created_at: deal.created_at || null,
        stage_updated_at: deal.updated_at || deal.last_activity_at || null,
        closed_at: deal.closed_at || null,
        raw: deal,
      }, { onConflict: "user_id,rd_deal_id" });
      if (upErr) { console.error("rd_deals upsert err", upErr.message); errors++; continue; }
      dealsCreated++;

      // Completa sales (apenas campos vazios)
      const preserve = (cur: any, inc: any) => (cur != null && cur !== "" ? cur : (inc ?? null));
      const update: Record<string, any> = {
        lead_state: preserve(sale.lead_state, contactState),
        lead_city: preserve(sale.lead_city, contactCity),
        contact_name: preserve(sale.contact_name, contactName),
        contact_phone: preserve(sale.contact_phone, contactPhone),
        contact_email: preserve(sale.contact_email, contactEmail),
        utm_source: preserve(sale.utm_source, utm_source),
        utm_medium: preserve(sale.utm_medium, utm_medium),
        utm_campaign: preserve(sale.utm_campaign, utm_campaign),
        utm_term: preserve(sale.utm_term, utm_term),
        utm_content: preserve(sale.utm_content, utm_content),
        rd_funnel_id: sale.rd_funnel_id || funnel.id,
      };
      // Recalcula sale_date só se ela bater com a regra antiga (UTC) — opcional; deixamos quieto.
      if (deal.closed_at) {
        update.sale_date = toBrtDateString(deal.closed_at);
      }
      const { error: sErr } = await admin.from("sales").update(update).eq("id", sale.id);
      if (sErr) { console.error("sales update err", sErr.message); errors++; continue; }
      salesUpdated++;

      await sleep(150);
    }

    return new Response(JSON.stringify({
      ok: true,
      orphans_processed: orphans.length,
      deals_fetched: dealsFetched,
      deals_upserted: dealsCreated,
      sales_updated: salesUpdated,
      not_found: notFound,
      errors,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("reconcile-sales-rd error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
