import {
  Activity,
  AlertTriangle,
  BarChart3,
  BadgeDollarSign,
  Bot,
  Building2,
  Cable,
  CalendarDays,
  Columns3,
  GitBranch,
  HardDrive,
  Headphones,
  LayoutDashboard,
  Megaphone,
  PanelTop,
  PackageOpen,
  RectangleEllipsis,
  Share2,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCog,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type ModuleConfig = {
  label: string;
  path: string;
  icon: LucideIcon;
  description: string;
  metrics: Array<{ label: string; value: string; change: string }>;
  highlights: string[];
};

export type NavSection = {
  label: string;
  items: ModuleConfig[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Visão geral",
    items: [
      {
        label: "Dashboard",
        path: "/",
        icon: LayoutDashboard,
        description: "Uma visão consolidada das principais métricas da sua operação.",
        metrics: [],
        highlights: [],
      },
      {
        label: "CRM",
        path: "/crm",
        icon: ShieldCheck,
        description: "Acompanhe contatos, oportunidades e o histórico de relacionamento.",
        metrics: [
          { label: "Leads ativos", value: "248", change: "+12%" },
          { label: "Novas oportunidades", value: "36", change: "+8%" },
          { label: "Conversão", value: "18,4%", change: "+2,1%" },
          { label: "Receita em aberto", value: "R$ 84 mil", change: "+15%" },
        ],
        highlights: ["Follow-ups para hoje", "Oportunidades sem retorno", "Leads com maior intenção"],
      },
      {
        label: "Comercial",
        path: "/comercial",
        icon: Trophy,
        description: "Metas, desempenho do time e evolução das vendas em um só lugar.",
        metrics: [
          { label: "Receita no mês", value: "R$ 126 mil", change: "+18%" },
          { label: "Vendas", value: "42", change: "+11%" },
          { label: "Ticket médio", value: "R$ 3.000", change: "+6%" },
          { label: "Meta atingida", value: "72%", change: "+9%" },
        ],
        highlights: ["Ranking comercial", "Negócios próximos do fechamento", "Previsão de receita"],
      },
    ],
  },
  {
    label: "Inteligência",
    items: [
      {
        label: "Campanhas",
        path: "/campanhas",
        icon: Megaphone,
        description: "Gerencie campanhas, mídia e performance de aquisição.",
        metrics: [],
        highlights: [],
      },
      {
        label: "Análise de Funis",
        path: "/analise-de-funis",
        icon: GitBranch,
        description: "Visualize gargalos e conversões em cada etapa da jornada.",
        metrics: [
          { label: "Visitantes", value: "18.420", change: "+16%" },
          { label: "Leads", value: "1.286", change: "+12%" },
          { label: "Oportunidades", value: "214", change: "+8%" },
          { label: "Vendas", value: "42", change: "+11%" },
        ],
        highlights: ["Conversão por etapa", "Principais pontos de abandono", "Canais que mais convertem"],
      },
      {
        label: "IA do Funil",
        path: "/ia-do-funil",
        icon: Bot,
        description: "Receba diagnósticos e recomendações inteligentes para crescer.",
        metrics: [
          { label: "Insights ativos", value: "12", change: "+4" },
          { label: "Ações concluídas", value: "28", change: "+9" },
          { label: "Impacto estimado", value: "+21%", change: "alto" },
          { label: "Anomalias", value: "3", change: "revisar" },
        ],
        highlights: ["Oportunidades detectadas", "Recomendações prioritárias", "Resumo inteligente da semana"],
      },
      {
        label: "Alertas",
        path: "/alertas",
        icon: AlertTriangle,
        description: "Centralize desvios de performance e eventos críticos da operação.",
        metrics: [
          { label: "Críticos", value: "1", change: "agora" },
          { label: "Atenção", value: "4", change: "+2" },
          { label: "Resolvidos", value: "19", change: "+7" },
          { label: "Tempo médio", value: "2h 14m", change: "-18%" },
        ],
        highlights: ["Campanhas fora da meta", "Integrações sem sincronizar", "Queda de conversão"],
      },
      {
        label: "Automações",
        path: "/automacoes",
        icon: Workflow,
        description: "Crie regras para acelerar rotinas e conectar seus canais.",
        metrics: [
          { label: "Fluxos ativos", value: "18", change: "+3" },
          { label: "Execuções", value: "8.492", change: "+22%" },
          { label: "Economia estimada", value: "74h", change: "+16h" },
          { label: "Taxa de sucesso", value: "98,7%", change: "+0,8%" },
        ],
        highlights: ["Fluxos mais utilizados", "Gatilhos recentes", "Automações com falha"],
      },
      {
        label: "Growdash Flow",
        path: "/growdash-flow",
        icon: Share2,
        description: "Orquestre jornadas de ponta a ponta com blocos conectados.",
        metrics: [
          { label: "Jornadas", value: "9", change: "+2" },
          { label: "Pessoas em fluxo", value: "1.842", change: "+14%" },
          { label: "Etapas", value: "46", change: "+6" },
          { label: "Conclusão", value: "68%", change: "+5%" },
        ],
        highlights: ["Jornadas em execução", "Pontos de espera", "Próximas ações automáticas"],
      },
      {
        label: "Análise de Mídia Social",
        path: "/midia-social",
        icon: BarChart3,
        description: "Entenda alcance, engajamento e conteúdo dos seus perfis.",
        metrics: [
          { label: "Alcance", value: "486 mil", change: "+28%" },
          { label: "Engajamento", value: "7,8%", change: "+1,2%" },
          { label: "Seguidores", value: "32.840", change: "+934" },
          { label: "Publicações", value: "48", change: "+12" },
        ],
        highlights: ["Conteúdos com maior alcance", "Crescimento por rede", "Melhores horários"],
      },
    ],
  },
  {
    label: "Operação",
    items: [
      {
        label: "Agenda & Turmas",
        path: "/agenda-turmas",
        icon: CalendarDays,
        description: "Organize encontros, aulas, eventos e capacidade das turmas.",
        metrics: [
          { label: "Eventos hoje", value: "6", change: "+2" },
          { label: "Inscritos", value: "184", change: "+14" },
          { label: "Ocupação", value: "82%", change: "+7%" },
          { label: "Próxima turma", value: "18 jul", change: "4 dias" },
        ],
        highlights: ["Agenda da semana", "Turmas próximas do limite", "Lista de espera"],
      },
      {
        label: "Leads incompletos",
        path: "/leads-incompletos",
        icon: UsersRound,
        description: "Recupere contatos com cadastro incompleto ou jornada interrompida.",
        metrics: [
          { label: "Pendentes", value: "64", change: "+9" },
          { label: "Recuperados", value: "23", change: "+6" },
          { label: "Sem telefone", value: "18", change: "revisar" },
          { label: "Sem origem", value: "12", change: "revisar" },
        ],
        highlights: ["Cadastros recentes", "Leads recuperáveis", "Campos mais ausentes"],
      },
      {
        label: "Kanban",
        path: "/kanban",
        icon: Columns3,
        description: "Mova oportunidades pelo processo comercial de forma visual.",
        metrics: [
          { label: "Novos", value: "38", change: "+7" },
          { label: "Em contato", value: "54", change: "+4" },
          { label: "Proposta", value: "21", change: "+3" },
          { label: "Fechados", value: "12", change: "+2" },
        ],
        highlights: ["Cards sem movimentação", "Prioridades do dia", "Negócios ganhos"],
      },
      {
        label: "Chamados",
        path: "/chamados",
        icon: Headphones,
        description: "Acompanhe solicitações, prazos e qualidade do atendimento.",
        metrics: [
          { label: "Abertos", value: "14", change: "+3" },
          { label: "Em andamento", value: "8", change: "estável" },
          { label: "Resolvidos", value: "46", change: "+12" },
          { label: "SLA", value: "96%", change: "+2%" },
        ],
        highlights: ["Chamados prioritários", "SLA próximo do limite", "Últimas resoluções"],
      },
    ],
  },
  {
    label: "Gestão",
    items: [
      {
        label: "Financeiro",
        path: "/financeiro",
        icon: BadgeDollarSign,
        description: "Cruze investimento de mídia, receita, saldo e retorno por conta e marca.",
        metrics: [
          { label: "Investimento", value: "R$ 75,3 mil", change: "+8%" },
          { label: "Faturamento", value: "R$ 351,8 mil", change: "+21%" },
          { label: "ROAS consolidado", value: "4,67x", change: "+0,6x" },
          { label: "Saldo disponível", value: "R$ 54,3 mil", change: "12 dias" },
        ],
        highlights: ["Investimento x faturamento", "Saldo das contas", "Receita por marca"],
      },
      {
        label: "Armazenamento",
        path: "/armazenamento",
        icon: HardDrive,
        description: "Controle arquivos, fontes, uso e limites do workspace.",
        metrics: [],
        highlights: ["Quota do plano", "Arquivos por fonte", "Referências externas"],
      },
      {
        label: "Anúncios",
        path: "/anuncios",
        icon: PanelTop,
        description: "Publique banners globais por tela, período e prioridade.",
        metrics: [],
        highlights: ["Segmentação por tela", "Agendamento", "Controle de prioridade"],
      },
      {
        label: "Marcas",
        path: "/marcas",
        icon: Building2,
        description: "Organize contas, funis, equipes e resultados por marca.",
        metrics: [
          { label: "Marcas ativas", value: "2", change: "+1" },
          { label: "Contas de anúncio", value: "3", change: "+1" },
          { label: "Funis vinculados", value: "3", change: "+1" },
          { label: "Receita consolidada", value: "R$ 351 mil", change: "+21%" },
        ],
        highlights: ["Vida Leve", "Growdash", "Projeto Aurora"],
      },
      {
        label: "Produtos",
        path: "/produtos",
        icon: PackageOpen,
        description: "Cadastre produtos e conecte vendas, receita e atribuição comercial.",
        metrics: [
          { label: "Produtos ativos", value: "8", change: "+2" },
          { label: "Vendas", value: "54", change: "+12%" },
          { label: "Receita bruta", value: "R$ 351 mil", change: "+21%" },
          { label: "Ticket médio", value: "R$ 6.514", change: "+8%" },
        ],
        highlights: ["Receita por produto", "Origem das vendas", "Atribuição Meta/RD"],
      },
    ],
  },
  {
    label: "Administração",
    items: [
      {
        label: "Integrações",
        path: "/integracoes",
        icon: Cable,
        description: "Conecte Meta, Google, Drive e CRMs para manter os dados sincronizados.",
        metrics: [
          { label: "Conectadas", value: "3", change: "+1" },
          { label: "Contas sincronizadas", value: "6", change: "+2" },
          { label: "Última sincronização", value: "4 min", change: "estável" },
          { label: "Falhas", value: "1", change: "revisar" },
        ],
        highlights: ["Meta Ads", "RD Station CRM", "Google Ads"],
      },
      {
        label: "Usuários",
        path: "/usuarios",
        icon: UserCog,
        description: "Gerencie equipe, funções e acesso a marcas, contas e funis.",
        metrics: [
          { label: "Usuários ativos", value: "3", change: "+1" },
          { label: "Administradores", value: "1", change: "estável" },
          { label: "Convites pendentes", value: "2", change: "+2" },
          { label: "Acessos hoje", value: "3", change: "+1" },
        ],
        highlights: ["Controle por marca", "Permissões de mídia", "Permissões de funil"],
      },
      {
        label: "Agentes",
        path: "/agentes",
        icon: Sparkles,
        description: "Configure agentes de IA para monitorar mídia, funil e operação.",
        metrics: [
          { label: "Agentes ativos", value: "3", change: "+1" },
          { label: "Execuções", value: "522", change: "+18%" },
          { label: "Insights gerados", value: "94", change: "+22" },
          { label: "Ações sugeridas", value: "28", change: "+9" },
        ],
        highlights: ["Analista de Mídia", "Guardião do Funil", "Resumo Executivo"],
      },
      {
        label: "Configurações",
        path: "/configuracoes",
        icon: RectangleEllipsis,
        description: "Preferências da plataforma, notificações, metas e parâmetros globais.",
        metrics: [
          { label: "Meta mensal", value: "R$ 250 mil", change: "+12%" },
          { label: "Moeda", value: "BRL", change: "Brasil" },
          { label: "Fuso horário", value: "BRT", change: "UTC-3" },
          { label: "Notificações", value: "Ativas", change: "3 canais" },
        ],
        highlights: ["Metas e orçamento", "Notificações", "Preferências do workspace"],
      },
      {
        label: "Saúde dos Dados",
        path: "/saude-dos-dados",
        icon: Activity,
        description: "Audite sincronizações, duplicidades, divergências e cobertura Meta/RD.",
        metrics: [
          { label: "Qualidade geral", value: "94%", change: "+3%" },
          { label: "Sincronizações", value: "28", change: "+6" },
          { label: "Divergências", value: "3", change: "revisar" },
          { label: "Duplicidades", value: "1", change: "revisar" },
        ],
        highlights: ["Validação Meta", "Reconciliação RD", "Cobertura de leads"],
      },
    ],
  },
];

export const ALL_MODULES = NAV_SECTIONS.flatMap((section) => section.items);

export function findModule(pathname: string) {
  return ALL_MODULES.find((item) => item.path === pathname);
}
