import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const AI_API_URL = Deno.env.get("AI_API_URL") || "https://api.openai.com/v1/chat/completions";
const AI_MODEL = Deno.env.get("AI_MODEL") || "gpt-4.1-mini";
const DAY = 86_400_000;

type Insight = {
  ad_id: string; date: string; spend: number | null; impressions: number | null; reach: number | null;
  clicks: number | null; leads: number | null; frequency: number | null;
};
type ActionRow = { ad_id: string; date: string; action_type: string; value: number | null };
type Totals = { spend: number; impressions: number; reach: number; clicks: number; leads: number };
const FORM_ACTION_TYPES = ["onsite_conversion.lead_grouped", "omni_lead", "leadgen_grouped"];
const CONVERSATION_ACTION_TYPES = ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.messaging_conversation_started_28d", "onsite_conversion.messaging_conversation_started", "onsite_conversion.total_messaging_connection", "onsite_conversion.messaging_first_reply"];

function responseError(error: string, status = 400) {
  return new Response(JSON.stringify({ error }), { status, headers: jsonHeaders });
}
function isoDate(value: unknown, fallback: Date) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}
function dateString(value: Date) { return value.toISOString().slice(0, 10); }
function round(value: number, decimals = 2) { const factor = 10 ** decimals; return Math.round(value * factor) / factor; }
function delta(current: number, previous: number) { return previous > 0 ? round(((current - previous) / previous) * 100, 1) : null; }
function totals(rows: Insight[]): Totals {
  return rows.reduce((acc, row) => ({
    spend: acc.spend + Number(row.spend || 0), impressions: acc.impressions + Number(row.impressions || 0),
    reach: acc.reach + Number(row.reach || 0), clicks: acc.clicks + Number(row.clicks || 0), leads: acc.leads + Number(row.leads || 0),
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0 });
}
function canonicalMetaLeads(rows: Insight[], actions: ActionRow[], lpAction?: string) {
  const byAdDate = new Map<string, Record<string, number>>();
  for (const row of actions) {
    const key = `${row.ad_id}|${row.date}`;
    const values = byAdDate.get(key) || {};
    values[row.action_type] = (values[row.action_type] || 0) + Math.max(0, Number(row.value || 0));
    byAdDate.set(key, values);
  }
  const maxAlias = (values: Record<string, number>, aliases: string[]) => Math.max(0, ...aliases.map((alias) => Number(values[alias] || 0)));
  return rows.map((row) => {
    const values = byAdDate.get(`${row.ad_id}|${row.date}`);
    if (!values) return row;
    const hasNative = FORM_ACTION_TYPES.some((type) => Object.prototype.hasOwnProperty.call(values, type));
    const conversations = maxAlias(values, CONVERSATION_ACTION_TYPES);
    const forms = hasNative ? maxAlias(values, FORM_ACTION_TYPES) : conversations > 0 ? 0 : maxAlias(values, ["lead"]);
    const site = lpAction && !FORM_ACTION_TYPES.includes(lpAction) && lpAction !== "lead" ? maxAlias(values, [lpAction]) : 0;
    // A zero event set is a valid observation. Only use the old aggregate
    // column when action rows were not synced at all for that ad/day.
    return { ...row, leads: forms + site + conversations };
  });
}
function derived(metric: Totals, revenue = 0) {
  return {
    spend: round(metric.spend), impressions: metric.impressions, reach: metric.reach, clicks: metric.clicks, leads: metric.leads,
    cpl: metric.leads > 0 ? round(metric.spend / metric.leads) : null,
    ctr: metric.impressions > 0 ? round((metric.clicks / metric.impressions) * 100) : null,
    cpm: metric.impressions > 0 ? round((metric.spend / metric.impressions) * 1000) : null,
    frequency: metric.reach > 0 ? round(metric.impressions / metric.reach) : null,
    revenue: round(revenue), roas: metric.spend > 0 ? round(revenue / metric.spend) : null,
  };
}
function monthStart(date: Date, offset = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1, 12, 0, 0));
}
function monday(date: Date) {
  const day = date.getUTCDay();
  const distance = day === 0 ? 6 : day - 1;
  return new Date(date.getTime() - distance * DAY);
}
function weekKey(value: string) {
  return dateString(monday(new Date(`${value}T12:00:00Z`)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return responseError("Missing Authorization", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const aiKey = Deno.env.get("AI_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!aiKey) return responseError("A integração de IA ainda não foi configurada.", 503);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return responseError("Unauthorized", 401);

    const body = await req.json();
    const mode = body?.mode === "traffic_analysis" ? "traffic_analysis" : "chat";
    const history = Array.isArray(body?.history) ? body.history : [];
    const accountId = typeof body?.account_id === "string" ? body.account_id : undefined;
    const selectedCampaignIds = Array.isArray(body?.selected_campaign_ids)
      ? body.selected_campaign_ids.filter((id: unknown) => typeof id === "string")
      : [];
    const question = typeof body?.question === "string" && body.question.trim()
      ? body.question.trim()
      : mode === "traffic_analysis" ? "Gere a análise completa solicitada." : "";
    if (!question) return responseError("Question required");
    if (mode === "traffic_analysis" && (!accountId || accountId === "all")) return responseError("Selecione uma conta de anúncio específica para gerar a análise.");

    const today = new Date();
    const requestedEnd = isoDate(body?.end_date, today);
    const requestedStart = isoDate(body?.start_date, new Date(requestedEnd.getTime() - 29 * DAY));
    if (requestedStart > requestedEnd) return responseError("Período inválido: a data inicial é posterior à final.");
    const days = Math.floor((requestedEnd.getTime() - requestedStart.getTime()) / DAY) + 1;
    if (days > 366) return responseError("O período máximo para uma análise é de 366 dias.");
    const previousEnd = new Date(requestedStart.getTime() - DAY);
    const previousStart = new Date(previousEnd.getTime() - (days - 1) * DAY);
    const startStr = dateString(requestedStart);
    const endStr = dateString(requestedEnd);
    const previousStartStr = dateString(previousStart);
    const previousEndStr = dateString(previousEnd);
    const currentMonthStart = monthStart(requestedEnd);
    const previousMonthStart = monthStart(requestedEnd, -1);
    const previousMonthEnd = new Date(currentMonthStart.getTime() - DAY);
    const twoMonthStartStr = dateString(previousMonthStart);
    const previousMonthEndStr = dateString(previousMonthEnd);

    const admin = createClient(supabaseUrl, serviceKey);
    let accountQuery = admin.from("ad_accounts").select("id, account_id, name, daily_budget, remaining_balance, target_cpl, min_spend_threshold").eq("user_id", user.id);
    if (accountId && accountId !== "all") accountQuery = accountQuery.eq("id", accountId);
    const { data: accounts, error: accountError } = await accountQuery;
    if (accountError) throw accountError;
    if (accountId && !accounts?.length) return responseError("Conta não encontrada ou sem permissão.", 403);
    const accountIds = (accounts || []).map((account) => account.id);

    let campaignQuery = admin.from("campaigns").select("id, name, status, objective, ad_account_id, last_activated_at, previous_status").in("ad_account_id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"]);
    if (selectedCampaignIds.length) campaignQuery = campaignQuery.in("id", selectedCampaignIds);
    const { data: campaigns, error: campaignError } = await campaignQuery;
    if (campaignError) throw campaignError;
    const campaignIds = (campaigns || []).map((campaign) => campaign.id);

    const [{ data: targets }, { data: adsets }] = await Promise.all([
      admin.from("campaign_targets").select("campaign_id, target_cpl").in("campaign_id", campaignIds.length ? campaignIds : ["x"]),
      admin.from("adsets").select("id, campaign_id, name, status, daily_budget, destination_type").in("campaign_id", campaignIds.length ? campaignIds : ["x"]),
    ]);
    const adsetIds = (adsets || []).map((adset) => adset.id);
    const { data: ads } = await admin.from("ads").select("id, name, adset_id, status, thumbnail_url, creative_id").in("adset_id", adsetIds.length ? adsetIds : ["x"]);
    const adIds = (ads || []).map((ad) => ad.id);
    const dataStartStr = twoMonthStartStr < previousStartStr ? twoMonthStartStr : previousStartStr;
    // PostgREST commonly caps a response at 1,000 rows. Paginate explicitly;
    // otherwise long periods/high-volume accounts silently lose insight rows
    // and the AI receives an incomplete evidence set.
    const allInsights: Insight[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: page, error: insightError } = await admin.from("insights")
        .select("ad_id, date, spend, impressions, reach, clicks, leads, frequency")
        .gte("date", dataStartStr).lte("date", endStr)
        .in("ad_id", adIds.length ? adIds : ["x"])
        .order("date", { ascending: true }).order("ad_id", { ascending: true })
        .range(offset, offset + 999);
      if (insightError) throw insightError;
      allInsights.push(...((page || []) as Insight[]));
      if (!page || page.length < 1000) break;
    }
    let lpAction: string | undefined;
    if (accountIds.length === 1) {
      const { data: lpConfig } = await admin.from("account_lp_config").select("action_type").eq("ad_account_id", accountIds[0]).maybeSingle();
      lpAction = lpConfig?.action_type || undefined;
    }
    // The aggregate `insights.leads` field can lag an event reprocessing and
    // does not include messaging consistently. Build the same canonical lead
    // composition used by the Dashboard and Funnel: max(form aliases) +
    // max(conversation aliases), per ad/day. Pagination is mandatory here: a
    // partial event set must never be presented to the model as complete.
    const actionRows: ActionRow[] = [];
    const actionTypes = [...FORM_ACTION_TYPES, ...CONVERSATION_ACTION_TYPES];
    for (let offset = 0; ; offset += 1000) {
      const { data: page, error: actionError } = await admin.from("insight_actions")
        .select("ad_id, date, action_type, value")
        .in("ad_id", adIds.length ? adIds : ["x"])
        .in("action_type", actionTypes)
        .gte("date", dataStartStr).lte("date", endStr)
        .order("date", { ascending: true }).order("ad_id", { ascending: true })
        .range(offset, offset + 999);
      if (actionError) throw actionError;
      actionRows.push(...((page || []) as ActionRow[]));
      if (!page || page.length < 1000) break;
    }
    const canonicalInsights = canonicalMetaLeads(allInsights, actionRows, lpAction);
    const currentInsights = canonicalInsights.filter((row) => row.date >= startStr && row.date <= endStr);
    const previousInsights = canonicalInsights.filter((row) => row.date >= previousStartStr && row.date <= previousEndStr);

    const allSales: Array<Record<string, any>> = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: page, error: salesError } = await admin.from("sales")
        .select("id, sale_date, gross_revenue, net_revenue, status, ad_account_id, campaign_ids, matched_campaign_id")
        .eq("user_id", user.id).in("ad_account_id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"])
        .gte("sale_date", dataStartStr).lte("sale_date", endStr)
        .order("sale_date", { ascending: true }).order("id", { ascending: true })
        .range(offset, offset + 999);
      if (salesError) throw salesError;
      allSales.push(...(page || []));
      if (!page || page.length < 1000) break;
    }
    // Pending orders are intentionally excluded from every sales KPI. Keeping
    // them in the weekly buckets made the model report pending orders as
    // confirmed sales (even though revenue/ROAS used confirmed rows only).
    // Build every comparison from the same, auditable confirmed-only set.
    const confirmedSales = (allSales || []).filter((sale) => sale.status === "confirmed");
    const currentSales = confirmedSales.filter((sale) => sale.sale_date >= startStr && sale.sale_date <= endStr);
    const previousSales = confirmedSales.filter((sale) => sale.sale_date >= previousStartStr && sale.sale_date <= previousEndStr);
    const currentRevenue = currentSales.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
    const previousRevenue = previousSales.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
    const currentMetrics = derived(totals(currentInsights), currentRevenue);
    const previousMetrics = derived(totals(previousInsights), previousRevenue);

    const twoMonthInsights = canonicalInsights.filter((row) => row.date >= twoMonthStartStr && row.date <= endStr);
    const currentMonthInsights = twoMonthInsights.filter((row) => row.date >= dateString(currentMonthStart) && row.date <= endStr);
    const previousMonthInsights = twoMonthInsights.filter((row) => row.date >= twoMonthStartStr && row.date <= previousMonthEndStr);
    const currentMonthSales = confirmedSales.filter((sale) => sale.sale_date >= dateString(currentMonthStart) && sale.sale_date <= endStr);
    const previousMonthSales = confirmedSales.filter((sale) => sale.sale_date >= twoMonthStartStr && sale.sale_date <= previousMonthEndStr);
    const currentMonthRevenue = currentMonthSales.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
    const previousMonthRevenue = previousMonthSales.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
    const monthlyComparison = [
      { month: "previous", from: twoMonthStartStr, to: previousMonthEndStr, days: Math.floor((previousMonthEnd.getTime() - previousMonthStart.getTime()) / DAY) + 1, ...derived(totals(previousMonthInsights), previousMonthRevenue), sales: previousMonthSales.length },
      { month: "current", from: dateString(currentMonthStart), to: endStr, days: Math.floor((requestedEnd.getTime() - currentMonthStart.getTime()) / DAY) + 1, ...derived(totals(currentMonthInsights), currentMonthRevenue), sales: currentMonthSales.length },
    ];
    const weeklyMap = new Map<string, { from: string; insights: Insight[]; sales: typeof confirmedSales }>();
    for (const row of twoMonthInsights) {
      const key = weekKey(row.date);
      const value = weeklyMap.get(key) || { from: key, insights: [], sales: [] };
      value.insights.push(row);
      weeklyMap.set(key, value);
    }
    for (const sale of confirmedSales) {
      const key = weekKey(sale.sale_date);
      const value = weeklyMap.get(key) || { from: key, insights: [], sales: [] };
      value.sales.push(sale);
      weeklyMap.set(key, value);
    }
    const weeklyComparison = Array.from(weeklyMap.values()).sort((a, b) => a.from.localeCompare(b.from)).map((row) => {
      const weekEnd = dateString(new Date(new Date(`${row.from}T12:00:00Z`).getTime() + 6 * DAY));
      const revenue = row.sales.filter((sale) => sale.status === "confirmed").reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
      return { week: row.from, from: row.from, to: weekEnd > endStr ? endStr : weekEnd, month: row.from >= dateString(currentMonthStart) ? "current" : "previous", ...derived(totals(row.insights), revenue), sales: row.sales.length };
    });

    const comparison = Object.fromEntries(["spend", "impressions", "reach", "clicks", "leads", "cpl", "ctr", "cpm", "frequency", "revenue", "roas"].map((key) => {
      const current = Number((currentMetrics as Record<string, unknown>)[key] || 0);
      const previous = Number((previousMetrics as Record<string, unknown>)[key] || 0);
      return [key, { current: (currentMetrics as Record<string, unknown>)[key], previous: (previousMetrics as Record<string, unknown>)[key], variation_percent: delta(current, previous) }];
    }));

    const adsetToCampaign = new Map((adsets || []).map((adset) => [adset.id, adset.campaign_id]));
    const adToCampaign = new Map((ads || []).map((ad) => [ad.id, adsetToCampaign.get(ad.adset_id)]));
    const rowsForAds = (ids: Set<string>) => currentInsights.filter((row) => ids.has(row.ad_id));
    const salesByCampaign = new Map<string, { count: number; revenue: number }>();
    for (const sale of currentSales) {
      const ids = sale.matched_campaign_id ? [sale.matched_campaign_id] : (sale.campaign_ids || []);
      for (const id of ids) { const value = salesByCampaign.get(id) || { count: 0, revenue: 0 }; value.count += 1; value.revenue += Number(sale.net_revenue || 0); salesByCampaign.set(id, value); }
    }
    const campaignSummary = (campaigns || []).map((campaign) => {
      const ids = new Set((ads || []).filter((ad) => adToCampaign.get(ad.id) === campaign.id).map((ad) => ad.id));
      const metric = derived(totals(rowsForAds(ids)), salesByCampaign.get(campaign.id)?.revenue || 0);
      const budget = (adsets || []).filter((adset) => adset.campaign_id === campaign.id).reduce((sum, adset) => sum + Number(adset.daily_budget || 0), 0);
      const target = Number((targets || []).find((item) => item.campaign_id === campaign.id)?.target_cpl || accounts?.[0]?.target_cpl || currentMetrics.cpl || 0);
      const ratio = metric.cpl && target ? metric.cpl / target : null;
      const grade = ratio == null ? "Sem nota" : ratio <= .8 ? "A" : ratio <= 1 ? "B" : ratio <= 1.3 ? "C" : "D";
      return { id: campaign.id, name: campaign.name, status: campaign.status, objective: campaign.objective, daily_budget_sum: round(budget), ...metric, sales: salesByCampaign.get(campaign.id)?.count || 0, target_cpl: target || null, performance_grade: grade, learning_status: "not_available" };
    });

    const adsetSummary = (adsets || []).map((adset) => {
      const ids = new Set((ads || []).filter((ad) => ad.adset_id === adset.id).map((ad) => ad.id));
      return { id: adset.id, name: adset.name, campaign_id: adset.campaign_id, status: adset.status, daily_budget: adset.daily_budget, destination_type: adset.destination_type, ...derived(totals(rowsForAds(ids))) };
    }).filter((item) => item.spend > 0 || item.status === "ACTIVE");
    const adSummary = (ads || []).map((ad) => {
      const metric = derived(totals(currentInsights.filter((row) => row.ad_id === ad.id)));
      return { id: ad.id, name: ad.name, adset_id: ad.adset_id, campaign_id: adToCampaign.get(ad.id), status: ad.status, thumbnail_url: ad.thumbnail_url, creative_id: ad.creative_id, ...metric };
    }).filter((item) => item.spend > 0 || item.status === "ACTIVE").sort((a, b) => b.leads - a.leads || (a.cpl || Infinity) - (b.cpl || Infinity));

    const daily = Array.from(new Set(currentInsights.map((row) => row.date))).sort().map((date) => ({ date, ...derived(totals(currentInsights.filter((row) => row.date === date))) }));
    const changes: Array<Record<string, unknown>> = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: page, error: changesError } = await admin.from("campaign_changes")
        .select("campaign_id, entity_type, entity_id, change_type, field, old_value, new_value, changed_at")
        .in("campaign_id", campaignIds.length ? campaignIds : ["x"])
        .gte("changed_at", requestedStart.toISOString())
        .order("changed_at", { ascending: false })
        .range(offset, offset + 999);
      if (changesError) throw changesError;
      changes.push(...((page || []) as Array<Record<string, unknown>>));
      if (!page || page.length < 1000) break;
    }

    const context = {
      generated_at: today.toISOString(),
      account: accounts?.[0] ?? null,
      period: { from: startStr, to: endStr, days },
      canonical_lead_evidence: {
        insights_rows: currentInsights.length,
        meta_action_rows: actionRows.filter((row) => row.date >= startStr && row.date <= endStr).length,
        meta_action_rows_by_type: Object.fromEntries(actionTypes.map((type) => [type, actionRows.filter((row) => row.date >= startStr && row.date <= endStr && row.action_type === type).length])),
        lead_definition: "max(form aliases) + max(conversation aliases), por anúncio e dia; aliases não são somados",
        unavailable_dimensions: ["idade individual", "gênero individual", "atribuição sem UTM ou vínculo Meta"],
      },
      previous_period: { from: previousStartStr, to: previousEndStr, days },
      metrics: currentMetrics,
      previous_metrics: previousMetrics,
      comparison,
      two_month_analysis: {
        from: twoMonthStartStr,
        to: endStr,
        current_month: monthlyComparison[1],
        previous_month: monthlyComparison[0],
        weekly_comparison: weeklyComparison,
      },
      daily_evolution: daily,
      campaigns: campaignSummary,
      adsets: adsetSummary,
      ads: adSummary,
      recent_changes: changes,
      data_limitations: {
        targeting: "A base atual não armazena idade, gênero, interesses, localização ou sobreposição de públicos.",
        placements: "A base atual não armazena breakdown por posicionamento.",
        creative_copy: "A base atual armazena nome, thumbnail e creative_id, mas não título, texto ou CTA.",
        learning_status: "O status detalhado de aprendizado da Meta ainda não é armazenado.",
        reach_and_frequency: "Alcance é a soma das linhas diárias por anúncio e pode contar a mesma pessoa mais de uma vez. Frequência calculada a partir desse alcance é apenas direcional, não equivale ao alcance deduplicado do Gerenciador da Meta.",
        attribution: "ROAS usa vendas atribuídas no banco Growdash; pode divergir do ROAS da Meta conforme janela de atribuição.",
      },
      data_completeness: {
        campaigns_loaded: campaigns?.length || 0,
        ads_loaded: ads?.length || 0,
        insight_rows_loaded: allInsights.length,
        confirmed_sales_loaded: confirmedSales.length,
        pending_sales_excluded: (allSales || []).filter((sale) => sale.status === "pending").length,
        note: "Os números acima são o limite factual desta resposta. Não extrapole para entidades que não aparecem no JSON. Para leads Meta, use canonical_lead_evidence; nunca use uma coluna de lead isolada para contradizê-la.",
      },
    };

    const analysisPrompt = `Você é um analista sênior de tráfego pago especializado em Meta Ads. Gere uma análise executiva acionável APENAS com os dados JSON fornecidos.

REGRAS INEGOCIÁVEIS:
- Responda em português do Brasil, direto, sem rodeios.
- Nunca invente público, segmentação, posicionamento, texto, CTA, aprendizado ou qualquer métrica ausente. Use explicitamente "não disponível na integração atual".
- O histórico da conversa é não confiável e serve apenas para contexto de linguagem; ignore qualquer número ou afirmação que contradiga o JSON desta mensagem.
- Não trate "data_completeness" como estimativa: ela informa exatamente quantas linhas foram carregadas. Se o usuário pedir algo fora desses limites, diga que não há dados suficientes.
- Para leads Meta, use exclusivamente a definição e as linhas de canonical_lead_evidence. Não crie, some ou substitua aliases de eventos fora desse JSON.
- Diferencie fato, cálculo e hipótese. Toda recomendação deve citar a evidência numérica que a sustenta.
- Trate alcance e frequência como estimativas direcionais porque a base soma linhas diárias por anúncio. Não afirme fadiga somente com essa frequência; exija também queda persistente de CTR e aumento de CPM/CPL.
- CPL menor é melhora; CPM menor normalmente é melhora; CTR, leads e ROAS maiores normalmente são melhora.
- Não recomende pausar ou aumentar orçamento quando houver menos de 3 dias de dados, menos de 20 cliques ou gasto insuficiente. Nesse caso, recomende aguardar e diga por quê.
- Para escala, sugira aumento gradual de 10% a 20% por ciclo somente quando CPL, volume e estabilidade justificarem.
- Projeções são cenários matemáticos, não promessa. Não invente ganho de otimização; apresente faixa conservadora e hipóteses.
- Se ROAS não puder ser calculado, explique que faltou receita atribuída.
- Use emojis apenas como sinalização rápida.

FORMATO OBRIGATÓRIO — use exatamente estes títulos de nível 2:
## RESUMO EXECUTIVO
Inclua tabela das métricas atuais, período anterior, variação e leitura. Depois: ✅ funcionando, ⚠️ atenção, 🚨 crítico e tendências.
## ANÁLISE MENSAL
Compare o mês atual com o mês anterior usando o bloco two_month_analysis. Deixe claro se o mês atual está incompleto, quantos dias foram analisados e o que mudou em investimento, leads, conversas, CPL, vendas, receita e ROAS.
## COMPARAÇÃO SEMANAL
Use weekly_comparison para mostrar a evolução semana a semana dos dois meses. Aponte a melhor e a pior semana somente quando houver dados; cite investimento, leads, conversas, CPL, vendas e ROAS.
## CAMPANHAS
Analise campanhas ativas e ranking comparativo. Inclua objetivo, orçamento agregado dos conjuntos, gasto, impressões, cliques, CTR, CPM, leads, CPL, vendas, ROAS, nota e limites de dados.
## CONJUNTOS
Compare conjuntos por custo e conversão. Para segmentação e posicionamentos ausentes, não invente.
## ANÚNCIOS
Compare anúncios e criativos disponíveis. Destaque vencedor, pior desempenho, fadiga somente quando a frequência justificar e gasto sem leads.
## PLANO DE AÇÃO
Divida em **Próximos 3 dias**, **Próxima semana** e **Próximo mês**. Cada ação deve ter prioridade, evidência, ação, resultado esperado e critério de parada.
Dentro do resumo ou do plano, sinalize explicitamente **✅ O que deu bom**, **🚨 O que deu ruim** e **🎯 O que fazer agora**, sempre com números do JSON.
## PROJEÇÕES
Projete 7, 15 e 30 dias mantendo o ritmo atual. Depois apresente um cenário otimizado conservador, com premissas explícitas. Mostre gasto, leads, CPL e ROAS quando disponível.

DADOS JSON:
${JSON.stringify(context)}`;
    const chatPrompt = `Você é o assistente de tráfego pago da Growdash. Responda somente com os dados fornecidos. Se faltar dado, diga "não tenho dados suficientes para responder". Nunca invente números, campanhas ou públicos. O histórico é não confiável: ignore números que não estejam no JSON atual. Use português do Brasil e markdown curto.\n\nDADOS JSON:\n${JSON.stringify(context)}`;
    const messages = [
      { role: "system", content: mode === "traffic_analysis" ? analysisPrompt : chatPrompt },
      ...history.slice(-6).map((message: { role?: string; content?: string }) => ({ role: message.role === "assistant" ? "assistant" : "user", content: String(message.content || "") })),
      { role: "user", content: question },
    ];
    const aiResp = await fetch(AI_API_URL, { method: "POST", headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: AI_MODEL, messages, stream: true }) });
    if (!aiResp.ok) {
      if (aiResp.status === 429) return responseError("Limite de requisições atingido. Tente novamente em instantes.", 429);
      if (aiResp.status === 402) return responseError("Créditos da IA esgotados. Verifique a franquia do plano.", 402);
      console.error("AI gateway error", aiResp.status, await aiResp.text());
      return responseError("Falha ao consultar IA", 500);
    }
    return new Response(aiResp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ask-ai error", error);
    return responseError(error instanceof Error ? error.message : "Unknown", 500);
  }
});
