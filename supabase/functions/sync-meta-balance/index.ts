import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { classifySyncErrorCode, SYNC_ERROR_CODES } from "../../../src/lib/syncContract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function statusForMetaError(code: number | null): "expired" | "error" | "unknown" {
  if (code === 190) return "expired";
  if (code === 10 || code === 100 || code === 200) return "error";
  return "unknown";
}

function parseMoney(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/R\$\s*([\d.,]+)/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: { adAccountId?: string; adAccountIds?: string[] } = {};
    try { body = await req.json(); } catch { /* empty body means all authorized accounts */ }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const graphBase = `https://graph.facebook.com/${Deno.env.get("META_GRAPH_API_VERSION") || "v25.0"}`;

    // Require either a valid user JWT or the service-role key (used by pg_cron).
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isServiceRole = bearer.length > 0 && bearer === supabaseServiceKey;

    let userId: string | null = null;
    if (!isServiceRole) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing auth" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    // Fetch accounts: if user authenticated, only their accounts; otherwise (cron) all
    // A manual deactivation is authoritative. Balance sync must not even
    // fetch, update, or reactivate accounts marked as disconnected.
    let accountsQuery = supabaseAdmin.from("ad_accounts").select("id, account_id, name, access_token, connection_status").neq("connection_status", "disconnected");
    if (userId) {
      accountsQuery = accountsQuery.eq("user_id", userId);
    }
    if (body.adAccountId) accountsQuery = accountsQuery.eq("id", body.adAccountId);
    else if (Array.isArray(body.adAccountIds) && body.adAccountIds.length > 0) accountsQuery = accountsQuery.in("id", body.adAccountIds);
    const { data: accounts, error: accError } = await accountsQuery;
    if (accError) throw accError;

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No accounts found", updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updated = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      const attemptedAt = new Date().toISOString();
      try {
        const rawAccountId = account.account_id;
        const metaAccountId = rawAccountId.startsWith("act_") ? rawAccountId : `act_${rawAccountId}`;
        const accessToken = account.access_token;

        // Fetch account balance info from Meta API with all relevant financial fields
        const url = `${graphBase}/${metaAccountId}?fields=balance,spend_cap,amount_spent,funding_source_details&access_token=${accessToken}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
          const msg = data.error.message || "Erro desconhecido da Meta";
          const code = typeof data.error.code === "number" ? data.error.code : null;
          errors.push(`${account.name}: ${msg}`);
          await supabaseAdmin
            .from("ad_accounts")
            .update({
              // A failed balance request is not proof that the operator
              // disconnected the account. Preserve a diagnosable status so
              // configuration/permission errors such as Meta #200 are not
              // presented as a manual disconnect.
              connection_status: statusForMetaError(code),
              last_sync_error: msg,
              last_sync_error_code: code,
              last_sync_attempt_at: attemptedAt,
            })
            .eq("id", account.id)
            .neq("connection_status", "disconnected");
          continue;
        }

        let remainingBalance: number | null = null;

        // Some Meta responses expose the available amount in the funding
        // label. Only accept labels that explicitly say "available"/"saldo
        // disponível"; a generic R$ value can be the payment threshold or
        // amount due and must never drive a low-balance alert.
        if (remainingBalance === null && data.funding_source_details?.display_string) {
          const displayStr = String(data.funding_source_details.display_string);
          if (/saldo\s+dispon[ií]vel|available\s+balance/i.test(displayStr)) {
            remainingBalance = parseMoney(displayStr);
            if (remainingBalance !== null) console.log(`${account.name}: parsed available balance from funding_source_details = ${remainingBalance}`);
          }
        }

        // Do not persist `balance`: Meta documents it as the bill amount due.
        // Keeping the last reliable snapshot is safer than replacing it with
        // a payable amount and falsely declaring the account out of funds.
        if (remainingBalance === null) {
          console.log(`${account.name}: no reliable available-balance field; clearing stale snapshot`);
          await supabaseAdmin
            .from("ad_accounts")
            .update({
              remaining_balance: null,
              connection_status: "connected",
              last_sync_error: null,
              last_sync_error_code: null,
              last_sync_attempt_at: attemptedAt,
              last_sync_success_at: attemptedAt,
            })
            .eq("id", account.id)
            .neq("connection_status", "disconnected");
          continue;
        }

        if (remainingBalance !== null) {
          // Read previous balance to detect top-ups
          const { data: prev } = await supabaseAdmin
            .from("ad_accounts")
            .select("remaining_balance")
            .eq("id", account.id)
            .maybeSingle();
          const prevBalance = prev?.remaining_balance != null ? Number(prev.remaining_balance) : null;

          const { error: updateError } = await supabaseAdmin
            .from("ad_accounts")
            .update({
              remaining_balance: remainingBalance,
              connection_status: "connected",
              last_sync_error: null,
              last_sync_error_code: null,
              last_sync_attempt_at: attemptedAt,
              last_sync_success_at: attemptedAt,
            })
            .eq("id", account.id)
            .neq("connection_status", "disconnected");

          if (updateError) {
            errors.push(`${account.name}: update failed - ${updateError.message}`);
          } else {
            console.log(`${account.name}: balance updated to R$ ${remainingBalance.toFixed(2)}`);
            updated++;

            // Detect top-up: balance increased by > R$ 0.50 (ignore noise)
            if (prevBalance != null && remainingBalance - prevBalance > 0.5) {
              const delta = remainingBalance - prevBalance;
              await supabaseAdmin.from("account_balance_events").insert({
                ad_account_id: account.id,
                delta,
                new_balance: remainingBalance,
                source: "meta_sync",
              });
              console.log(`${account.name}: detected top-up of R$ ${delta.toFixed(2)}`);
            }
          }
        } else {
          console.log(`${account.name}: no balance data available`);
          await supabaseAdmin
            .from("ad_accounts")
            .update({
              connection_status: "connected",
              last_sync_error: null,
              last_sync_error_code: null,
              last_sync_attempt_at: attemptedAt,
              last_sync_success_at: attemptedAt,
            })
            .eq("id", account.id)
            .neq("connection_status", "disconnected");
        }
      } catch (e) {
        const msg = (e as Error).message;
        errors.push(`${account.name}: ${msg}`);
        await supabaseAdmin
          .from("ad_accounts")
          .update({
            connection_status: "unknown",
            last_sync_error: msg,
            last_sync_attempt_at: attemptedAt,
          })
          .eq("id", account.id)
          .neq("connection_status", "disconnected");
      }
    }

    console.log(`Balance sync complete: ${updated}/${accounts.length} updated`);

    return new Response(
      JSON.stringify({ success: errors.length === 0, updated, total: accounts.length, errors: errors.length > 0 ? errors : undefined }),
      { status: errors.length ? 207 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Balance sync error:", e);
    const errorCode = classifySyncErrorCode(e);
    return new Response(
      JSON.stringify({ error: (e as Error).message, error_code: errorCode, retryable: [SYNC_ERROR_CODES.PROVIDER_TIMEOUT, SYNC_ERROR_CODES.PROVIDER_UNAVAILABLE].includes(errorCode) }),
      { status: errorCode === SYNC_ERROR_CODES.PROVIDER_TIMEOUT ? 504 : errorCode === SYNC_ERROR_CODES.PROVIDER_UNAVAILABLE ? 503 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
