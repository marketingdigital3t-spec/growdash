import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Standard Meta pixel events → action_type mapping (Meta Marketing API)
const STANDARD_EVENT_MAP: Record<string, string> = {
  Lead: "offsite_conversion.fb_pixel_lead",
  CompleteRegistration: "offsite_conversion.fb_pixel_complete_registration",
  Purchase: "offsite_conversion.fb_pixel_purchase",
  AddToCart: "offsite_conversion.fb_pixel_add_to_cart",
  InitiateCheckout: "offsite_conversion.fb_pixel_initiate_checkout",
  ViewContent: "offsite_conversion.fb_pixel_view_content",
  Search: "offsite_conversion.fb_pixel_search",
  AddPaymentInfo: "offsite_conversion.fb_pixel_add_payment_info",
  Contact: "offsite_conversion.fb_pixel_contact",
  Subscribe: "offsite_conversion.fb_pixel_subscribe",
  StartTrial: "offsite_conversion.fb_pixel_start_trial",
  SubmitApplication: "offsite_conversion.fb_pixel_submit_application",
  Schedule: "offsite_conversion.fb_pixel_schedule",
  AddToWishlist: "offsite_conversion.fb_pixel_add_to_wishlist",
  PageView: "offsite_conversion.fb_pixel_page_view",
};

const FRIENDLY_PT: Record<string, string> = {
  Lead: "Lead",
  CompleteRegistration: "Cadastro completo",
  Purchase: "Compra",
  AddToCart: "Adicionar ao carrinho",
  InitiateCheckout: "Iniciar checkout",
  ViewContent: "Visualização de conteúdo",
  Search: "Pesquisa",
  AddPaymentInfo: "Adicionar pagamento",
  Contact: "Contato",
  Subscribe: "Assinar",
  StartTrial: "Iniciar avaliação",
  SubmitApplication: "Enviar inscrição",
  Schedule: "Agendar",
  AddToWishlist: "Lista de desejos",
  PageView: "Visualização de página",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}
    const adAccountId: string | undefined = body.adAccountId;

    let q = supabaseUser.from("ad_accounts").select("id, name, account_id, access_token");
    if (adAccountId) q = q.eq("id", adAccountId);
    const { data: accounts, error: accErr } = await q;
    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ pixels: 0, events: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let pixelCount = 0;
    let eventCount = 0;
    const errors: string[] = [];

    for (const acc of accounts) {
      const meta = acc.account_id.startsWith("act_") ? acc.account_id : `act_${acc.account_id}`;
      try {
        // 1) List pixels/datasets in this ad account
        const pxUrl = `https://graph.facebook.com/v21.0/${meta}/adspixels?fields=id,name&access_token=${acc.access_token}`;
        const pxRes = await fetch(pxUrl);
        const pxJson = await pxRes.json();
        if (pxJson.error) {
          errors.push(`${acc.name}: ${pxJson.error.message}`);
          continue;
        }
        const pixels = (pxJson.data || []) as { id: string; name: string }[];

        for (const px of pixels) {
          // upsert pixel
          const { data: pxRow, error: upErr } = await supabaseAdmin
            .from("ad_account_pixel")
            .upsert(
              { ad_account_id: acc.id, pixel_id: px.id, name: px.name, last_synced_at: new Date().toISOString() },
              { onConflict: "ad_account_id,pixel_id" }
            )
            .select("id")
            .single();
          if (upErr || !pxRow) { errors.push(`pixel ${px.id}: ${upErr?.message}`); continue; }
          pixelCount++;

          const events: { event_name: string; action_type: string; is_custom: boolean }[] = [];

          // 2a) Pixel stats → which standard events have fired
          try {
            const statsUrl = `https://graph.facebook.com/v21.0/${px.id}/stats?aggregation=event&access_token=${acc.access_token}`;
            const statsRes = await fetch(statsUrl);
            const statsJson = await statsRes.json();
            const seen = new Set<string>();
            for (const row of (statsJson.data || []) as any[]) {
              const ev = row.event;
              if (!ev || seen.has(ev)) continue;
              seen.add(ev);
              const action_type = STANDARD_EVENT_MAP[ev] || `offsite_conversion.fb_pixel_${ev.toLowerCase()}`;
              events.push({ event_name: FRIENDLY_PT[ev] || ev, action_type, is_custom: false });
            }
            // Always include Lead as a fallback option
            if (!seen.has("Lead")) {
              events.push({ event_name: "Lead", action_type: STANDARD_EVENT_MAP.Lead, is_custom: false });
            }
          } catch (e) {
            console.log(`stats failed for ${px.id}: ${e}`);
            events.push({ event_name: "Lead", action_type: STANDARD_EVENT_MAP.Lead, is_custom: false });
          }

          // 2b) Custom conversions on this pixel
          try {
            const ccUrl = `https://graph.facebook.com/v21.0/${meta}/customconversions?fields=id,name,custom_event_type,pixel&limit=200&access_token=${acc.access_token}`;
            const ccRes = await fetch(ccUrl);
            const ccJson = await ccRes.json();
            for (const cc of (ccJson.data || []) as any[]) {
              // Filter to this pixel if pixel info present
              const ccPixelId = cc.pixel?.id || cc.pixel_id;
              if (ccPixelId && ccPixelId !== px.id) continue;
              events.push({
                event_name: `${cc.name} (personalizado)`,
                action_type: `offsite_conversion.custom.${cc.id}`,
                is_custom: true,
              });
            }
          } catch (e) {
            console.log(`customconversions failed for ${meta}: ${e}`);
          }

          // Replace pixel_event rows for this pixel
          await supabaseAdmin.from("pixel_event").delete().eq("pixel_id", pxRow.id);
          if (events.length > 0) {
            const rows = events.map((e) => ({ pixel_id: pxRow.id, ...e }));
            const { error: evErr } = await supabaseAdmin.from("pixel_event").insert(rows);
            if (evErr) errors.push(`events ${px.id}: ${evErr.message}`);
            else eventCount += events.length;
          }
        }
      } catch (e) {
        errors.push(`${acc.name}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({ pixels: pixelCount, events: eventCount, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
