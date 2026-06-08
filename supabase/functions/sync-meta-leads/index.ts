import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";

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
  raw: any;
};

const STATE_KEYS = ["state", "estado", "uf", "província", "provincia"];
const CITY_KEYS = ["city", "cidade", "municipio", "município"];
const EMAIL_KEYS = ["email", "e-mail", "e_mail"];
const PHONE_KEYS = ["phone_number", "phone", "telefone", "whatsapp", "celular", "número"];
const NAME_KEYS = ["full_name", "name", "nome", "nome completo"];

const NAME_TO_UF: Record<string, string> = {
  "acre":"AC","alagoas":"AL","amapa":"AP","amazonas":"AM","bahia":"BA","ceara":"CE",
  "distrito federal":"DF","espirito santo":"ES","goias":"GO","maranhao":"MA","mato grosso":"MT",
  "mato grosso do sul":"MS","minas gerais":"MG","para":"PA","paraiba":"PB","parana":"PR",
  "pernambuco":"PE","piaui":"PI","rio de janeiro":"RJ","rio grande do norte":"RN","rio grande do sul":"RS",
  "rondonia":"RO","roraima":"RR","santa catarina":"SC","sao paulo":"SP","sergipe":"SE","tocantins":"TO",
};

const DDD_TO_UF: Record<string, string> = {
  "11":"SP","12":"SP","13":"SP","14":"SP","15":"SP","16":"SP","17":"SP","18":"SP","19":"SP",
  "21":"RJ","22":"RJ","24":"RJ","27":"ES","28":"ES",
  "31":"MG","32":"MG","33":"MG","34":"MG","35":"MG","37":"MG","38":"MG",
  "41":"PR","42":"PR","43":"PR","44":"PR","45":"PR","46":"PR",
  "47":"SC","48":"SC","49":"SC","51":"RS","53":"RS","54":"RS","55":"RS",
  "61":"DF","62":"GO","64":"GO","63":"TO","65":"MT","66":"MT","67":"MS","68":"AC","69":"RO",
  "71":"BA","73":"BA","74":"BA","75":"BA","77":"BA","79":"SE",
  "81":"PE","87":"PE","82":"AL","83":"PB","84":"RN","85":"CE","88":"CE","86":"PI","89":"PI",
  "91":"PA","93":"PA","94":"PA","92":"AM","97":"AM","95":"RR","96":"AP","98":"MA","99":"MA",
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
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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

async function fetchAll(url: string, maxPages = 80): Promise<{ data: any[]; error?: string }> {
  const all: any[] = [];
  let next: string | undefined = url;
  let pages = 0;
  while (next && pages < maxPages) {
    const r = await fetch(next);
    const json = await r.json();
    if (json.error) return { data: all, error: json.error.message || String(json.error) };
    if (Array.isArray(json.data)) all.push(...json.data);
    next = json.paging?.next;
    pages++;
  }
  return { data: all };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
      const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      userId = user.id;
    }

    const adAccountId: string | undefined = body.ad_account_id || body.adAccountId;
    const days: number = Math.max(1, Math.min(90, Number(body.days ?? 7)));
    const since = Math.floor((Date.now() - days * 86400000) / 1000);

    let q = admin.from("ad_accounts").select("id,name,account_id,access_token,user_id");
    if (adAccountId) q = q.eq("id", adAccountId);
    if (userId) q = q.eq("user_id", userId);
    const { data: accounts, error: accErr } = await q;
    if (accErr) throw accErr;

    const accountResults: any[] = [];
    let totalUpserted = 0;

    for (const acc of accounts ?? []) {
      try {
        const token = acc.access_token as string;
        const raw = acc.account_id as string;
        const actId = raw.startsWith("act_") ? raw : `act_${raw}`;

        // Discover form_ids primarily via /leadgen_forms. The ads creative field is
        // unreliable across Meta API versions and was aborting the whole account.
        const adsUrl =
          `${GRAPH}/${actId}/ads?fields=id,adset_id,campaign_id&limit=200&access_token=${token}`;
        const adsRes = await fetchAll(adsUrl, 20);
        const formIds = new Set<string>();
        const discoveryWarnings: string[] = [];
        if (adsRes.error) discoveryWarnings.push(`ads: ${adsRes.error}`);
        // Also discover via /leadgen_forms on the account (covers forms not bound to specific ads)
        const formsUrl = `${GRAPH}/${actId}/leadgen_forms?fields=id&limit=200&access_token=${token}`;
        const formsRes = await fetchAll(formsUrl, 10);
        if (formsRes.error) discoveryWarnings.push(`forms: ${formsRes.error}`);
        for (const f of formsRes.data || []) {
          if (f?.id) formIds.add(String(f.id));
        }

        let leadsUpserted = 0;
        const formErrors: string[] = [];

        for (const formId of formIds) {
          const filtering = encodeURIComponent(JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]));
          const leadsUrl =
            `${GRAPH}/${formId}/leads?fields=id,created_time,ad_id,adset_id,campaign_id,form_id,field_data&limit=200&filtering=${filtering}&access_token=${token}`;
          const r = await fetchAll(leadsUrl, 50);
          if (r.error) {
            formErrors.push(`form ${formId}: ${r.error}`);
            continue;
          }
          const rows: LeadRow[] = r.data.map((l: any) => {
            const fd = l.field_data || [];
            const email = pickField(fd, EMAIL_KEYS);
            const phone = pickField(fd, PHONE_KEYS);
            const formState = normalizeUF(pickField(fd, STATE_KEYS));
            let state: string | null = formState;
            let source: string | null = formState ? "form" : null;
            if (!state) {
              const fromDDD = dddToUF(phone);
              if (fromDDD) { state = fromDDD; source = "ddd"; }
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
              raw: l,
            };
          });

          // Enrich rows still missing state via RD deals (match by email only — rd_deals has no phone column)
          const missing = rows.filter((x) => !x.lead_state && x.email);
          if (missing.length) {
            const emails = Array.from(new Set(missing.map((m) => m.email!.toLowerCase())));
            const rdMap = new Map<string, string>();
            const { data: rd } = await admin
              .from("rd_deals")
              .select("contact_email, lead_state")
              .in("contact_email", emails);
            for (const d of (rd || []) as any[]) {
              const uf = normalizeUF(d.lead_state);
              if (uf && d.contact_email) rdMap.set(String(d.contact_email).toLowerCase(), uf);
            }
            for (const row of missing) {
              const fromRd = row.email ? rdMap.get(row.email.toLowerCase()) : null;
              if (fromRd) { row.lead_state = fromRd; row.lead_state_source = "rd"; }
            }
          }


          for (let i = 0; i < rows.length; i += 500) {
            const chunk = rows.slice(i, i + 500);
            const { error: upErr } = await admin
              .from("meta_leads")
              .upsert(chunk, { onConflict: "meta_lead_id", ignoreDuplicates: false });
            if (upErr) {
              formErrors.push(`upsert form ${formId}: ${upErr.message}`);
              break;
            }
            leadsUpserted += chunk.length;
          }
        }

        totalUpserted += leadsUpserted;
        accountResults.push({
          account: acc.name,
          formsFound: formIds.size,
          leads: leadsUpserted,
          errors: [...discoveryWarnings, ...formErrors].length ? [...discoveryWarnings, ...formErrors] : undefined,
        });
      } catch (e) {
        accountResults.push({ account: acc.name, error: (e as Error).message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, upserted: totalUpserted, accounts: accountResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
