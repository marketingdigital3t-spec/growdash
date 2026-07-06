import {
  Home,
  Calendar,
  Users,
  Stethoscope,
  ShoppingCart,
  DollarSign,
  BadgePercent,
  Package,
  MessageSquare,
  FileEdit,
  Heart,
  Flower2,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type SubItem = { label: string; path: string };
export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: "new" | "dot";
  submenu?: SubItem[];
};

export const NAV: NavItem[] = [
  { id: "home", label: "Início", icon: Home, path: "/" },
  {
    id: "agenda",
    label: "Agenda",
    icon: Calendar,
    path: "/agenda",
    submenu: [
      { label: "Agenda", path: "/agenda/semana" },
      { label: "Visão geral", path: "/agenda/visao-geral" },
      { label: "Relatório de agendamentos", path: "/agenda/relatorio-agendamentos" },
      { label: "Eventos", path: "/agenda/eventos" },
    ],
  },
  {
    id: "contatos",
    label: "Contatos",
    icon: Users,
    path: "/contatos",
    submenu: [
      { label: "Pacientes", path: "/contatos/pacientes" },
      { label: "Profissionais", path: "/contatos/profissionais" },
      { label: "Fornecedores", path: "/contatos/fornecedores" },
      { label: "Leads", path: "/contatos/leads" },
      { label: "Todos os contatos", path: "/contatos/todos" },
      { label: "Aniversariantes", path: "/contatos/aniversariantes" },
      { label: "Frequência", path: "/contatos/frequencia" },
      { label: "Mesclar contatos", path: "/contatos/mesclar" },
      { label: "Convidar colaboradores", path: "/contatos/convidar" },
    ],
  },
  {
    id: "atendimentos",
    label: "Atendimentos",
    icon: Stethoscope,
    path: "/atendimentos",
    submenu: [
      { label: "Listagem", path: "/atendimentos/listagem" },
      { label: "Atestados e prescrições", path: "/atendimentos/atestados" },
      { label: "Guias SP/SADT", path: "/atendimentos/guias" },
    ],
  },
  {
    id: "vendas",
    label: "Vendas",
    icon: ShoppingCart,
    path: "/vendas",
    submenu: [
      { label: "Vendas", path: "/vendas/lista" },
      { label: "Orçamentos", path: "/vendas/orcamentos" },
      { label: "Pacotes", path: "/vendas/pacotes" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: DollarSign,
    path: "/financeiro",
    submenu: [
      { label: "Fluxo de caixa", path: "/financeiro/fluxo-de-caixa" },
      { label: "Contas a pagar", path: "/financeiro/contas-a-pagar" },
      { label: "Contas a receber", path: "/financeiro/contas-a-receber" },
      { label: "Extrato", path: "/financeiro/extrato" },
    ],
  },
  { id: "comissoes", label: "Comissões", icon: BadgePercent, path: "/comissoes" },
  {
    id: "estoque",
    label: "Estoque",
    icon: Package,
    path: "/estoque",
    submenu: [
      { label: "Produtos", path: "/estoque/produtos" },
      { label: "Movimentações", path: "/estoque/movimentacoes" },
    ],
  },
  {
    id: "comunicacao",
    label: "Comunicação",
    icon: MessageSquare,
    path: "/comunicacao",
    submenu: [
      { label: "WhatsApp", path: "/comunicacao/whatsapp" },
      { label: "E-mail", path: "/comunicacao/email" },
      { label: "SMS", path: "/comunicacao/sms" },
    ],
  },
  { id: "chat-seguro", label: "Chat Seguro", icon: ShieldCheck, path: "/chat-seguro", badge: "new" },
  {
    id: "clinidocs",
    label: "CliniDocs",
    icon: FileEdit,
    path: "/clinidocs",
    badge: "new",
    submenu: [
      { label: "Modelos", path: "/clinidocs/modelos" },
      { label: "Documentos", path: "/clinidocs/documentos" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Heart,
    path: "/marketing",
    submenu: [
      { label: "Campanhas", path: "/marketing/campanhas" },
      { label: "Aniversariantes", path: "/marketing/aniversariantes" },
    ],
  },
  { id: "comunidade", label: "Comunidade", icon: Flower2, path: "/comunidade" },
  {
    id: "config",
    label: "Configurações",
    icon: Settings,
    path: "/config",
    submenu: [
      { label: "Preferências do sistema", path: "/config/preferencias" },
      { label: "Perfil", path: "/config/perfil" },
      { label: "Dados da clínica", path: "/config/clinica" },
      { label: "Usuários", path: "/config/usuarios" },
      { label: "Assinatura", path: "/config/assinatura" },
      { label: "Loja de extensões", path: "/config/extensoes" },
      { label: "Site da clínica", path: "/config/site" },
      { label: "Procedimentos", path: "/config/procedimentos" },
      { label: "Categorias de procedimentos", path: "/config/categorias-procedimentos" },
      { label: "Pacotes", path: "/config/pacotes" },
      { label: "Salas de atendimento", path: "/config/salas" },
      { label: "Fichas de atendimentos", path: "/config/fichas" },
      { label: "Modelos de atestados e prescrições", path: "/config/modelos-documentos" },
      { label: "Etiquetas", path: "/config/etiquetas" },
      { label: "Horários de funcionamento", path: "/config/horarios" },
      { label: "Migração", path: "/config/migracao" },
    ],
  },
];
