import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Facebook,
  FileSpreadsheet,
  FolderPlus,
  Instagram,
  KeyRound,
  LayoutGrid,
  ListFilter,
  LockKeyhole,
  MailPlus,
  MessageSquareText,
  MoreHorizontal,
  MoveRight,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  TicketCheck,
  Trash2,
  UserRoundPlus,
  UsersRound,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { PageHeading } from "./shared";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { cn } from "@/lib/utils";

type TabOption = { id: string; label: string };

function Tabs({ options, value, onChange }: { options: TabOption[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 growdash-scrollbar-hidden" role="tablist">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "min-h-9 shrink-0 rounded-lg px-4 text-xs font-extrabold transition",
            value === option.id ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(255,190,46,.12)]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-border bg-card/55 p-6 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">{icon}</span>
        <h2 className="mt-4 text-base font-black">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}

function ActionButton({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  return <button type="button" className={primary ? "gold-action" : "gd-button"}>{children}</button>;
}

function AutomationsModule() {
  const [tab, setTab] = useState("mine");
  const templates = [
    { title: "Novo lead recebido", description: "Dispare uma mensagem e atribua um responsável quando um lead entrar no funil.", icon: Zap },
    { title: "Follow-up sem resposta", description: "Aguarde o intervalo configurado e retome o contato com o lead automaticamente.", icon: Clock3 },
    { title: "Negociação ganha", description: "Avise o time, registre a conversão e inicie a rotina de pós-venda.", icon: CheckCircle2 },
  ];

  return (
    <Page title="Automações" description="Crie regras, sequências e fluxos para executar rotinas sem trabalho manual." action={<ActionButton primary><Plus className="h-4 w-4" /> Nova automação</ActionButton>}>
      <Tabs options={[{ id: "mine", label: "Minhas Automações" }, { id: "basic", label: "Básico" }, { id: "sequences", label: "Sequências" }]} value={tab} onChange={setTab} />
      {tab === "mine" ? (
        <>
          <Toolbar left={<><SearchField placeholder="Buscar automação" /><ActionButton><FolderPlus className="h-4 w-4" /> Nova pasta</ActionButton></>} right={<><ActionButton><ListFilter className="h-4 w-4" /> Gatilho</ActionButton><ActionButton><LayoutGrid className="h-4 w-4" /> Grade</ActionButton></>} />
          <EmptyState icon={<Workflow className="h-6 w-6" />} title="Nenhuma automação criada" description="Crie seu primeiro fluxo ou use um modelo seguro. Rascunhos não executam ações até serem publicados." action={<ActionButton primary><Plus className="h-4 w-4" /> Criar automação</ActionButton>} />
        </>
      ) : tab === "basic" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map(({ title, description, icon: Icon }) => (
            <article key={title} className="gd-panel p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
              <h2 className="mt-4 font-black">{title}</h2>
              <p className="mt-2 min-h-16 text-xs leading-relaxed text-muted-foreground">{description}</p>
              <button type="button" className="mt-4 inline-flex items-center gap-2 text-xs font-black text-primary">Configurar <ArrowRight className="h-4 w-4" /></button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={<MessageSquareText className="h-6 w-6" />} title="Nenhuma sequência ativa" description="Monte cadências de contato com espera, condição, mensagem e saída segura." action={<ActionButton primary><Plus className="h-4 w-4" /> Nova sequência</ActionButton>} />
      )}
    </Page>
  );
}

function KanbanModule() {
  const [tab, setTab] = useState("boards");
  const templates = ["Pipeline comercial", "Onboarding de cliente", "Produção de campanha", "Acompanhamento de leads"];
  return (
    <Page title="Quadros" description="Organize vendas e operação em quadros visuais compartilhados." action={<ActionButton primary><Plus className="h-4 w-4" /> Criar quadro</ActionButton>}>
      <Tabs options={[{ id: "boards", label: "Meus quadros" }, { id: "templates", label: "Templates" }]} value={tab} onChange={setTab} />
      {tab === "boards" ? (
        <>
          <Toolbar left={<SearchField placeholder="Buscar quadro" />} right={<ActionButton><Star className="h-4 w-4" /> Favoritos</ActionButton>} />
          <EmptyState icon={<LayoutGrid className="h-6 w-6" />} title="Nenhum quadro criado" description="Crie um quadro vazio ou comece por um template. Colunas e cartões poderão ser arrastados sem recarregar a página." action={<ActionButton primary><Plus className="h-4 w-4" /> Criar primeiro quadro</ActionButton>} />
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {templates.map((template, index) => (
            <article key={template} className="gd-panel overflow-hidden">
              <div className="h-28 bg-[radial-gradient(circle_at_top_right,rgba(255,196,61,.24),transparent_55%),linear-gradient(135deg,#080808,#151515)] p-4">
                <div className="flex gap-2">{[0, 1, 2].map((item) => <span key={item} className="h-14 flex-1 rounded-lg border border-white/10 bg-white/[.04]" />)}</div>
              </div>
              <div className="p-4"><span className="text-[9px] font-black uppercase tracking-[.16em] text-primary">Template {index + 1}</span><h2 className="mt-1 font-black">{template}</h2><button type="button" className="mt-4 inline-flex items-center gap-2 text-xs font-black text-primary">Usar template <ArrowRight className="h-4 w-4" /></button></div>
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}

function TicketsModule() {
  const [tab, setTab] = useState("all");
  const counters = ["Total", "Assinantes", "Abertos", "Em andamento", "Aguardando", "Resolvidos"];
  return (
    <Page title="Chamados" description="Abra, acompanhe e resolva problemas por marca." action={<ActionButton primary><Plus className="h-4 w-4" /> Novo chamado</ActionButton>}>
      <Toolbar left={<><ActionButton><FileSpreadsheet className="h-4 w-4" /> Abrir planilha</ActionButton><ActionButton><Zap className="h-4 w-4" /> Sincronizar Sheets</ActionButton></>} right={<ActionButton><Settings2 className="h-4 w-4" /> Todas as marcas</ActionButton>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{counters.map((label) => <div key={label} className="gd-panel p-4"><span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span><strong className="mt-2 block text-2xl">0</strong></div>)}</div>
      <Tabs options={[{ id: "all", label: "Todos" }, { id: "open", label: "Abertos" }, { id: "progress", label: "Em andamento" }]} value={tab} onChange={setTab} />
      <EmptyState icon={<TicketCheck className="h-6 w-6" />} title="Nenhum chamado por aqui" description="Os chamados da marca e do status selecionados aparecerão nesta lista." />
    </Page>
  );
}

function BrandsModule() {
  return (
    <Page title="Marca" description="Centralize diagnóstico, oferta, público, posicionamento e histórico de tráfego de cada operação." action={<ActionButton primary><Plus className="h-4 w-4" /> Nova marca</ActionButton>}>
      <Toolbar left={<SearchField placeholder="Buscar marca" />} right={<ActionButton><Zap className="h-4 w-4" /> Sincronizar marcas</ActionButton>} />
      <EmptyState icon={<UsersRound className="h-6 w-6" />} title="Nenhuma marca disponível para este usuário" description="Sincronize as marcas das integrações ou cadastre uma nova. Contas de anúncio só serão associadas após confirmação." action={<ActionButton primary><Plus className="h-4 w-4" /> Cadastrar marca</ActionButton>} />
    </Page>
  );
}

function MetaConnectModule() {
  const [tab, setTab] = useState("dashboard");
  const { data: accounts = [], isLoading } = useAdAccounts();
  const connected = useMemo(() => accounts.filter((account) => account.status !== "disconnected"), [accounts]);
  return (
    <Page title="Meta Connect" description="Gerencie Facebook, Instagram e contas de anúncio vinculadas à Growdash." action={<Link to="/integracoes" className="gold-action"><Facebook className="h-4 w-4" /> Conectar com Facebook</Link>}>
      <Tabs options={[{ id: "dashboard", label: "Dashboard" }, { id: "accounts", label: "Contas de anúncio" }, { id: "instagram", label: "Instagram" }, { id: "settings", label: "Configurações" }]} value={tab} onChange={setTab} />
      {tab === "dashboard" && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><ConnectionCard icon={<Facebook />} label="Facebook" value={connected.length ? "Conectado" : "Desconectado"} /><ConnectionCard icon={<Instagram />} label="Perfis Instagram" value="Verificar conexão" /><ConnectionCard icon={<CircleDot />} label="Contas de anúncio" value={isLoading ? "Carregando…" : String(connected.length)} /><ConnectionCard icon={<Clock3 />} label="Última sincronização" value="Consulte Integrações" /></div>}
      {tab === "accounts" && (connected.length ? <div className="grid gap-3 md:grid-cols-2">{connected.map((account) => <article key={account.id} className="gd-panel flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400"><Facebook className="h-5 w-5" /></span><div className="min-w-0 grow"><b className="block truncate text-sm">{account.name}</b><span className="text-xs text-muted-foreground">{account.account_id}</span></div><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-400">Conectada</span></article>)}</div> : <EmptyState icon={<Facebook className="h-6 w-6" />} title="Nenhuma conta Meta conectada" description="Use o login oficial da Meta ou a conexão manual segura disponível em Integrações." action={<Link to="/integracoes" className="gold-action">Abrir integrações <ArrowRight className="h-4 w-4" /></Link>} />)}
      {tab === "instagram" && <EmptyState icon={<Instagram className="h-6 w-6" />} title="Perfis do Instagram" description="Os perfis comerciais autorizados pela conta Meta aparecerão aqui após a sincronização." action={<Link to="/midia-social" className="gd-button">Abrir Mídia Social <ArrowRight className="h-4 w-4" /></Link>} />}
      {tab === "settings" && <div className="gd-panel divide-y divide-border"><SettingRow title="Sincronização automática" description="Atualiza contas autorizadas sem expor tokens no navegador." /><SettingRow title="Permissões Meta" description="ads_read, ads_management, business_management e leads_retrieval." /><SettingRow title="Saúde dos tokens" description="Audite expiração, permissões e falhas de acesso." /></div>}
    </Page>
  );
}

function AgentsModule() {
  const [password, setPassword] = useState("");
  return (
    <Page title="Agentes" description="Agentes especializados para monitorar mídia, funil e operação com acesso protegido.">
      <div className="grid min-h-[560px] place-items-center overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_50%_25%,rgba(255,196,61,.12),transparent_36%),linear-gradient(145deg,#070707,#0d0d0d)] p-5">
        <form className="w-full max-w-md rounded-2xl border border-white/10 bg-black/55 p-6 text-center shadow-2xl backdrop-blur-xl" onSubmit={(event) => event.preventDefault()}>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"><LockKeyhole className="h-7 w-7" /></span>
          <h2 className="mt-5 text-xl font-black text-white">Área protegida</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">O acesso adicional deve ser validado pelo backend. A Growdash não armazena essa senha no navegador.</p>
          <label className="mt-6 block text-left text-xs font-bold text-white/70">Senha adicional</label>
          <div className="mt-2 flex h-11 items-center rounded-xl border border-white/15 bg-black/50 px-3"><KeyRound className="h-4 w-4 text-primary" /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" className="h-full min-w-0 grow bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/30" /></div>
          <button type="submit" disabled={!password} className="gold-action mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-40">Entrar <ArrowRight className="h-4 w-4" /></button>
          <button type="button" className="mt-4 text-xs font-bold text-primary">Esqueci minha senha</button>
        </form>
      </div>
    </Page>
  );
}

function FunnelAIModule() {
  return (
    <Page title="IA do Funil" description="Diagnósticos baseados nos dados reais de Meta Ads e RD Station da conta selecionada." action={<Link to="/analise-de-funis" className="gold-action"><Sparkles className="h-4 w-4" /> Analisar funil</Link>}>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <EmptyState icon={<Bot className="h-6 w-6" />} title="Selecione um funil com dados sincronizados" description="A IA só gera recomendações quando houver período, conta Meta e funil RD válidos. Nenhum diagnóstico é inventado para preencher a tela." action={<Link to="/analise-de-funis" className="gd-button">Abrir Análise de Funis <ArrowRight className="h-4 w-4" /></Link>} />
        <div className="gd-panel p-5"><h2 className="font-black">O que será analisado</h2><div className="mt-4 space-y-3">{["Gargalos entre etapas", "CPL, CAC e ROAS reconciliados", "Tempo parado e velocidade", "Origem, estado, dia e horário"].map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" />{item}</div>)}</div></div>
      </div>
    </Page>
  );
}

function Page({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1600px]"><PageHeading title={title} description={description} actions={action} />{children}</div>;
}

function Toolbar({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 flex-col gap-2 sm:flex-row">{left}</div><div className="flex min-w-0 flex-col gap-2 sm:flex-row">{right}</div></div>;
}

function SearchField({ placeholder }: { placeholder: string }) {
  return <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 sm:min-w-64"><Search className="h-4 w-4 text-muted-foreground" /><input aria-label={placeholder} placeholder={placeholder} className="min-w-0 grow bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>;
}

function ConnectionCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <article className="gd-panel p-5"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></div><span className="mt-5 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</span><strong className="mt-1 block text-lg">{value}</strong></article>;
}

function SettingRow({ title, description }: { title: string; description: string }) {
  return <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0 grow"><b className="text-sm">{title}</b><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><button type="button" className="gd-button"><Settings2 className="h-4 w-4" /> Configurar</button></div>;
}

export default function ModulePage() {
  const { pathname } = useLocation();
  if (pathname === "/automacoes") return <AutomationsModule />;
  if (pathname === "/kanban") return <KanbanModule />;
  if (pathname === "/chamados") return <TicketsModule />;
  if (pathname === "/marcas") return <BrandsModule />;
  if (pathname === "/meta-connect") return <MetaConnectModule />;
  if (pathname === "/agentes") return <AgentsModule />;
  if (pathname === "/ia-do-funil") return <FunnelAIModule />;
  return <Navigate to="/" replace />;
}
