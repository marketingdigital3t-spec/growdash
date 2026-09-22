import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleHelp,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Menu,
  Newspaper,
  Search,
  Settings,
  SlidersHorizontal,
  Users,
  Wrench,
  BarChart3,
  MonitorPlay,
  Workflow,
} from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { PageHeading } from "@/growdash/shared";
import { Button } from "@/components/ui/button";

type BusinessMenuItem = {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  external?: (accountId: string) => string;
};

const META_BASE = "https://business.facebook.com";

const PRIMARY_ITEMS: BusinessMenuItem[] = [
  { label: "Página inicial", path: "/business", icon: LayoutDashboard },
  { label: "Notificações", path: "/business/notifications", icon: Bell },
  { label: "Gerenciador de anúncios", path: "/business/ads-manager", icon: MonitorPlay },
  { label: "Caixa de entrada", path: "/business/inbox", icon: Inbox, external: () => `${META_BASE}/latest/inbox/all` },
  { label: "Central de Leads", path: "/business/leads", icon: Users, external: (id) => `${META_BASE}/latest/leads_center?asset_id=${encodeURIComponent(id)}` },
  { label: "Conteúdo", path: "/business/content", icon: Newspaper, external: () => `${META_BASE}/latest/content` },
  { label: "Creator Marketing", path: "/business/creator-marketing", icon: Workflow, external: () => `${META_BASE}/latest/creator-marketplace` },
  { label: "Planner", path: "/business/planner", icon: CalendarDays, external: () => `${META_BASE}/latest/planner` },
  { label: "Anúncios", path: "/business/ads", icon: Megaphone, external: (id) => `${META_BASE}/adsmanager/manage/ads?act=${encodeURIComponent(id)}` },
  { label: "Insights", path: "/business/insights", icon: BarChart3 },
  { label: "Monetização", path: "/business/monetization", icon: CircleDollarSign, external: () => `${META_BASE}/latest/monetization` },
  { label: "Todas as ferramentas", path: "/business/tools", icon: Wrench, external: (id) => `${META_BASE}/latest/home?asset_id=${encodeURIComponent(id)}` },
];

const SECONDARY_ITEMS: BusinessMenuItem[] = [
  { label: "Cobrança e pagamentos", path: "/business/billing", icon: CircleDollarSign, external: (id) => `${META_BASE}/billing_hub/accounts/details/?asset_id=${encodeURIComponent(id)}` },
  { label: "Gerenciador de eventos", path: "/business/events", icon: Workflow, external: (id) => `${META_BASE}/events_manager2/overview?act=${encodeURIComponent(id)}` },
];

const FOOTER_ITEMS: BusinessMenuItem[] = [
  { label: "Pesquisar", path: "/business/search", icon: Search },
  { label: "Configurações", path: "/business/settings", icon: Settings, external: (id) => `${META_BASE}/settings/ad-accounts/${encodeURIComponent(id)}` },
  { label: "Ajuda", path: "/business/help", icon: CircleHelp, external: () => "https://www.facebook.com/business/help" },
];

function MetaLink({ item, accountId, collapsed }: { item: BusinessMenuItem; accountId: string; collapsed: boolean }) {
  const href = item.external?.(accountId);
  if (item.external && !accountId && item.label !== "Ajuda") {
    return <span title={collapsed ? "Selecione uma conta Meta" : undefined} className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400"><item.icon className="h-4 w-4 shrink-0" /><span className={collapsed ? "sr-only" : "truncate"}>Selecione uma conta Meta</span></span>;
  }
  if (!href) {
    return <NavLink to={item.path} end={item.path === "/business"} title={collapsed ? item.label : undefined} className={({ isActive }) => `flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? "bg-slate-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}><item.icon className="h-4 w-4 shrink-0" /><span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span></NavLink>;
  }
  return <a href={href} target="_blank" rel="noreferrer" title={collapsed ? item.label : undefined} className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"><item.icon className="h-4 w-4 shrink-0" /><span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span><span className={collapsed ? "sr-only" : "ml-auto text-[10px] text-slate-400"}>Meta</span></a>;
}

export default function BusinessWorkspacePage() {
  const [collapsed, setCollapsed] = useState(() => {
    // v2 intentionally ignores the old compact-menu preference. The first
    // Business release could leave users with icons only and no visible labels.
    try { return localStorage.getItem("growdash:business-sidebar-collapsed:v2") === "true"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { adAccountId, setAdAccountId } = useGlobalFilters();
  const accountsQuery = useAdAccounts(false);
  const account = accountsQuery.data?.find((item) => item.id === adAccountId);
  const accountId = account?.id ?? "";
  const location = useLocation();
  const activeLabel = useMemo(() => [...PRIMARY_ITEMS, ...SECONDARY_ITEMS, ...FOOTER_ITEMS].find((item) => item.path === location.pathname)?.label, [location.pathname]);
  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    try { localStorage.setItem("growdash:business-sidebar-collapsed:v2", String(collapsed)); } catch { /* storage is optional */ }
  }, [collapsed]);

  return <div className="relative -ml-[var(--gd-layout-gutter)] -my-[var(--gd-page-gutter)] flex min-h-[calc(100vh-48px)] min-w-0 flex-1 overflow-hidden bg-background">
    {mobileOpen && <button type="button" aria-label="Fechar menu Business" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <aside className={`business-secondary-sidebar ${mobileOpen ? "flex" : "hidden"} fixed inset-y-0 left-0 z-40 shrink-0 flex-col border-r border-slate-200 bg-white text-slate-900 shadow-xl transition-[width] duration-200 lg:static lg:z-auto lg:flex lg:flex-col lg:shadow-none ${collapsed ? "w-16" : "w-64"}`} aria-label="Menu Business">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-3"><div className={collapsed ? "sr-only" : "flex items-center gap-2"}><div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-white"><Menu className="h-4 w-4" /></div><div><p className="text-sm font-bold leading-none">Meta</p><p className="text-xs leading-none text-slate-500">Business</p></div></div><Button variant="ghost" size="icon" aria-label={collapsed ? "Expandir menu Business" : "Recolher menu Business"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</Button></div>
      <div className="border-b border-slate-200 p-3">{collapsed ? <div className="grid h-9 place-items-center rounded-lg bg-slate-100 text-sm" title={account?.name || "Selecione uma conta Meta"}>{account ? "●" : "!"}</div> : accountsQuery.isLoading ? <div className="rounded-lg bg-slate-100 px-3 py-3 text-xs text-slate-400">Carregando contas…</div> : accountsQuery.isError ? <div className="rounded-lg bg-amber-50 px-3 py-3 text-xs text-amber-800">Falha ao carregar contas</div> : accountsQuery.data?.length ? <label className="block rounded-lg bg-slate-100 px-3 py-2"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Conta Meta</span><select value={adAccountId === "all" ? "" : adAccountId} onChange={(event) => setAdAccountId(event.target.value)} className="mt-1 w-full min-w-0 bg-transparent text-sm font-bold text-white outline-none" aria-label="Selecionar conta Meta">{!account && <option value="">Selecione uma conta</option>}{accountsQuery.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <div className="rounded-lg bg-amber-50 px-3 py-3 text-xs text-amber-800">Nenhuma conta autorizada</div>}</div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-2"><div className="space-y-1">{PRIMARY_ITEMS.map((item) => <MetaLink key={item.path} item={item} accountId={accountId} collapsed={collapsed} />)}</div><div className="my-3 border-t border-slate-200 pt-3"><p className={`px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${collapsed ? "sr-only" : ""}`}>Usadas com frequência</p>{SECONDARY_ITEMS.map((item) => <MetaLink key={item.path} item={item} accountId={accountId} collapsed={collapsed} />)}</div><div className="mt-3 border-t border-slate-200 pt-3">{FOOTER_ITEMS.map((item) => <MetaLink key={item.path} item={item} accountId={accountId} collapsed={collapsed} />)}</div></nav>
    </aside>
    <main className="min-w-0 flex-1 overflow-y-auto"><div className="border-b border-border/70 bg-background/95 px-4 py-3 lg:hidden"><Button variant="outline" size="sm" onClick={() => setMobileOpen((value) => !value)}><SlidersHorizontal className="mr-2 h-4 w-4" />Menu Business</Button></div><div className="mx-auto max-w-[1600px] p-4 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Meta Business Suite</p><p className="text-xs text-muted-foreground">{activeLabel || "Workspace"} · dados oficiais da conta selecionada</p></div>{account && <span className="rounded-full border border-border px-3 py-1 text-[10px] font-bold text-muted-foreground">{account.name}</span>}</div><Outlet /></div></main>
  </div>;
}

export function BusinessUnavailablePage({ title, description, externalUrl }: { title: string; description: string; externalUrl?: string }) {
  return <section className="mx-auto max-w-3xl"><PageHeading eyebrow="Meta Business Suite" title={title} description={description} /><div className="gd-panel p-6 text-center"><p className="text-sm text-muted-foreground">Este módulo só exibe dados oficiais. Quando a Meta não fornece o endpoint ou a permissão necessária, nenhum valor é estimado.</p>{externalUrl && <Button asChild className="mt-4"><a href={externalUrl} target="_blank" rel="noreferrer">Abrir ferramenta oficial da Meta</a></Button>}</div></section>;
}
