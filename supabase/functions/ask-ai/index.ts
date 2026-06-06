import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function fmtBRL(n: number) {
  return `R$ ${(Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { question, history } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Question required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve user accounts
    const { data: accounts } = await admin
      .from("ad_accounts")
      .select("id, account_id, name, daily_budget, remaining_balance, target_cpl, min_spend_threshold")
      .eq("user_id", user.id);

    const accountIds = (accounts || []).map((a) => a.id);
    const today = new Date();
    const since = new Date(today.getTime() - 30 * 86400000);
    const sinceStr = since.toISOString().slice(0, 10);

    // Campaigns
    const { data: campaigns } = await admin
      .from("campaigns")
      .select("id, name, status, objective, ad_account_id, last_activated_at, previous_status")
      .in("ad_account_id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"]);

    const campaignIds = (campaigns || []).map((c) => c.id);

    // Targets
    const { data: targets } = await admin
      .from("campaign_targets")
      .select("campaign_id, target_cpl")
      .in("campaign_id", campaignIds.length ? campaignIds : ["x"]);

    // Insights last 30d aggregated by campaign via ads/adsets
    const { data: adsets } = await admin
      .from("adsets")
      .select("id, campaign_id, name, status")
      .in("campaign_id", campaignIds.length ? campaignIds : ["x"]);
    const adsetToCampaign = new Map<string, string>();
    (adsets || []).forEach((a) => adsetToCampaign.set(a.id, a.campaign_id));

    const { data: ads } = await admin
      .from("ads")
      .select("id, name, adset_id, status")
      .in("adset_id", (adsets || []).map((a) => a.id).length ? (adsets || []).map((a) => a.id) : ["x"]);
    const adToCampaign = new Map<string, string>();
    const adInfo = new Map<string, { name: string; adset_id: string; status: string | null }>();
    (ads || []).forEach((a) => {
      const cid = adsetToCampaign.get(a.adset_id);
      if (cid) adToCampaign.set(a.id, cid);
      adInfo.set(a.id, { name: a.name, adset_id: a.adset_id, status: a.status });
    });

    const adIds = Array.from(adInfo.keys());
    const { data: insights } = await admin
      .from("insights")
      .select("ad_id, date, spend, impressions, clicks, leads, ctr, cpl, frequency")
      .gte("date", sinceStr)
      .in("ad_id", adIds.length ? adIds : ["x"]);

    // Aggregate by campaign
    const byCampaign = new Map<string, { spend: number; impressions: number; clicks: number; leads: number; days: Set<string> }>();
    const byAd = new Map<string, { spend: number; impressions: number; clicks: number; leads: number }>();
    (insights || []).forEach((r) => {
      const cid = adToCampaign.get(r.ad_id);
      if (cid) {
        const c = byCampaign.get(cid) || { spend: 0, impressions: 0, clicks: 0, leads: 0, days: new Set() };
        c.spend += Number(r.spend) || 0;
        c.impressions += Number(r.impressions) || 0;
        c.clicks += Number(r.clicks) || 0;
        c.leads += Number(r.leads) || 0;
        c.days.add(r.date);
        byCampaign.set(cid, c);
      }
      const a = byAd.get(r.ad_id) || { spend: 0, impressions: 0, clicks: 0, leads: 0 };
      a.spend += Number(r.spend) || 0;
      a.impressions += Number(r.impressions) || 0;
      a.clicks += Number(r.clicks) || 0;
      a.leads += Number(r.leads) || 0;
      byAd.set(r.ad_id, a);
    });

    const campaignSummary = (campaigns || []).map((c) => {
      const m = byCampaign.get(c.id) || { spend: 0, impressions: 0, clicks: 0, leads: 0, days: new Set() };
      const cpl = m.leads > 0 ? m.spend / m.leads : 0;
      const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
      const target = (targets || []).find((t) => t.campaign_id === c.id)?.target_cpl;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        last_activated_at: c.last_activated_at,
        spend_30d: Math.round(m.spend * 100) / 100,
        leads_30d: m.leads,
        cpl_30d: Math.round(cpl * 100) / 100,
        ctr_30d: Math.round(ctr * 100) / 100,
        active_days_with_data: m.days.size,
        target_cpl: target ?? null,
      };
    });

    // Top ads by leads and worst by CPL
    const adRanking = Array.from(byAd.entries())
      .map(([id, m]) => {
        const info = adInfo.get(id);
        return {
          ad_id: id,
          name: info?.name,
          status: info?.status,
          spend: Math.round(m.spend * 100) / 100,
          leads: m.leads,
          cpl: m.leads > 0 ? Math.round((m.spend / m.leads) * 100) / 100 : null,
          ctr: m.impressions > 0 ? Math.round((m.clicks / m.impressions) * 10000) / 100 : 0,
        };
      })
      .filter((a) => a.spend > 0);
    const topAdsByLeads = [...adRanking].sort((a, b) => b.leads - a.leads).slice(0, 10);
    const worstAdsByCpl = [...adRanking].filter((a) => a.cpl != null && a.leads > 0).sort((a, b) => (b.cpl! - a.cpl!)).slice(0, 5);
    const adsBurningNoLeads = [...adRanking].filter((a) => a.leads === 0 && a.spend >= 30).sort((a, b) => b.spend - a.spend).slice(0, 5);

    // Sales last 30d
    const { data: sales } = await admin
      .from("sales")
      .select("id, sale_date, gross_revenue, net_revenue, status, ad_account_id, campaign_ids, matched_campaign_id, rd_funnel_id, utm_source, utm_campaign, lead_state, lead_formation, rd_product_name")
      .eq("user_id", user.id)
      .gte("sale_date", sinceStr);

    const salesAgg = (sales || []).reduce((acc, s) => {
      acc.count += 1;
      acc.gross += Number(s.gross_revenue) || 0;
      acc.net += Number(s.net_revenue) || 0;
      return acc;
    }, { count: 0, gross: 0, net: 0 });

    const salesByCampaign: Record<string, { count: number; revenue: number }> = {};
    (sales || []).forEach((s) => {
      const ids = s.matched_campaign_id ? [s.matched_campaign_id] : (s.campaign_ids || []);
      ids.forEach((cid: string) => {
        if (!salesByCampaign[cid]) salesByCampaign[cid] = { count: 0, revenue: 0 };
        salesByCampaign[cid].count += 1;
        salesByCampaign[cid].revenue += Number(s.net_revenue) || 0;
      });
    });

    // Recent campaign changes
    const { data: changes } = await admin
      .from("campaign_changes")
      .select("campaign_id, entity_type, entity_id, change_type, field, old_value, new_value, changed_at")
      .in("campaign_id", campaignIds.length ? campaignIds : ["x"])
      .gte("changed_at", since.toISOString())
      .order("changed_at", { ascending: false })
      .limit(50);

    // Balance events
    const { data: balanceEvents } = await admin
      .from("account_balance_events")
      .select("ad_account_id, new_balance, delta, event_at, source")
      .in("ad_account_id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"])
      .gte("event_at", since.toISOString())
      .order("event_at", { ascending: false })
      .limit(20);

    // RD Funnels
    const { data: rdFunnels } = await admin
      .from("rd_funnels")
      .select("id, ad_account_id, name, expert_name, rd_funnel_id, utm_campaign_pattern, is_active")
      .eq("user_id", user.id);

    const context = {
      generated_at: today.toISOString(),
      period: { from: sinceStr, to: today.toISOString().slice(0, 10), days: 30 },
      accounts: (accounts || []).map((a) => ({
        id: a.id,
        name: a.name,
        meta_account_id: a.account_id,
        daily_budget: a.daily_budget,
        remaining_balance: a.remaining_balance,
        target_cpl: a.target_cpl,
      })),
      rd_funnels: rdFunnels || [],
      campaigns: campaignSummary,
      top_ads_by_leads: topAdsByLeads,
      worst_ads_by_cpl: worstAdsByCpl,
      ads_spending_no_leads: adsBurningNoLeads,
      sales_summary: {
        count: salesAgg.count,
        gross_revenue: Math.round(salesAgg.gross * 100) / 100,
        net_revenue: Math.round(salesAgg.net * 100) / 100,
        by_campaign: salesByCampaign,
      },
      recent_changes: changes || [],
      balance_events: balanceEvents || [],
    };

    const systemPrompt = `Você é o assistente de tráfego pago dentro do dashboard do usuário. Responda APENAS com base nos dados fornecidos abaixo (período dos últimos 30 dias salvo indicação contrária). Se a pergunta exigir dados que não estão presentes, diga claramente "não tenho dados suficientes para responder".

Regras:
- Responda em português do Brasil, direto, sem rodeios.
- Use markdown (listas, **negrito**, tabelas curtas) para clareza.
- Sempre cite valores reais (R$, número de leads, CPL, datas).
- Para perguntas sobre o impacto de mudanças, use o array recent_changes cruzado com sales/insights.
- Para "melhor criativo": considere top_ads_by_leads e o CPL.
- Para "pior criativo / o que está queimando dinheiro": use ads_spending_no_leads ou worst_ads_by_cpl.
- Nunca invente nomes de campanhas, contas ou números.

DADOS (JSON):
${JSON.stringify(context).slice(0, 60000)}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...((Array.isArray(history) ? history : []).slice(-6).map((m: any) => ({ role: m.role, content: String(m.content || "") }))),
      { role: "user", content: question },
    ];

    const aiResp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages, stream: true }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione saldo em Configurações > Workspace > Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Falha ao consultar IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ask-ai error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
