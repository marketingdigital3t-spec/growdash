import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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
    let accountsQuery = supabaseAdmin.from("ad_accounts").select("id, account_id, name, access_token");
    if (userId) {
      accountsQuery = accountsQuery.eq("user_id", userId);
    }
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
        const url = `https://graph.facebook.com/v21.0/${metaAccountId}?fields=balance,spend_cap,amount_spent,funding_source_details&access_token=${accessToken}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
          const msg = data.error.message || "Erro desconhecido da Meta";
          const code = typeof data.error.code === "number" ? data.error.code : null;
          errors.push(`${account.name}: ${msg}`);
          await supabaseAdmin
            .from("ad_accounts")
            .update({
              connection_status: "disconnected",
              last_sync_error: msg,
              last_sync_error_code: code,
              last_sync_attempt_at: attemptedAt,
            })
            .eq("id", account.id);
          continue;
        }

        // Log ALL fields returned by Meta for debugging
        console.log(`${account.name}: Meta API raw response:`, JSON.stringify(data, null, 2));

        let remainingBalance: number | null = null;

        // Priority 1: Parse funding_source_details.display_string which shows the REAL balance
        // Format: "Saldo disponível (R$130,94 BRL)" or similar
        if (data.funding_source_details?.display_string) {
          const displayStr = data.funding_source_details.display_string;
          // Extract numeric value: matches patterns like R$130,94 or R$1.130,94
          const match = displayStr.match(/R\$\s*([\d.,]+)/);
          if (match) {
            // Convert Brazilian format (1.234,56) to number
            const valueStr = match[1].replace(/\./g, '').replace(',', '.');
            remainingBalance = parseFloat(valueStr);
            console.log(`${account.name}: parsed from display_string "${displayStr}" = R$ ${remainingBalance}`);
          }
        }

        // Fallback: spend_cap - amount_spent
        if (remainingBalance === null && data.spend_cap && data.amount_spent) {
          const spendCap = Number(data.spend_cap);
          const amountSpent = Number(data.amount_spent);
          if (spendCap > 0) {
            remainingBalance = (spendCap - amountSpent) / 100;
            console.log(`${account.name}: using spend_cap - amount_spent = ${remainingBalance}`);
          }
        }

        // Last fallback: balance field
        if (remainingBalance === null && data.balance !== undefined) {
          remainingBalance = Math.abs(Number(data.balance)) / 100;
          console.log(`${account.name}: using balance field = ${remainingBalance}`);
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
            .eq("id", account.id);

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
            .eq("id", account.id);
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
          .eq("id", account.id);
      }
    }

    console.log(`Balance sync complete: ${updated}/${accounts.length} updated`);

    return new Response(
      JSON.stringify({ success: true, updated, total: accounts.length, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Balance sync error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
