export type TrafficObjectiveId = "awareness" | "traffic" | "engagement" | "leads" | "app" | "sales";

export interface TrafficObjective {
  id: TrafficObjectiveId;
  label: string;
  description: string;
  primaryKpi: string;
  optimization: string;
  outcome: string;
}

export interface TrafficFunnelTemplate {
  id: string;
  name: string;
  strategy: string;
  bestFor: string;
  stages: string[];
  primaryKpi: string;
  guardrail: string;
}

export const trafficObjectives: TrafficObjective[] = [
  { id: "awareness", label: "Reconhecimento", description: "Alcance, lembrança e cobertura de público.", primaryKpi: "CPM e alcance", optimization: "alcance qualificado", outcome: "Audiência aquecida" },
  { id: "traffic", label: "Tráfego", description: "Visitas qualificadas para site, perfil ou página.", primaryKpi: "CPC e LPV", optimization: "visualização da página", outcome: "Visita qualificada" },
  { id: "engagement", label: "Engajamento", description: "Vídeo, publicação, mensagens e prova social.", primaryKpi: "CPE e ThruPlay", optimization: "interação de qualidade", outcome: "Engajamento qualificado" },
  { id: "leads", label: "Cadastros", description: "Formulário instantâneo, landing page ou mensagem.", primaryKpi: "CPL e taxa de conversão", optimization: "lead qualificado", outcome: "Lead captado" },
  { id: "app", label: "Promoção do app", description: "Instalação, ativação e eventos dentro do aplicativo.", primaryKpi: "CPI e evento no app", optimization: "evento de maior valor", outcome: "Usuário ativado" },
  { id: "sales", label: "Vendas", description: "Compra, assinatura, checkout e receita atribuída.", primaryKpi: "CPA e ROAS", optimization: "compra ou assinatura", outcome: "Venda confirmada" },
];

const blueprints = [
  { name: "Funil direto", strategy: "Oferta objetiva para uma audiência com intenção já formada.", bestFor: "Produtos validados e demanda quente", stages: ["Audiência de intenção", "Criativo de oferta", "{optimization}", "{outcome}"], guardrail: "Não escalar antes de volume mínimo de conversões." },
  { name: "Conteúdo → conversão", strategy: "Educa primeiro e apresenta a oferta ao público que consumiu o conteúdo.", bestFor: "Mercados que exigem consciência", stages: ["Conteúdo educativo", "Audiência engajada", "Prova e mecanismo", "{optimization}", "{outcome}"], guardrail: "Separar aquisição e remarketing no orçamento." },
  { name: "Vídeo em 3 níveis", strategy: "Sequência de vídeos para descoberta, consideração e decisão.", bestFor: "Especialistas, serviços e infoprodutos", stages: ["Vídeo de descoberta", "Vídeo de prova", "Vídeo de objeção", "{optimization}", "{outcome}"], guardrail: "Trocar criativo quando CTR cair e CPM/CPL subirem juntos." },
  { name: "Isca digital", strategy: "Entrega valor imediato e conduz o lead por nutrição.", bestFor: "Geração de demanda e lista própria", stages: ["Isca de alto valor", "{optimization}", "Nutrição CRM", "Oferta principal", "{outcome}"], guardrail: "Medir qualidade no CRM, não somente volume." },
  { name: "Webinar ou evento", strategy: "Captação para evento com prova ao vivo e janela de oferta.", bestFor: "Lançamentos e venda consultiva", stages: ["Convite para evento", "{optimization}", "Comparecimento", "Oferta com prazo", "{outcome}"], guardrail: "Acompanhar custo por participante, não apenas cadastro." },
  { name: "Mensagens qualificadas", strategy: "Inicia conversa e usa perguntas para filtrar intenção.", bestFor: "Serviços locais e venda de ticket alto", stages: ["Anúncio de problema", "Início da conversa", "Qualificação automática", "Atendimento comercial", "{outcome}"], guardrail: "Definir SLA e excluir conversas sem resposta." },
  { name: "Prova social", strategy: "Usa casos, depoimentos e demonstrações antes da ação final.", bestFor: "Ofertas com objeção de confiança", stages: ["Dor reconhecida", "Caso real", "Demonstração", "{optimization}", "{outcome}"], guardrail: "Validar autorização e autenticidade das provas." },
  { name: "Lookalike progressivo", strategy: "Expande públicos semelhantes em camadas, preservando controle.", bestFor: "Contas com base de conversão confiável", stages: ["Base de alta qualidade", "Semelhante 1%", "Semelhante 2–5%", "{optimization}", "{outcome}"], guardrail: "Não criar semelhante com base pequena ou contaminada." },
  { name: "Remarketing por intenção", strategy: "Separa visitantes conforme profundidade e recência.", bestFor: "Recuperação de oportunidades", stages: ["Visitante 30 dias", "Alta intenção 14 dias", "Objeção específica", "Urgência legítima", "{outcome}"], guardrail: "Controlar frequência e excluir quem já converteu." },
  { name: "Always-on completo", strategy: "Opera aquisição, consideração e recuperação continuamente.", bestFor: "Operações maduras e verba recorrente", stages: ["Aquisição ampla", "Conteúdo de consideração", "{optimization}", "Remarketing 7–30 dias", "{outcome}"], guardrail: "Definir orçamento e meta separados por estágio." },
] as const;

export function getTrafficFunnelTemplates(objectiveId: TrafficObjectiveId): TrafficFunnelTemplate[] {
  const objective = trafficObjectives.find((item) => item.id === objectiveId) ?? trafficObjectives[0];
  return blueprints.map((blueprint, index) => ({
    id: `${objective.id}-${index + 1}`,
    name: `${index + 1}. ${blueprint.name}`,
    strategy: blueprint.strategy,
    bestFor: blueprint.bestFor,
    primaryKpi: objective.primaryKpi,
    guardrail: blueprint.guardrail,
    stages: blueprint.stages.map((stage) => stage.replace("{optimization}", objective.optimization).replace("{outcome}", objective.outcome)),
  }));
}
