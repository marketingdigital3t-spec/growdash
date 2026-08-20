export type CampaignColumnKey = "check" | "name" | "delivery" | "deliveryStatus" | "objective" | "budget" | "spend" | "impressions" | "reach" | "frequency" | "cpm" | "clicks" | "ctr" | "cpc" | "linkClicks" | "linkCpc" | "uniqueLinkCtr" | "leads" | "cpl" | "conversion" | "sales" | "cpa" | "revenue" | "roas" | "profit" | "roi" | "landingPageViews" | "costPerLandingPageView" | "checkouts" | "costPerCheckout" | "metaPurchases" | "metaCostPerPurchase" | "metaPurchaseRoas" | "videoViews" | "actions";
export type MetaColumnPresetKey = "performance" | "vtsd" | "performance_clicks" | "delivery" | "engagement" | "video" | "awareness" | "traffic" | "leads" | "sales" | "setup";

export const campaignColumnLabels: Record<CampaignColumnKey, string> = {
  check: "Selecionar", name: "Campanha", delivery: "Status", deliveryStatus: "Veiculação", objective: "Objetivo", budget: "Orçamento",
  spend: "Valor usado", impressions: "Impressões", reach: "Alcance", frequency: "Frequência", cpm: "CPM",
  clicks: "Cliques no link", ctr: "CTR", cpc: "CPC", leads: "Resultados / Leads", cpl: "Custo por resultado",
  conversion: "Taxa de conversão", sales: "Compras / Vendas", cpa: "Custo por compra", revenue: "Valor de conversão",
  linkClicks: "Cliques no link", linkCpc: "CPC (clique no link)", uniqueLinkCtr: "CTR único (clique no link)",
  landingPageViews: "Visualizações da página de destino", costPerLandingPageView: "Custo por visualização da página de destino",
  checkouts: "Finalizações de compra iniciadas", costPerCheckout: "Custo por finalização de compra iniciada",
  metaPurchases: "Compras", metaCostPerPurchase: "Custo por compra", metaPurchaseRoas: "ROAS de compras",
  roas: "ROAS", profit: "Lucro", roi: "ROI", videoViews: "Reproduções de vídeo", actions: "Ações",
};

export const metaColumnPresets: { id: MetaColumnPresetKey; label: string; description: string; columns: CampaignColumnKey[] }[] = [
  { id: "performance", label: "Pré-definidas", description: "A mesma visão operacional usada no gerenciador de campanhas.", columns: ["name", "delivery", "budget", "spend", "leads", "cpl", "impressions", "cpm", "clicks", "cpc", "ctr"] },
  { id: "vtsd", label: "VTSD", description: "Tráfego, página de destino, checkout, compras e ROAS da Meta.", columns: ["name", "delivery", "deliveryStatus", "actions", "reach", "impressions", "frequency", "linkClicks", "linkCpc", "uniqueLinkCtr", "cpm", "budget", "leads", "cpl", "spend", "landingPageViews", "costPerLandingPageView", "checkouts", "costPerCheckout", "metaPurchases", "metaCostPerPurchase", "metaPurchaseRoas"] },
  { id: "performance_clicks", label: "Desempenho e cliques", description: "Entrega e eficiência de clique.", columns: ["name", "delivery", "spend", "impressions", "reach", "frequency", "clicks", "ctr", "cpc", "cpm", "leads", "cpl"] },
  { id: "delivery", label: "Veiculação", description: "Status, objetivo, orçamento e distribuição.", columns: ["name", "delivery", "objective", "budget", "spend", "impressions", "reach", "frequency", "cpm"] },
  { id: "engagement", label: "Engajamento", description: "Interação, cliques e conversão.", columns: ["name", "delivery", "spend", "impressions", "reach", "frequency", "clicks", "ctr", "cpc", "conversion"] },
  { id: "video", label: "Engajamento com vídeo", description: "Entrega e reproduções de vídeo.", columns: ["name", "delivery", "spend", "impressions", "reach", "frequency", "videoViews", "cpm"] },
  { id: "awareness", label: "Reconhecimento", description: "Cobertura, frequência e custo de mídia.", columns: ["name", "delivery", "objective", "spend", "impressions", "reach", "frequency", "cpm"] },
  { id: "traffic", label: "Tráfego", description: "Cliques, CTR, CPC e conversão da página.", columns: ["name", "delivery", "spend", "impressions", "clicks", "ctr", "cpc", "cpm", "leads", "cpl", "conversion"] },
  { id: "leads", label: "Cadastros", description: "Volume, CPL, qualidade e vendas atribuídas.", columns: ["name", "delivery", "leads", "cpl", "conversion", "sales", "cpa", "revenue", "roas", "spend"] },
  { id: "sales", label: "Vendas e ROAS", description: "Receita, compras, CPA, lucro e retorno.", columns: ["name", "delivery", "sales", "cpa", "revenue", "spend", "roas", "profit", "roi"] },
  { id: "setup", label: "Configuração", description: "Objetivo, orçamento e situação da campanha.", columns: ["name", "delivery", "objective", "budget", "spend"] },
];

// Seleção, status e nome reproduzem a hierarquia operacional da Meta e são
// colunas estruturais: nunca podem ser ocultadas por um preset do usuário.
export const editableCampaignColumns = (Object.keys(campaignColumnLabels) as CampaignColumnKey[]).filter((key) => !["check", "delivery", "name"].includes(key));

export type MetaBreakdownItem = { id: string; label: string; supported?: boolean };

export const metaBreakdownGroups: ReadonlyArray<{ label: string; items: ReadonlyArray<MetaBreakdownItem> }> = [
  { label: "Geral", items: [{ id: "none", label: "Sem detalhamento", supported: true }] },
  { label: "Populares", items: [{ id: "day", label: "Dia" }, { id: "age", label: "Idade", supported: true }, { id: "placement", label: "Posicionamento", supported: true }, { id: "country", label: "País", supported: true }, { id: "platform", label: "Plataforma", supported: true }, { id: "hour_account", label: "Hora" }] },
  { label: "Dados demográficos", items: [{ id: "age", label: "Idade", supported: true }, { id: "gender", label: "Gênero", supported: true }, { id: "age_gender", label: "Idade e gênero" }, { id: "country", label: "País", supported: true }, { id: "region", label: "Região", supported: true }, { id: "dma", label: "Área de mercado designada" }] },
  { label: "Veiculação", items: [{ id: "placement", label: "Posicionamento", supported: true }, { id: "platform", label: "Plataforma", supported: true }, { id: "device", label: "Dispositivo de impressão" }, { id: "hour_account", label: "Hora do dia — conta" }, { id: "hour_viewer", label: "Hora do dia — visualizador" }] },
  { label: "Ação", items: [{ id: "conversion_device", label: "Dispositivo de conversão" }, { id: "destination", label: "Destino" }, { id: "video_view_type", label: "Tipo de visualização do vídeo" }, { id: "carousel_card", label: "Card do carrossel" }, { id: "dynamic_creative", label: "Elemento do criativo dinâmico" }] },
  { label: "Criativo e atribuição", items: [{ id: "creative", label: "Criativo" }, { id: "audience", label: "Segmentos de público" }, { id: "attribution", label: "Atribuição" }] },
];

/** Maps a UI choice to persisted Meta breakdown rows. Unsupported choices stay
 * selectable so the interface mirrors Ads Manager, but are never fabricated. */
export function getBreakdownStorageType(id: string) {
  return ({ age: "age", gender: "gender", platform: "publisher_platform", placement: "platform_position", region: "region", country: "country" } as Record<string, string>)[id] ?? null;
}

export function getMetaColumnPreset(id: MetaColumnPresetKey) {
  return metaColumnPresets.find((preset) => preset.id === id) ?? metaColumnPresets[0];
}

export function getBreakdownLabel(id: string) {
  return metaBreakdownGroups.flatMap((group) => group.items).find((item) => item.id === id)?.label ?? "Sem detalhamento";
}
