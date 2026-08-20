import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function mapPaymentMethod(option?: string | null): string | null {
  if (!option) return null;
  const o = String(option).toLowerCase();
  if (o.includes("prepay") || o.includes("pre_pay") || o.includes("pre-pay") || o.includes("prepaid") || o.includes("funding"))
    return "Saldo pré-pago";
  if (o.includes("manual") || o.includes("pix") || o.includes("boleto") || o.includes("bank"))
    return "Pagamento manual";
  if (o.includes("auto") || o.includes("card") || o.includes("credit") || o.includes("debit"))
    return "Cartão";
  return option;
}

function parseAmount(amountObj: any): number {
  if (amountObj == null) return 0;
  // Meta returns: { currency, total, total_cents } where total is already in major currency unit (e.g. "2400.00")
  if (typeof amountObj === "object") {
    if (amountObj.total != null) {
      const n = Number(String(amountObj.total).replace(",", "."));
      if (isFinite(n)) return n;
    }
    if (amountObj.total_cents != null) {
      const n = Number(amountObj.total_cents);
      if (isFinite(n)) return n / 100;
    }
    if (amountObj.value != null) {
      const n = Number(String(amountObj.value).replace(",", "."));
      if (isFinite(n)) return n;
    }
  }
  const n = Number(String(amountObj).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
}

async function fetchTransactions(metaAccountId: string, token: string, sinceUnix: number) {
  const all: any[] = [];
  const graphBase = `https://graph.facebook.com/${Deno.env.get("META_GRAPH_API_VERSION") || "v25.0"}`;
  let url: string | null =
    `${graphBase}/${metaAccountId}/transactions` +
    `?fields=id,time,billing_reason,payment_option,status,amount,vat,provider_amount,billing_period,app_amount` +
    `&since=${sinceUnix}&limit=200&access_token=${token}`;
  let pages = 0;
  while (url && pages < 15) {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || "Meta API error");
    if (Array.isArray(json.data)) all.push(...json.data);
    url = json.paging?.next ?? null;
    pages++;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    // A service-role bearer is reserved for trusted cron/orchestrator calls.
    // Every other caller must present a valid user session.
    const isService = Boolean(bearer && bearer === supabaseServiceKey);
    let userId: string | null = null;
    if (!isService) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Sessão inválida" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    // Permite forçar uma conta específica via body
    let onlyAccountId: string | null = null;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body?.ad_account_id) onlyAccountId = String(body.ad_account_id);
      }
    } catch (_) {}

    let delegatedIds = new Set<string>();
    let activeWorkspaces = new Set<string>();
    let isMaster = false;
    if (!isService && userId) {
      const { data: memberships } = await admin
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId)
        .eq("status", "active");
      const { data: delegated } = await admin
        .from("user_ad_account_access")
        .select("ad_account_id")
        .eq("user_id", userId);
      const { data: master } = await admin.rpc("is_master", { _user_id: userId });
      activeWorkspaces = new Set((memberships ?? []).map((m: any) => String(m.workspace_id)));
      delegatedIds = new Set((delegated ?? []).map((a: any) => String(a.ad_account_id)));
      isMaster = master === true;
    }

    let q = admin.from("ad_accounts").select("id, account_id, name, access_token, user_id, workspace_id");
    if (onlyAccountId) q = q.eq("id", onlyAccountId);
    else if (!isService && userId && !isMaster) {
      const safeDelegatedIds = Array.from(delegatedIds).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
      q = safeDelegatedIds.length
        ? q.or(`user_id.eq.${userId},id.in.(${safeDelegatedIds.join(",")})`)
        : q.eq("user_id", userId);
    }
    const { data: accounts, error: accErr } = await q;
    if (accErr) throw accErr;
    let authorizedAccounts = accounts ?? [];
    if (!isService && userId) {
      authorizedAccounts = authorizedAccounts.filter((account: any) => {
        const workspaceAllowed = !account.workspace_id || activeWorkspaces.has(String(account.workspace_id));
        const owns = account.user_id === userId;
        return isMaster || (workspaceAllowed && (owns || delegatedIds.has(String(account.id))));
      });
      if (onlyAccountId && authorizedAccounts.length === 0) {
        return new Response(JSON.stringify({ error: "Conta não autorizada" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (authorizedAccounts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No accounts", upserted: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Últimos 180 dias
    const sinceUnix = Math.floor((Date.now() - 180 * 24 * 60 * 60 * 1000) / 1000);
    let totalUpserted = 0;
    const errors: string[] = [];
    const perAccount: Record<string, number> = {};

    for (const acc of authorizedAccounts) {
      try {
        const raw = acc.account_id;
        const metaId = raw.startsWith("act_") ? raw : `act_${raw}`;
        const txs = await fetchTransactions(metaId, acc.access_token, sinceUnix);
        console.log(`[${acc.name}] fetched ${txs.length} transactions from Meta`);
        if (txs.length === 0) {
          perAccount[acc.name] = 0;
          continue;
        }

        const rows = txs.map((t: any) => {
          const amount = parseAmount(t.amount);
          const currency = (typeof t.amount === "object" && t.amount?.currency) || null;
          const timeIso = t.time
            ? new Date(typeof t.time === "number" ? t.time * 1000 : t.time).toISOString()
            : new Date().toISOString();
          return {
            id: String(t.id),
            ad_account_id: acc.id,
            time: timeIso,
            amount: isFinite(amount) ? amount : 0,
            currency,
            status: t.status ?? null,
            payment_method: mapPaymentMethod(t.payment_option),
            billing_reason: t.billing_reason ?? null,
            reference: t.id ?? null,
            raw: t,
            updated_at: new Date().toISOString(),
          };
        });

        const chunk = 200;
        for (let i = 0; i < rows.length; i += chunk) {
          const slice = rows.slice(i, i + chunk);
          const { error } = await admin
            .from("account_transactions")
            .upsert(slice, { onConflict: "id" });
          if (error) {
            errors.push(`${acc.name}: ${error.message}`);
          } else {
            totalUpserted += slice.length;
          }
        }
        perAccount[acc.name] = rows.length;
        console.log(`[${acc.name}] upserted ${rows.length} transactions`);
      } catch (e) {
        const msg = (e as Error).message;
        console.error(`[${acc.name}] error:`, msg);
        errors.push(`${acc.name}: ${msg}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, upserted: totalUpserted, perAccount, errors: errors.length ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sync-meta-transactions error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
