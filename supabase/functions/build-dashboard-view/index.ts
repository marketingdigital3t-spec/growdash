import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATALOG_DESC = `
Widget types disponíveis (use exatamente estes "type"):
- kpi { metric }            -> KPI único
- kpi_grid { metrics:[] }   -> grade de KPIs
- line_chart { metric, groupBy }
- bar_chart { metric, groupBy, orientation: "vertical"|"horizontal" }
- pie_chart { metric, groupBy, variant: "pie"|"donut" }
- top_ranking { metric, groupBy, direction:"top"|"worst", limit }
- compare_period { metric }
- brazil_map {}
- alerts {}
- funnel {}

Métricas válidas (metric):
spend, leads, cpl, ctr, cpm, clicks, impressions, frequency, conversion_rate, revenue_net, revenue_gross, roas, roi, profit, sales_count

groupBy válidos:
date, campaign, ad, state, formation, product, payment

Layout: grid de 12 colunas. Cada widget: { i (id único), x, y, w, h }.
- KPI: w=3 h=2
- compare_period: w=4 h=2
- gráficos: w=6 h=4
- pie/donut: w=4 h=4
- mapa Brasil: w=6 h=5
- top_ranking: w=6 h=4
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require an authenticated user — this endpoint calls the AI gateway with
    // the app's LOVABLE_API_KEY and would otherwise allow unlimited public abuse.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, history = [] } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const tools = [
      {
        type: "function",
        function: {
          name: "ask_followup",
          description: "Pergunte 1 a 3 perguntas curtas ao usuário antes de gerar a visualização.",
          parameters: {
            type: "object",
            properties: {
              questions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
            },
            required: ["questions"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "generate_view",
          description: "Gere a visualização final.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
              widgets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    type: { type: "string" },
                    title: { type: "string" },
                    config: { type: "object" },
                  },
                  required: ["id", "type", "title", "config"],
                  additionalProperties: false,
                },
              },
              layout: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    i: { type: "string" },
                    x: { type: "number" },
                    y: { type: "number" },
                    w: { type: "number" },
                    h: { type: "number" },
                  },
                  required: ["i", "x", "y", "w", "h"],
                  additionalProperties: false,
                },
              },
            },
            required: ["name", "widgets", "layout"],
            additionalProperties: false,
          },
        },
      },
    ];

    const systemPrompt = `Você ajuda a montar dashboards de tráfego pago. ${CATALOG_DESC}
Regras:
- Se o pedido do usuário estiver claro o suficiente para gerar, chame generate_view.
- Se faltar informação relevante (período, métrica principal, granularidade), chame ask_followup com 1-3 perguntas objetivas.
- Use IDs únicos no widgets[].id e use o mesmo valor em layout[].i.
- Sempre dê um nome curto e descritivo à visualização (ex: "Funil LP Expert X").
- NÃO inclua os widgets de sistema (ask_ai, budget_bm, campaigns_detail) — eles são adicionados automaticamente.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: message },
        ],
        tools,
        tool_choice: "required",
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Limite atingido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados na IA." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("ai gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "Falha na IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return new Response(JSON.stringify({ error: "Sem resposta da IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const args = JSON.parse(call.function.arguments || "{}");
    return new Response(JSON.stringify({ tool: call.function.name, args }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
