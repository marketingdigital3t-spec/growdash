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
  {
    name: "FUNIL 01 — CAPTAÇÃO DIRETA",
    strategy: "Gere demanda com rastreabilidade ponta a ponta: anúncio → formulário ou landing page → qualificação → CRM → closer → diagnóstico → oferta → follow-up → venda.",
    bestFor: "Alunos, imersões e pacientes-modelo com intenção de compra.",
    stages: ["Criativo", "Formulário / LP", "Qualificação", "Integração", "Negociação", "Closer", "Ligação + WhatsApp", "Diagnóstico + oferta", "Follow-up → venda"],
    guardrail: "Não otimizar apenas para lead barato: medir receita por criativo, CAC e ROAS com campanha, conjunto, anúncio e data de entrada.",
  },
  {
    name: "FUNIL 02 — PÍLULA DE CONHECIMENTO + AULA GRATUITA",
    strategy: "Entregue uma pílula de conhecimento, capture o contato e conduza para uma aula gratuita que prova método, diferenciais e oportunidade profissional antes da oferta.",
    bestFor: "Experts e formações que precisam educar o mercado antes de vender.",
    stages: ["Pílula de conhecimento", "Vídeo view", "Perfil do expert", "3 fixados", "Link da bio", "Aula gratuita", "Cadastro", "CRM", "Closer → venda"],
    guardrail: "Separar aquisição, comparecimento e remarketing; acompanhar taxa de presença, avanço no RD e receita por origem.",
  },
  {
    name: "FUNIL 03 — DEMANDA REPRIMIDA",
    strategy: "Transforme desejo latente em oportunidade: comunicação de sonho e resultado, condição especial real, prova social e escassez operacional sem promessas enganosas.",
    bestFor: "Paciente-modelo, turmas extraordinárias e ofertas com vagas limitadas.",
    stages: ["Expert nos stories", "Story 1 — decisão", "Story 2 — problema", "Story 3 — revelação", "Story 4 — microcompromisso", "Link / formulário", "Cadastro", "CRM", "Closer → venda"],
    guardrail: "Paciente-modelo não é gratuito; evitar imagens sexualizadas que geram clique ruim e validar cidade, investimento, supervisão e sigilo.",
  },
  {
    name: "FUNIL 04 — SOCIAL SELLER / PROSPECÇÃO ATIVA",
    strategy: "Combine prospecção ativa, conteúdo e conversas consultivas para transformar contatos qualificados em diagnóstico, proposta e fechamento acompanhado pelo comercial.",
    bestFor: "Ticket alto, profissionais de saúde e operações com closer dedicado.",
    stages: ["Inbound — pessoa interage", "Social seller identifica", "Abordagem pelo perfil do expert", "Conversa natural", "Identifica interesse", "Qualifica", "Encaminha ao closer", "Venda"],
    guardrail: "Definir SLA, registrar vendedor e origem no CRM e medir conversão entre conversa, reunião, proposta e venda.",
  },
] as const;

export function getTrafficFunnelTemplates(_objectiveId?: TrafficObjectiveId): TrafficFunnelTemplate[] {
  return blueprints.map((blueprint, index) => ({
    id: `zntt-funnel-${index + 1}`,
    name: blueprint.name,
    strategy: blueprint.strategy,
    bestFor: blueprint.bestFor,
    primaryKpi: index === 0 ? "CPL, CAC e ROAS" : index === 1 ? "CPV, cadastros e vendas" : index === 2 ? "Respostas, cadastros e vendas" : "Conversas, oportunidades e receita",
    guardrail: blueprint.guardrail,
    stages: [...blueprint.stages],
  }));
}
