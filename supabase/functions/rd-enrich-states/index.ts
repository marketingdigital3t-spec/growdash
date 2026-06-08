// Enrich rd_deals.lead_state for deals missing state by re-fetching contacts from RD CRM.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function keyNorm(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
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

function pickRawPhone(raw: any): string | null {
  if (!raw) return null;
  const candidates = [
    raw.contact, raw.deal_contact,
    ...(Array.isArray(raw.contacts) ? raw.contacts : []),
    ...(Array.isArray(raw._contacts) ? raw._contacts : []),
    ...(Array.isArray(raw.set_contacts) ? raw.set_contacts : []),
    ...(Array.isArray(raw.deal_contacts) ? raw.deal_contacts : []),
  ].filter(Boolean);
  for (const c of candidates) {
    const phones = c?.phones || c?.contact?.phones || [];
    if (Array.isArray(phones)) {
      for (const p of phones) {
        const v = p?.whatsapp_full_internacional || p?.phone || (typeof p === "string" ? p : null);
        if (v) return String(v);
      }
    }
    const direct = c?.phone || c?.mobile_phone;
    if (direct) return String(direct);
  }
  // Last resort: scan raw text for any Brazilian phone-like pattern
  try {
    const text = JSON.stringify(raw);
    const m = text.match(/(?:\+?55)?[\s\-\(]*(1[1-9]|2[1-489]|3[1-58]|4[1-9]|5[1-5]|6[1-9]|7[1-9]|8[1-9]|9[1-9])[\)\s\-]*9?\d{4}[\s\-]?\d{4}/);
    if (m) return m[0];
  } catch {}
  return null;
}

function findCustomField(sources: any[], aliases: string[]): string | null {
  const wanted = aliases.map(keyNorm);
  for (const arr of sources) {
    if (!Array.isArray(arr)) continue;
    for (const f of arr) {
      const label = f?.custom_field?.label || f?.label || f?.name || "";
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url: string, attempts = 3): Promise<any | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      if ([429, 500, 502, 503, 504].includes(r.status) && i < attempts - 1) {
        await sleep(500 * (i + 1) ** 2);
        continue;
      }
      return null;
    } catch {
      if (i === attempts - 1) return null;
      await sleep(500);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: ue } = await anon.auth.getUser();
    if (ue || !userData?.user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = userData.user.id;
    const admin = createClient(url, serviceKey);

    const { data: integ } = await admin
      .from("integrations").select("api_token")
      .eq("user_id", userId).eq("provider", "rd_station_crm").eq("is_active", true).maybeSingle();
    if (!integ?.api_token) return new Response(JSON.stringify({ error: "RD CRM token not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = integ.api_token;

    // Fetch up to 800 deals missing state (multiple runs if needed for larger backlogs)
    const { data: deals, error } = await admin
      .from("rd_deals")
      .select("id, rd_deal_id, raw")
      .eq("user_id", userId)
      .is("lead_state", null)
      .limit(800);
    if (error) throw error;

    let enriched = 0;
    let skipped = 0;
    let viaDDD = 0;
    let viaApi = 0;

    for (const d of (deals || []) as any[]) {
      let raw = d.raw || null;

      // ---------- Fast path: infer UF from any phone already present in raw ----------
      const fastPhone = pickRawPhone(raw);
      const fastUF = phoneToUF(fastPhone);
      if (fastUF) {
        await admin.from("rd_deals").update({ lead_state: fastUF }).eq("id", d.id);
        await admin.from("sales").update({ lead_state: fastUF }).eq("rd_deal_id", d.rd_deal_id).is("lead_state", null);
        enriched++; viaDDD++;
        continue;
      }

      // ---------- Slow path: fetch from RD CRM ----------
      // If we don't even have a raw payload, fetch the deal first so we can find a contact
      if (!raw) {
        const dealJson = await fetchJson(`https://crm.rdstation.com/api/v1/deals/${d.rd_deal_id}?token=${encodeURIComponent(token)}`);
        if (dealJson) {
          raw = dealJson;
          await admin.from("rd_deals").update({ raw }).eq("id", d.id);
          // Retry DDD inference with the freshly fetched payload
          const uf2 = phoneToUF(pickRawPhone(raw));
          if (uf2) {
            await admin.from("rd_deals").update({ lead_state: uf2 }).eq("id", d.id);
            await admin.from("sales").update({ lead_state: uf2 }).eq("rd_deal_id", d.rd_deal_id).is("lead_state", null);
            enriched++; viaDDD++;
            await sleep(120);
            continue;
          }
        }
      }

      const candidates = [
        raw?.contact, raw?.deal_contact,
        ...(Array.isArray(raw?.contacts) ? raw.contacts : []),
        ...(Array.isArray(raw?.set_contacts) ? raw.set_contacts : []),
        ...(Array.isArray(raw?.deal_contacts) ? raw.deal_contacts : []),
        ...(Array.isArray(raw?._contacts) ? raw._contacts : []),
      ].filter(Boolean);
      let cid = candidates.map((c: any) => c?.id || c?._id || c?.contact?.id || c?.contact_id).find(Boolean);

      if (!cid) {
        const dc = await fetchJson(`https://crm.rdstation.com/api/v1/deals/${d.rd_deal_id}/contacts?token=${encodeURIComponent(token)}`);
        const arr = (dc?.contacts ?? dc?.data ?? dc) || [];
        const first = Array.isArray(arr) ? arr[0] : null;
        cid = first?.id || first?._id;
      }
      if (!cid) { skipped++; await sleep(120); continue; }

      const contact = await fetchJson(`https://crm.rdstation.com/api/v1/contacts/${cid}?token=${encodeURIComponent(token)}`);
      if (!contact) { skipped++; await sleep(120); continue; }
      const state = contact.state || contact.address_state
        || findCustomField([contact.contact_custom_fields || contact.custom_fields], ["state", "estado", "uf", "lead_state", "estadouf"])
        || phoneToUF(contact.phone || contact.mobile_phone || contact.phones?.[0]?.phone || contact.phones?.[0]?.whatsapp_full_internacional || pickRawPhone(raw)) || null;
      const city = contact.city || contact.address_city
        || findCustomField([contact.contact_custom_fields || contact.custom_fields], ["city", "cidade", "lead_city"]) || null;
      if (!state && !city) { skipped++; await sleep(120); continue; }
      await admin.from("rd_deals").update({ lead_state: state, lead_city: city }).eq("id", d.id);
      if (state || city) {
        const patch: Record<string, any> = {};
        if (state) patch.lead_state = state;
        if (city) patch.lead_city = city;
        await admin.from("sales").update(patch).eq("rd_deal_id", d.rd_deal_id).is("lead_state", null);
      }
      enriched++; viaApi++;
      await sleep(120);
    }

    return new Response(JSON.stringify({ ok: true, processed: deals?.length || 0, enriched, skipped, viaDDD, viaApi }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
