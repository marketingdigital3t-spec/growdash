import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function keyNorm(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function mapDataType(dt: string): "enum" | "number" {
  const t = (dt || "").toLowerCase();
  if (t === "int" || t === "integer" || t === "dec" || t === "decimal" || t === "float" || t === "number") return "number";
  return "enum";
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr.filter((x) => x != null && x !== "")));
}

interface RDField {
  _id?: string;
  id?: string;
  label?: string;
  custom_field_for?: string; // "deal" | "contact" | "organization"
  type?: string; // "list", "multiple", "text", ...
  data_type?: string;
  valid_options?: Array<{ label?: string; value?: string } | string>;
  options?: Array<{ label?: string; value?: string } | string>;
  presentation_type?: string;
}

async function fetchRDCustomFields(token: string): Promise<RDField[]> {
  const all: RDField[] = [];
  for (let page = 1; page <= 10; page++) {
    const url = `https://crm.rdstation.com/api/v1/custom_fields?token=${encodeURIComponent(token)}&page=${page}&limit=200`;
    const r = await fetch(url);
    if (!r.ok) {
      console.log(`[rd-discover] /custom_fields page ${page} status=${r.status}`);
      break;
    }
    const json = await r.json();
    const items: RDField[] = Array.isArray(json) ? json : (json.custom_fields || json.data || []);
    if (!items || items.length === 0) break;
    all.push(...items);
    if (items.length < 50) break;
  }
  return all;
}

async function observedValuesFromDeals(admin: any, adAccountId: string) {
  // sample last 500 deals' raw to capture custom field usage
  const { data: deals } = await admin
    .from("rd_deals")
    .select("raw")
    .eq("ad_account_id", adAccountId)
    .order("updated_at", { ascending: false })
    .limit(500);
  const dealMap = new Map<string, { label: string; values: Set<string>; source: "deal" | "contact" }>();
  for (const d of deals || []) {
    const raw = d.raw || {};
    const dealCfs = Array.isArray(raw.deal_custom_fields) ? raw.deal_custom_fields : [];
    const contactCfs: any[] = [];
    const contacts = Array.isArray(raw.contacts) ? raw.contacts : [];
    for (const c of contacts) {
      if (Array.isArray(c?.contact_custom_fields)) contactCfs.push(...c.contact_custom_fields);
    }
    const collect = (arr: any[], source: "deal" | "contact") => {
      for (const f of arr) {
        const label = f?.custom_field?.label || f?.label || f?.name || "";
        if (!label) continue;
        const k = `${source}:${keyNorm(label)}`;
        const cur = dealMap.get(k) || { label, values: new Set<string>(), source };
        let v = f?.value ?? f?.values ?? null;
        if (Array.isArray(v)) v = v[0];
        if (v != null && v !== "") cur.values.add(String(v));
        dealMap.set(k, cur);
      }
    };
    collect(dealCfs, "deal");
    collect(contactCfs, "contact");
  }
  return dealMap;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const adAccountId: string | undefined = body?.ad_account_id;
    if (!adAccountId) {
      return new Response(JSON.stringify({ error: "ad_account_id obrigatório" }), {
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
    const userId = userRes.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find account owner to fetch integration token
    const { data: account } = await admin
      .from("ad_accounts")
      .select("id, user_id")
      .eq("id", adAccountId)
      .maybeSingle();
    if (!account) {
      return new Response(JSON.stringify({ error: "Conta não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: integration } = await admin
      .from("integrations")
      .select("api_token")
      .eq("user_id", account.user_id)
      .eq("provider", "rd_station_crm")
      .eq("is_active", true)
      .maybeSingle();

    const token = integration?.api_token;

    // 1) Existing configs to preserve user choices
    const { data: existingConfigs } = await admin
      .from("rd_field_configs")
      .select("*")
      .eq("ad_account_id", adAccountId);
    const existingByKey = new Map<string, any>();
    for (const c of existingConfigs || []) existingByKey.set(c.key, c);

    // 2) Pull RD official fields (if token available)
    let rdFields: RDField[] = [];
    if (token) {
      try {
        rdFields = await fetchRDCustomFields(token);
      } catch (e) {
        console.log("[rd-discover] error fetching /custom_fields", e);
      }
    }

    // 3) Observed in already-synced deals
    const observed = await observedValuesFromDeals(admin, adAccountId);

    // 4) Build discovery map: key -> { label, source, type, options, aliases }
    type Discovered = {
      key: string;
      label: string;
      source: "deal" | "contact";
      type: "enum" | "number";
      options: Array<{ label: string; value?: string; min?: number | null; max?: number | null }>;
      aliases: string[];
    };
    const discoveredMap = new Map<string, Discovered>();

    for (const f of rdFields) {
      const label = (f.label || "").trim();
      if (!label) continue;
      const rawSource = (f.custom_field_for || "deal").toLowerCase();
      const source: "deal" | "contact" = rawSource === "contact" ? "contact" : "deal";
      const dt = mapDataType(f.data_type || f.type || "");
      const optsRaw = (f.valid_options || f.options || []) as any[];
      const opts = optsRaw.map((o: any) => {
        const optLabel = typeof o === "string" ? o : (o?.label || o?.value || "");
        const optValue = typeof o === "string" ? o : (o?.value ?? o?.label ?? "");
        return { label: String(optLabel), value: String(optValue) };
      }).filter((o) => o.label);
      const key = slugify(label);
      if (!key) continue;
      discoveredMap.set(key, {
        key,
        label,
        source,
        type: dt,
        options: opts,
        aliases: uniq([label, f._id || f.id || ""].filter(Boolean) as string[]),
      });
    }

    // Merge observed (only adds fields RD endpoint did not return; enrich values)
    for (const [obsKey, obs] of observed.entries()) {
      const [source, _norm] = obsKey.split(":") as ["deal" | "contact", string];
      const key = slugify(obs.label);
      if (!key) continue;
      const cur = discoveredMap.get(key);
      if (cur) {
        // Enrich enum options with observed values when missing
        if (cur.type === "enum" && cur.options.length === 0) {
          cur.options = Array.from(obs.values).slice(0, 20).map((v) => ({ label: v, value: v }));
        }
        cur.aliases = uniq([...cur.aliases, obs.label]);
        continue;
      }
      // Infer type: if all values are numeric → number; else enum
      const values = Array.from(obs.values);
      const allNum = values.length > 0 && values.every((v) => /^[\d.,\s$rR\$kKmM]+$/.test(v) && /\d/.test(v));
      const type: "enum" | "number" = allNum ? "number" : "enum";
      discoveredMap.set(key, {
        key,
        label: obs.label,
        source,
        type,
        options: type === "enum" ? values.slice(0, 20).map((v) => ({ label: v, value: v })) : [],
        aliases: [obs.label],
      });
    }

    // 5) Upsert preserving user choices
    let created = 0, updated = 0;
    for (const disc of discoveredMap.values()) {
      const existing = existingByKey.get(disc.key);
      if (existing) {
        const mergedAliases = uniq([...(existing.rd_field_aliases || []), ...disc.aliases]);
        const preserveNumberOpts =
          existing.field_type === "number" &&
          Array.isArray(existing.options) &&
          existing.options.some((o: any) => o?.min != null || o?.max != null);
        const nextOptions = preserveNumberOpts ? existing.options : (disc.options.length ? disc.options : existing.options);
        const { error } = await admin.from("rd_field_configs").update({
          label: existing.label || disc.label,
          rd_field_label: disc.label,
          rd_field_aliases: mergedAliases,
          rd_source: existing.rd_source || disc.source,
          field_type: existing.field_type || disc.type,
          options: nextOptions,
        }).eq("id", existing.id);
        if (!error) updated++;
      } else {
        const { error } = await admin.from("rd_field_configs").insert({
          user_id: account.user_id,
          ad_account_id: adAccountId,
          key: disc.key,
          label: disc.label,
          rd_source: disc.source,
          rd_field_label: disc.label,
          rd_field_aliases: disc.aliases,
          field_type: disc.type,
          options: disc.options,
          show_in_dashboard: false,
        });
        if (!error) created++;
      }
    }

    await admin.from("ad_accounts").update({
      rd_fields_last_discovered_at: new Date().toISOString(),
    }).eq("id", adAccountId);

    return new Response(JSON.stringify({
      discovered: discoveredMap.size,
      created,
      updated,
      had_token: !!token,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[rd-discover] fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
