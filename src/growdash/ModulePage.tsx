/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
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
  ImageUp,
  LayoutGrid,
  ListFilter,
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
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import AgentsOfficePage from "./AgentsOfficePage";
import { useToast } from "@/hooks/use-toast";

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
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban"); // "kanban" for Trello, "list" for ClickUp
  const { data: workspace } = useWorkspace();
  const { toast } = useToast();

  // Fetch Boards
  const boardsQuery = useQuery({
    queryKey: ["kanban_boards", workspace?.id],
    queryFn: async () => {
      const wId = workspace?.id || "legacy-fallback-workspace";
      const { data, error } = await supabase
        .from("kanban_boards" as any)
        .select("*")
        .eq("workspace_id", wId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch Lists/Columns + Cards for Active Board
  const boardDetailsQuery = useQuery({
    queryKey: ["kanban_board_details", selectedBoardId],
    enabled: !!selectedBoardId,
    queryFn: async () => {
      const { data: lists, error: listsError } = await supabase
        .from("kanban_lists" as any)
        .select("*")
        .eq("board_id", selectedBoardId)
        .order("position");
      if (listsError) throw listsError;

      const listIds = (lists || []).map((l: any) => l.id);
      let cards: any[] = [];
      if (listIds.length > 0) {
        const { data: cardsRes, error: cardsError } = await supabase
          .from("kanban_cards" as any)
          .select("*")
          .in("list_id", listIds)
          .order("position");
        if (cardsError) throw cardsError;
        cards = cardsRes || [];
      }

      return { lists: lists || [], cards };
    }
  });

  const createBoard = async (name: string, desc = "") => {
    try {
      const { data: board, error } = await supabase
        .from("kanban_boards" as any)
        .insert({
          workspace_id: workspace?.id || "legacy-fallback-workspace",
          name,
          description: desc
        })
        .select()
        .single();
      if (error) throw error;

      // Default Columns
      const columns = ["A Fazer", "Em Progresso", "Concluído"];
      const colInserts = columns.map((colName, index) =>
        supabase.from("kanban_lists" as any).insert({
          board_id: board.id,
          name: colName,
          position: index
        })
      );
      await Promise.all(colInserts);

      toast({ title: "Quadro criado", description: `O quadro "${name}" foi configurado com sucesso.` });
      boardsQuery.refetch();
      setSelectedBoardId(board.id);
    } catch (e: any) {
      toast({ title: "Erro ao criar quadro", description: e.message, variant: "destructive" });
    }
  };

  const createCard = async (listId: string, title: string) => {
    try {
      const columnCards = boardDetailsQuery.data?.cards?.filter((c: any) => c.list_id === listId) || [];
      const newPos = columnCards.length;
      const { error } = await supabase.from("kanban_cards" as any).insert({
        list_id: listId,
        title,
        position: newPos
      });
      if (error) throw error;
      boardDetailsQuery.refetch();
    } catch (e: any) {
      toast({ title: "Erro ao criar cartão", description: e.message, variant: "destructive" });
    }
  };

  const deleteBoard = async (boardId: string) => {
    try {
      const { error } = await supabase.from("kanban_boards" as any).delete().eq("id", boardId);
      if (error) throw error;
      toast({ title: "Quadro excluído" });
      setSelectedBoardId(null);
      boardsQuery.refetch();
    } catch (e: any) {
      toast({ title: "Erro ao excluir quadro", description: e.message, variant: "destructive" });
    }
  };

  const activeBoard = boardsQuery.data?.find((b: any) => b.id === selectedBoardId);
  const filteredBoards = boardsQuery.data?.filter((b: any) => b.name.toLowerCase().includes(searchQuery.toLowerCase())) || [];

  if (selectedBoardId && activeBoard) {
    const details = boardDetailsQuery.data || { lists: [], cards: [] };
    return (
      <Page title={activeBoard.name} description={activeBoard.description || "Organização ágil de tarefas."} action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode(v => v === "kanban" ? "list" : "kanban")}>
            {viewMode === "kanban" ? "Ver como Lista (ClickUp)" : "Ver como Quadro (Trello)"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedBoardId(null)}>Voltar aos quadros</Button>
          <Button variant="destructive" size="sm" onClick={() => deleteBoard(activeBoard.id)}>Excluir quadro</Button>
        </div>
      }>
        {viewMode === "kanban" ? (
          <div className="mt-4 flex gap-4 overflow-x-auto pb-4 items-start min-h-[500px]">
            {details.lists.map((list: any) => {
              const listCards = details.cards.filter((c: any) => c.list_id === list.id);
              return (
                <div key={list.id} className="min-w-64 max-w-64 gd-panel p-3 bg-muted/40 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm">{list.name}</h3>
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-black">{listCards.length}</span>
                  </div>
                  <div className="space-y-2 mb-3">
                    {listCards.map((card: any) => (
                      <div key={card.id} className="p-3 bg-card border border-border rounded-lg shadow-sm text-xs break-all">
                        {card.title}
                      </div>
                    ))}
                    {listCards.length === 0 && (
                      <div className="py-8 text-center text-muted-foreground text-[10px]">Coluna vazia</div>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" className="w-full text-xs text-primary font-bold" onClick={() => {
                    const title = prompt("Digite o título da tarefa:");
                    if (title?.trim()) void createCard(list.id, title.trim());
                  }}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar cartão
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 gd-panel p-4 space-y-6">
            {details.lists.map((list: any) => {
              const listCards = details.cards.filter((c: any) => c.list_id === list.id);
              return (
                <div key={list.id} className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-border pb-1">
                    <h3 className="font-bold text-sm text-primary">{list.name}</h3>
                    <span className="text-xs text-muted-foreground">({listCards.length})</span>
                  </div>
                  <div className="divide-y divide-border">
                    {listCards.map((card: any) => (
                      <div key={card.id} className="py-2.5 flex items-center justify-between text-xs">
                        <span className="font-medium">{card.title}</span>
                      </div>
                    ))}
                    {listCards.length === 0 && (
                      <div className="py-4 text-muted-foreground text-xs italic">Nenhuma tarefa nesta lista</div>
                    )}
                  </div>
                  <Button size="xs" variant="ghost" className="text-[11px] text-primary font-bold mt-1" onClick={() => {
                    const title = prompt("Digite o título da tarefa:");
                    if (title?.trim()) void createCard(list.id, title.trim());
                  }}>
                    <Plus className="mr-1 h-3 w-3" /> Adicionar tarefa
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Page>
    );
  }

  const templates = [
    { name: "Pipeline comercial", desc: "Acompanhe funis e negócios de vendas." },
    { name: "Onboarding de cliente", desc: "Etapas de implantação de novos SaaS." },
    { name: "Produção de campanha", desc: "Gestão de criativos, copys e anúncios." },
    { name: "Acompanhamento de leads", desc: "Rotina de prospecção e triagem diária." }
  ];

  return (
    <Page title="Quadros" description="Organize vendas e operação em quadros visuais compartilhados." action={
      <Button size="sm" className="gold-action" onClick={() => {
        const name = prompt("Nome do quadro:");
        if (name?.trim()) void createBoard(name.trim());
      }}>
        <Plus className="h-4 w-4 mr-1" /> Criar quadro
      </Button>
    }>
      <Tabs options={[{ id: "boards", label: "Meus quadros" }, { id: "templates", label: "Templates" }]} value={tab} onChange={setTab} />
      {tab === "boards" ? (
        <>
          <Toolbar left={
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 sm:min-w-64">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar quadro" className="min-w-0 grow bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </label>
          } right={null} />

          {filteredBoards.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filteredBoards.map((board: any) => (
                <article key={board.id} className="gd-panel p-4 cursor-pointer hover:border-primary/55 hover:shadow-lg transition" onClick={() => setSelectedBoardId(board.id)}>
                  <LayoutGrid className="h-6 w-6 text-primary mb-3" />
                  <h3 className="font-bold text-sm mb-1">{board.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{board.description || "Sem descrição."}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={<LayoutGrid className="h-6 w-6" />} title="Nenum quadro criado" description="Crie um quadro vazio ou comece por um template. Colunas e cartões poderão ser arrastados sem recarregar a página." action={
              <Button size="sm" className="gold-action" onClick={() => {
                const name = prompt("Nome do quadro:");
                if (name?.trim()) void createBoard(name.trim());
              }}>
                <Plus className="h-4 w-4 mr-1" /> Criar primeiro quadro
              </Button>
            } />
          )}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {templates.map((template, index) => (
            <article key={template.name} className="gd-panel overflow-hidden">
              <div className="h-28 bg-[radial-gradient(circle_at_top_right,rgba(var(--brand-accent-rgb),.24),transparent_55%),linear-gradient(135deg,#080808,#151515)] p-4">
                <div className="flex gap-2">{[0, 1, 2].map((item) => <span key={item} className="h-14 flex-1 rounded-lg border border-white/10 bg-white/[.04]" />)}</div>
              </div>
              <div className="p-4">
                <span className="text-[9px] font-black uppercase tracking-[.16em] text-primary">Template {index + 1}</span>
                <h2 className="mt-1 font-black text-sm">{template.name}</h2>
                <p className="text-[11px] text-muted-foreground mt-1 min-h-10 leading-normal">{template.desc}</p>
                <button type="button" className="mt-4 inline-flex items-center gap-2 text-xs font-black text-primary" onClick={() => void createBoard(template.name, template.desc)}>
                  Usar template <ArrowRight className="h-4 w-4" />
                </button>
              </div>
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
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{counters.map((label) => <div key={label} className="gd-panel min-w-0 p-4"><span className="block truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span><strong className="mt-2 block text-2xl">0</strong></div>)}</div>
      <Tabs options={[{ id: "all", label: "Todos" }, { id: "open", label: "Abertos" }, { id: "progress", label: "Em andamento" }]} value={tab} onChange={setTab} />
      <EmptyState icon={<TicketCheck className="h-6 w-6" />} title="Nenhum chamado por aqui" description="Os chamados da marca e do status selecionados aparecerão nesta lista." />
    </Page>
  );
}

function BrandsModule() {
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [uploadingBrand, setUploadingBrand] = useState<string | null>(null);
  const { toast } = useToast();
  const { data: workspace } = useWorkspace();
  const { data: accounts = [] } = useAdAccounts();
  const companiesQuery = useQuery({
    queryKey: ["companies", workspace?.id],
    enabled: !!workspace?.id && !workspace.id.startsWith("legacy-"),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("companies")
        .select("id, workspace_id, business_unit_id, name, status, metadata, created_at, updated_at")
        .eq("workspace_id", workspace!.id)
        .neq("status", "archived")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const storedCompanies = companiesQuery.data ?? [];
  const brands = useMemo(() => {
    const byMetaId = new Map<string, any>();
    const result = storedCompanies.map((company: any) => {
      const metaId = company.metadata?.meta_account_id;
      if (metaId) byMetaId.set(String(metaId), company);
      return company;
    });
    for (const account of accounts) {
      if (byMetaId.has(String(account.account_id))) continue;
      result.push({
        id: `account-${account.id}`,
        name: account.name || `Conta Meta ${account.account_id}`,
        status: "active",
        metadata: { source: "meta_ads", meta_account_id: account.account_id, ad_account_id: account.id, pending_persistence: true },
      });
    }
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return result
      .filter((brand: any) => !query || brand.name.toLocaleLowerCase("pt-BR").includes(query) || String(brand.metadata?.meta_account_id || "").includes(query))
      .sort((a: any, b: any) => a.name.localeCompare(b.name, "pt-BR"));
  }, [accounts, search, storedCompanies]);

  const syncBrands = async () => {
    if (!workspace?.id || workspace.id.startsWith("legacy-") || accounts.length === 0) return;
    setSyncing(true);
    try {
      const rows = accounts.map((account) => ({
        workspace_id: workspace.id,
        business_unit_id: account.business_unit_id || null,
        name: account.name || `Conta Meta ${account.account_id}`,
        status: "active",
        metadata: { source: "meta_ads", ad_account_id: account.id, meta_account_id: account.account_id, auto_created: true },
      }));
      const { error } = await (supabase as any).from("companies").upsert(rows, { onConflict: "workspace_id,name" });
      if (error) throw error;
      await companiesQuery.refetch();
    } finally {
      setSyncing(false);
    }
  };

  const uploadBanner = async (brand: any, file?: File) => {
    if (!file || !workspace?.id || workspace.id.startsWith("legacy-")) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      toast({ title: "Banner inválido", description: "Use PNG, JPG ou WebP com até 10 MB.", variant: "destructive" });
      return;
    }
    setUploadingBrand(brand.id);
    try {
      let companyId = brand.id;
      let metadata = brand.metadata || {};
      if (String(brand.id).startsWith("account-")) {
        const account = accounts.find((item) => item.id === brand.metadata?.ad_account_id);
        const { data, error } = await (supabase as any).from("companies").upsert({
          workspace_id: workspace.id,
          business_unit_id: account?.business_unit_id || null,
          name: brand.name,
          status: "active",
          metadata,
        }, { onConflict: "workspace_id,name" }).select("id,metadata").single();
        if (error) throw error;
        companyId = data.id;
        metadata = data.metadata || metadata;
      }
      const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${workspace.id}/${companyId}/banner-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("brand-banners").upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("brand-banners").getPublicUrl(path);
      const previousPath = metadata.banner_path;
      const { error: updateError } = await (supabase as any).from("companies").update({ metadata: { ...metadata, banner_path: path, banner_url: publicData.publicUrl }, updated_at: new Date().toISOString() }).eq("id", companyId).eq("workspace_id", workspace.id);
      if (updateError) throw updateError;
      if (previousPath && previousPath !== path) await supabase.storage.from("brand-banners").remove([previousPath]);
      await companiesQuery.refetch();
      toast({ title: "Banner atualizado", description: `A identidade visual de ${brand.name} foi salva.` });
    } catch (error) {
      toast({ title: "Não foi possível alterar o banner", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setUploadingBrand(null);
    }
  };

  return (
    <Page title="Marcas" description="Cada conta de anúncio integrada gera automaticamente uma marca com diagnóstico e histórico próprios." action={<Link to="/integracoes" className="gold-action"><Plus className="h-4 w-4" /> Integrar conta</Link>}>
      <Toolbar
        left={<label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 sm:min-w-72"><Search className="h-4 w-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar marca" placeholder="Buscar marca ou ID da conta" className="min-w-0 grow bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>}
        right={<button type="button" onClick={syncBrands} disabled={syncing || accounts.length === 0} className="gd-button disabled:cursor-not-allowed disabled:opacity-50"><Zap className={cn("h-4 w-4", syncing && "animate-pulse")} /> {syncing ? "Sincronizando…" : "Sincronizar marcas"}</button>}
      />
      {brands.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {brands.map((brand: any) => <article key={brand.id} className="gd-panel group overflow-hidden">
          <div className="relative h-32 border-b border-border bg-[radial-gradient(circle_at_18%_12%,hsl(var(--primary)/.28),transparent_36%),radial-gradient(circle_at_85%_20%,hsl(var(--primary)/.12),transparent_42%),linear-gradient(145deg,#050505,#11100d)] bg-cover bg-center" style={brand.metadata?.banner_url ? { backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.62),rgba(0,0,0,.08)),url(${brand.metadata.banner_url})` } : undefined}>
            <span className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-2xl border border-primary/25 bg-black/55 text-primary shadow-[0_0_24px_hsl(var(--primary)/.15)]"><UsersRound className="h-5 w-5" /></span>
            <span className="absolute right-4 top-4 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase text-emerald-400">Integrada</span>
            <label className="absolute bottom-3 right-3 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 bg-black/70 px-2.5 text-[9px] font-black text-white backdrop-blur-md transition hover:bg-black/85">
              <ImageUp className="h-3.5 w-3.5" />{uploadingBrand === brand.id ? "Enviando…" : "Alterar banner"}
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingBrand === brand.id} className="sr-only" onChange={(event) => { void uploadBanner(brand, event.target.files?.[0]); event.currentTarget.value = ""; }} />
            </label>
          </div>
          <div className="p-4">
            <h2 className="truncate text-sm font-black" title={brand.name}>{brand.name}</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">Meta Ads · {brand.metadata?.meta_account_id || "ID em sincronização"}</p>
            <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg border border-border bg-background/50 p-2"><span className="block text-[8px] font-black uppercase text-muted-foreground">Contas</span><strong className="mt-1 block text-sm">1</strong></div><div className="rounded-lg border border-border bg-background/50 p-2"><span className="block text-[8px] font-black uppercase text-muted-foreground">Status</span><strong className="mt-1 block text-sm text-emerald-500">Ativa</strong></div></div>
            <Link to={`/marcas/${encodeURIComponent(brand.id)}`} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-primary">Abrir diagnóstico <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </div>
        </article>)}
      </div> : <EmptyState icon={<UsersRound className="h-6 w-6" />} title="Nenhuma conta integrada" description="Ao integrar uma conta Meta Ads, a marca correspondente será criada automaticamente e aparecerá aqui, mesmo antes de receber métricas." action={<Link to="/integracoes" className="gold-action"><Plus className="h-4 w-4" /> Integrar primeira conta</Link>} />}
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
  if (pathname === "/agentes") return <AgentsOfficePage />;
  if (pathname === "/ia-do-funil") return <FunnelAIModule />;
  return <Navigate to="/" replace />;
}
