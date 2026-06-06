import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** YYYY-MM-DD no fuso America/Sao_Paulo (BRT, UTC-3). */
function toBrtDateString(iso: string): string {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() - 3 * 3600 * 1000);
  return shifted.toISOString().split("T")[0];
}

/** Normalize a string for fuzzy matching: remove brackets, accents, extra spaces */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/\[.*?\]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    console.log("RD CRM webhook received:", JSON.stringify(payload).slice(0, 500));

    const eventName = payload.event_name || payload.event;

    if (eventName === "crm_deal_deleted") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const doc = payload.document || payload.deal || payload;
    if (!doc || !doc.id) {
      return new Response(JSON.stringify({ error: "Invalid payload: missing document.id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter by pipeline — only process "Instituto Carla Rezende"
    const pipeline = doc.deal_pipeline || doc.pipeline || {};
    const pipelineName = (pipeline.name || "").toLowerCase();
    console.log("Deal pipeline:", pipeline.name || "unknown");
    if (!pipelineName.includes("instituto carla rezende")) {
      console.log("Skipping deal from pipeline:", pipeline.name);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "wrong pipeline" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only process won deals
    const isWon = doc.win === true;
    const stageName = (doc.deal_stage?.name || "").toLowerCase();
    const isWonByStage = stageName.includes("venda realizada") || stageName.includes("ganho") || stageName.includes("won") || stageName.includes("fechado");

    if (!isWon && !isWonByStage) {
      console.log("Skipping deal — not won. Stage:", doc.deal_stage?.name || "unknown", "win:", doc.win);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "deal not won" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find active integration — webhook secret is REQUIRED and must match.
    const webhookSecret = req.headers.get("x-webhook-secret") || null;
    if (!webhookSecret) {
      console.warn("Rejecting RD webhook: missing x-webhook-secret header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: integrations, error: intError } = await supabase
      .from("integrations")
      .select("*")
      .eq("provider", "rd_station_crm")
      .eq("is_active", true);

    if (intError || !integrations || integrations.length === 0) {
      console.error("No active RD Station integration found:", intError);
      return new Response(JSON.stringify({ error: "No active integration found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const integration = integrations.find((i: any) => i.webhook_secret && i.webhook_secret === webhookSecret);
    if (!integration) {
      console.warn("Rejecting RD webhook: webhook_secret does not match any active integration");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = integration.user_id;
    const rdDealId = String(doc.id);
    const amountTotal = parseFloat(doc.amount_total || doc.amount || "0") || 0;

    // Contact info
    const contact = doc.contact || {};
    const rawName = contact.name || doc.name || null;
    const contactName = rawName ? rawName.replace(/\s*\[.*?\]\s*$/, "").trim() : null;
    const contactEmail = contact.emails?.length > 0 ? contact.emails[0]?.email : "";
    const phoneObj = contact.phones?.[0] || {};
    const contactPhone = phoneObj.phone || phoneObj.whatsapp_full_internacional || null;
    const phoneToUF = (p: string | null): string | null => {
      if (!p) return null;
      let d = String(p).replace(/\D/g, "");
      if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
      if (d.length < 10) return null;
      const M: Record<string,string> = {"11":"SP","12":"SP","13":"SP","14":"SP","15":"SP","16":"SP","17":"SP","18":"SP","19":"SP","21":"RJ","22":"RJ","24":"RJ","27":"ES","28":"ES","31":"MG","32":"MG","33":"MG","34":"MG","35":"MG","37":"MG","38":"MG","41":"PR","42":"PR","43":"PR","44":"PR","45":"PR","46":"PR","47":"SC","48":"SC","49":"SC","51":"RS","53":"RS","54":"RS","55":"RS","61":"DF","62":"GO","64":"GO","63":"TO","65":"MT","66":"MT","67":"MS","68":"AC","69":"RO","71":"BA","73":"BA","74":"BA","75":"BA","77":"BA","79":"SE","81":"PE","87":"PE","82":"AL","83":"PB","84":"RN","85":"CE","88":"CE","86":"PI","89":"PI","91":"PA","93":"PA","94":"PA","92":"AM","97":"AM","95":"RR","96":"AP","98":"MA","99":"MA"};
      return M[d.slice(0,2)] || null;
    };
    const contactState = contact.state || contact.address_state || phoneToUF(phoneObj.whatsapp_full_internacional) || phoneToUF(contactPhone) || null;
    const contactCity = contact.city || contact.address_city || null;
    const notes = [contactEmail].filter(Boolean).join(" | ") || null;

    // Sale date = closed_at
    const saleDate = doc.closed_at
      ? toBrtDateString(doc.closed_at)
      : toBrtDateString(new Date().toISOString());


    // === PRODUCT MATCHING (improved) ===
    let productId: string | null = null;
    let rdProductName: string | null = null;

    if (doc.deal_products && doc.deal_products.length > 0) {
      rdProductName = doc.deal_products[0].name || null;
    }

    if (rdProductName) {
      const normalized = normalize(rdProductName);
      console.log("RD product name (raw):", rdProductName, "| normalized:", normalized);

      // Fetch all products for this user
      const { data: userProducts } = await supabase
        .from("products")
        .select("id, name")
        .eq("user_id", userId);

      if (userProducts && userProducts.length > 0) {
        // Try exact normalized match first
        let match = userProducts.find((p) => normalize(p.name) === normalized);

        // Try partial match: check if normalized product name contains key words
        if (!match) {
          if (normalized.includes("online")) {
            match = userProducts.find((p) => normalize(p.name).includes("online"));
          } else if (normalized.includes("presencial")) {
            match = userProducts.find((p) => normalize(p.name).includes("presencial"));
          }
        }

        // Try if any product name is contained in the RD product name
        if (!match) {
          match = userProducts.find((p) => normalized.includes(normalize(p.name)));
        }

        if (match) {
          productId = match.id;
          console.log("Product matched:", match.name, match.id);
        } else {
          console.log("No product match found for:", rdProductName);
        }
      }
    }

    // Tax calculation
    let taxAmount = 0;
    let netRevenue = amountTotal;
    if (productId) {
      const { data: product } = await supabase
        .from("products")
        .select("tax_rate")
        .eq("id", productId)
        .single();
      if (product?.tax_rate) {
        taxAmount = amountTotal * (product.tax_rate / 100);
        netRevenue = amountTotal - taxAmount;
      }
    }

    // === CAMPAIGN (region/turma from RD — NOT Meta Ads campaigns) ===
    let rdCampaignName: string | null = null;

    const campaignSource = doc.campaign?.name
      || (typeof doc.campaign === "string" ? doc.campaign : null)
      || doc.deal_source?.name
      || (typeof doc.deal_source === "string" ? doc.deal_source : null)
      || null;

    if (campaignSource) {
      rdCampaignName = campaignSource;
      console.log("RD campaign/region:", campaignSource);
    }

    // === UTM extraction & campaign matching ===
    const cf = doc.cf_custom_fields || doc.custom_fields || [];
    const cfMap: Record<string, string> = {};
    if (Array.isArray(cf)) cf.forEach((f: any) => { if (f?.custom_field_id?.label) cfMap[String(f.custom_field_id.label).toLowerCase()] = f.value; if (f?.label) cfMap[String(f.label).toLowerCase()] = f.value; });
    const utms = doc.utms || doc.utm || contact.utms || {};
    const getUtm = (k: string) => utms?.[k] || utms?.[`utm_${k}`] || cfMap[`utm_${k}`] || cfMap[k] || null;
    const utm_source = getUtm("source");
    const utm_medium = getUtm("medium");
    const utm_campaign = getUtm("campaign");
    const utm_content = getUtm("content");
    const utm_term = getUtm("term");

    let matched_campaign_id: string | null = null;
    let match_method: string | null = null;
    let rd_funnel_id_resolved: string | null = null;
    const adAccountIdFixed = "2e3aedf0-5934-4d13-a44b-962c8ff6587a";

    if (utm_campaign) {
      const { data: byId } = await supabase.from("campaigns").select("id, ad_account_id").eq("id", String(utm_campaign)).maybeSingle();
      if (byId) { matched_campaign_id = byId.id; match_method = "utm_id"; }
    }

    if (!matched_campaign_id) {
      const { data: funnels } = await supabase.from("rd_funnels").select("id, ad_account_id, rd_funnel_id, utm_campaign_pattern, is_active").eq("user_id", userId).eq("is_active", true);
      const funnelList = funnels || [];
      if (utm_campaign) {
        const m = funnelList.find((f) => {
          if (!f.utm_campaign_pattern) return false;
          const pat = f.utm_campaign_pattern.toLowerCase();
          const val = String(utm_campaign).toLowerCase();
          if (pat.includes("*")) {
            const re = new RegExp("^" + pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
            return re.test(val);
          }
          return val === pat || val.includes(pat);
        });
        if (m) { rd_funnel_id_resolved = m.id; match_method = "utm_pattern"; }
      }
      if (!rd_funnel_id_resolved) {
        const rdFunnelFromPayload = doc.deal_pipeline?.id || doc.funnel?.id || cfMap["funil"] || null;
        if (rdFunnelFromPayload) {
          const m = funnelList.find((f) => f.rd_funnel_id && String(f.rd_funnel_id) === String(rdFunnelFromPayload));
          if (m) { rd_funnel_id_resolved = m.id; match_method = "funnel_default"; }
        }
      }
    }

    const saleData: Record<string, any> = {
      user_id: userId,
      rd_deal_id: rdDealId,
      ad_account_id: adAccountIdFixed,
      gross_revenue: amountTotal,
      net_revenue: netRevenue,
      tax_amount: taxAmount,
      status: "confirmed",
      sale_date: saleDate,
      notes,
      lead_state: contactState,
      lead_city: contactCity,
      contact_name: contactName,
      contact_phone: contactPhone,
      product_id: productId,
      quantity: doc.deal_products?.length || 1,
      rd_product_name: rdProductName,
      rd_campaign_name: rdCampaignName,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      matched_campaign_id,
      rd_funnel_id: rd_funnel_id_resolved,
      match_method,
      campaign_ids: matched_campaign_id ? [matched_campaign_id] : [],
    };

    // Upsert by rd_deal_id
    const { data: existing } = await supabase
      .from("sales")
      .select("id")
      .eq("rd_deal_id", rdDealId)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from("sales")
        .update(saleData)
        .eq("rd_deal_id", rdDealId)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from("sales")
        .insert(saleData)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    console.log("Sale upserted:", result.id);

    // === Record touch in rd_deal_touches (multi-touch attribution) ===
    try {
      if (utm_source || utm_campaign || utm_medium) {
        const touchAt = new Date().toISOString();
        const { data: lastTouch } = await supabase
          .from("rd_deal_touches")
          .select("utm_source, utm_medium, utm_campaign, touch_order")
          .eq("rd_deal_id", rdDealId)
          .order("touch_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        const norm = (s: any) => (s ?? "").toString().toLowerCase().trim();
        const isSame = lastTouch
          && norm(lastTouch.utm_source) === norm(utm_source)
          && norm(lastTouch.utm_medium) === norm(utm_medium)
          && norm(lastTouch.utm_campaign) === norm(utm_campaign);

        if (!isSame) {
          const nextOrder = (lastTouch?.touch_order ?? 0) + 1;

          // Mark previous touches as not last
          if (lastTouch) {
            await supabase.from("rd_deal_touches").update({ is_last: false }).eq("rd_deal_id", rdDealId);
          }

          await supabase.from("rd_deal_touches").insert({
            rd_deal_id: rdDealId,
            ad_account_id: adAccountIdFixed,
            user_id: userId,
            touch_at: touchAt,
            utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            matched_campaign_id,
            touch_order: nextOrder,
            is_first: nextOrder === 1,
            is_last: true,
            source: "webhook",
          });

          // Update aggregates on rd_deals
          const { data: firstTouchRow } = await supabase
            .from("rd_deal_touches")
            .select("utm_campaign")
            .eq("rd_deal_id", rdDealId)
            .order("touch_order", { ascending: true })
            .limit(1)
            .maybeSingle();

          await supabase.from("rd_deals").update({
            first_touch_utm_campaign: firstTouchRow?.utm_campaign ?? utm_campaign,
            last_touch_utm_campaign: utm_campaign,
            touch_count: nextOrder,
          }).eq("rd_deal_id", rdDealId);
        }
      }
    } catch (touchErr) {
      console.error("Touch recording error (non-fatal):", touchErr);
    }



    return new Response(JSON.stringify({ ok: true, sale_id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error processing RD webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
