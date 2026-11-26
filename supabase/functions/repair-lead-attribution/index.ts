import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { secretsMatch } from "../_shared/secretsMatch.ts";
import {
  normalizeMetaPlatform,
  normalizeMetaPlacement,
} from "../_shared/metaDeliveryNormalization.ts";
import { syncMetaLeadToRD, syncRDDealToMeta } from "../_shared/metaLeadRdSync.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const cronSecret = Deno.env.get("DAILY_RECONCILIATION_CRON_SECRET") || Deno.env.get("CRON_SECRET");
  const isService = Boolean(bearer && secretsMatch(bearer, SERVICE_ROLE));
  const isCron = Boolean(cronSecret && secretsMatch(req.headers.get("x-cron-secret"), cronSecret));

  let callerUserId: string | null = null;
  if (!isService && !isCron) {
    const caller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    callerUserId = user.id;
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(1, Number(body.limit || 100)), 500);
  const days = Math.min(Math.max(1, Number(body.days || 90)), 365);
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  let metaLeadsRepaired = 0;
  let crmLeadsRepaired = 0;
  let dealsLinked = 0;
  let dealsRepaired = 0;

  // 1) Reparar e normalizar meta_leads antigos
  const { data: rawMetaLeads } = await admin
    .from("meta_leads")
    .select("meta_lead_id,platform,placement,ad_id,adset_id,campaign_id,ad_name,adset_name,campaign_name,raw")
    .gte("created_time", cutoff)
    .limit(limit);

  for (const lead of rawMetaLeads || []) {
    const raw = (lead.raw as any) || {};
    const rawPlat = lead.platform || raw.platform || raw.site_source_name || raw.publisher_platform;
    const rawPlace = lead.placement || raw.placement || raw.platform_position;
    const normalizedPlat = normalizeMetaPlatform(rawPlat) || "Meta Ads";
    const normalizedPlace = normalizeMetaPlacement(rawPlace);

    const patch: Record<string, unknown> = {};
    if (lead.platform !== normalizedPlat) patch.platform = normalizedPlat;
    if (normalizedPlace && lead.placement !== normalizedPlace) patch.placement = normalizedPlace;

    // Hidratação via catálogo se faltar nome mas existir ID
    if (lead.ad_id && !lead.ad_name) {
      const { data: adRow } = await admin.from("ads").select("name,adset_id").eq("id", lead.ad_id).maybeSingle();
      if (adRow?.name) {
        patch.ad_name = adRow.name;
        if (!lead.adset_id && adRow.adset_id) patch.adset_id = adRow.adset_id;
      }
    }
    if (lead.adset_id && !lead.adset_name) {
      const { data: adsetRow } = await admin.from("adsets").select("name,campaign_id").eq("id", lead.adset_id).maybeSingle();
      if (adsetRow?.name) {
        patch.adset_name = adsetRow.name;
        if (!lead.campaign_id && adsetRow.campaign_id) patch.campaign_id = adsetRow.campaign_id;
      }
    }
    if (lead.campaign_id && !lead.campaign_name) {
      const { data: campRow } = await admin.from("campaigns").select("name").eq("id", lead.campaign_id).maybeSingle();
      if (campRow?.name) patch.campaign_name = campRow.name;
    }

    if (Object.keys(patch).length > 0) {
      await admin.from("meta_leads").update(patch).eq("meta_lead_id", lead.meta_lead_id);
      metaLeadsRepaired++;
    }
  }

  // 2) Reparar e normalizar crm_leads
  const { data: rawCrmLeads } = await admin
    .from("crm_leads")
    .select("id,platform,placement,payload")
    .gte("created_at", cutoff)
    .limit(limit);

  for (const crmLead of rawCrmLeads || []) {
    const payload = (crmLead.payload as any) || {};
    const normalizedPlat = normalizeMetaPlatform(crmLead.platform || payload.platform || payload.site_source_name) || (crmLead.platform ? "Meta Ads" : null);
    const normalizedPlace = normalizeMetaPlacement(crmLead.placement || payload.placement || payload.platform_position);
    const patch: Record<string, unknown> = {};
    if (normalizedPlat && crmLead.platform !== normalizedPlat) patch.platform = normalizedPlat;
    if (normalizedPlace && crmLead.placement !== normalizedPlace) patch.placement = normalizedPlace;
    if (Object.keys(patch).length > 0) {
      await admin.from("crm_leads").update(patch).eq("id", crmLead.id);
      crmLeadsRepaired++;
    }
  }

  // 3) Reconciliar leads Meta não vinculados com negociações do RD Station
  const { data: unlinkedLeads } = await admin
    .from("meta_leads")
    .select("meta_lead_id")
    .gte("created_time", cutoff)
    .order("created_time", { ascending: false })
    .limit(Math.min(limit, 100));

  for (const lead of unlinkedLeads || []) {
    const { data: deal } = await admin
      .from("rd_deals")
      .select("id")
      .eq("meta_lead_id", lead.meta_lead_id)
      .maybeSingle();
    if (!deal) {
      const syncRes = await syncMetaLeadToRD(admin, String(lead.meta_lead_id));
      if (syncRes.status === "written") dealsLinked++;
    }
  }

  // 4) Reparar rd_deals existentes normalizando platform/placement e preenchendo "Meta Ads"
  let dealsQuery = admin
    .from("rd_deals")
    .select("id,meta_lead_id,meta_platform,meta_placement,meta_attribution_method,meta_ad_id,meta_campaign_name")
    .gte("created_at", cutoff)
    .limit(limit);

  if (callerUserId) {
    dealsQuery = dealsQuery.eq("user_id", callerUserId);
  }

  const { data: dealsToRepair } = await dealsQuery;

  for (const deal of dealsToRepair || []) {
    const hasMeta = Boolean(deal.meta_lead_id || deal.meta_ad_id || deal.meta_attribution_method || deal.meta_campaign_name);
    const normalizedPlat = normalizeMetaPlatform(deal.meta_platform) || (hasMeta ? "Meta Ads" : null);
    const normalizedPlace = normalizeMetaPlacement(deal.meta_placement);
    const patch: Record<string, unknown> = {};
    if (normalizedPlat && deal.meta_platform !== normalizedPlat) patch.meta_platform = normalizedPlat;
    if (normalizedPlace && deal.meta_placement !== normalizedPlace) patch.meta_placement = normalizedPlace;
    if (Object.keys(patch).length > 0) {
      await admin.from("rd_deals").update(patch).eq("id", deal.id);
      dealsRepaired++;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      status: "success",
      days,
      metaLeadsRepaired,
      crmLeadsRepaired,
      dealsLinked,
      dealsRepaired,
      totalRepaired: metaLeadsRepaired + crmLeadsRepaired + dealsRepaired,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
