import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { endOfMonth, startOfMonth } from "date-fns";
import { NAV_SECTIONS } from "./navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useIsMaster } from "@/hooks/useIsMaster";
import { BrandLogo, BrandMark } from "@/components/BrandLogo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GlobalAnnouncementBanner } from "@/components/announcements/GlobalAnnouncementBanner";
import { aggregateSales, useSales } from "@/hooks/useSales";
import { useSalesGoals } from "@/hooks/useSalesGoals";
import { TopbarMonthlyGoal } from "@/components/dashboard/DashboardGoalProgress";

const SIDEBAR_STORAGE_KEY = "growdash:sidebar-collapsed";

function getInitialSidebarState() {
  if (typeof window === "undefined") return false;
  const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
  if (saved !== null) return saved === "true";
  return window.innerWidth >= 768 && window.innerWidth < 1024;
}

export default function GrowdashLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getInitialSidebarState);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const { pathname } = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { data: isMaster = false } = useIsMaster();
  const { data: adAccounts = [] } = useAdAccounts();
  const {
    adAccountId,
    setAdAccountId,
    segment,
    setSegment,
    businessUnitId,
  } = useGlobalFilters();
  const visibleAccounts = useMemo(
    () => businessUnitId
      ? adAccounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
      : adAccounts,
    [adAccounts, businessUnitId, segment],
  );
  const visibleAccountIds = useMemo(() => new Set(visibleAccounts.map((account) => account.id)), [visibleAccounts]);
  const { data: monthlySales = [] } = useSales({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    adAccountId: adAccountId === "all" ? undefined : adAccountId,
  });
  const { data: goalData, isLoading: loadingGoals } = useSalesGoals(new Date());
  const goalRevenue = useMemo(() => aggregateSales(monthlySales.filter((sale) => !!sale.ad_account_id && visibleAccountIds.has(sale.ad_account_id) && (adAccountId === "all" || sale.ad_account_id === adAccountId))).totalNet, [adAccountId, monthlySales, visibleAccountIds]);
  const goalTarget = useMemo(() => (goalData?.rows ?? []).filter((goal) => visibleAccountIds.has(goal.ad_account_id) && (adAccountId === "all" || goal.ad_account_id === adAccountId)).reduce((sum, goal) => sum + Number(goal.target_revenue), 0), [adAccountId, goalData?.rows, visibleAccountIds]);
  const goalAccountLabel = adAccountId === "all"
    ? `Meta mensal · todas as contas · ${segment === "saas" ? "SaaS" : "Infoproduto"}`
    : `Meta mensal · ${visibleAccounts.find((account) => account.id === adAccountId)?.name || "Conta selecionada"}`;

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuário";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase();
  const showSidebarLabels = !collapsed || sidebarHovered || mobileOpen;

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed]);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  useEffect(() => {
    if (adAccountId !== "all" && businessUnitId && !visibleAccounts.some((account) => account.id === adAccountId)) {
      setAdAccountId("all");
    }
  }, [adAccountId, businessUnitId, setAdAccountId, visibleAccounts]);

  return (
    <div className="brand-shell min-h-screen max-w-full overflow-x-clip text-foreground transition-colors">
      <aside
        onMouseEnter={() => collapsed && setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={cn(
          "brand-sidebar growdash-safe-sidebar fixed inset-y-0 left-0 z-50 flex flex-col border-r text-white shadow-[20px_0_65px_-42px_rgba(0,0,0,.95)] transition-all duration-300",
          showSidebarLabels ? "w-[220px]" : "w-16",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className={cn("flex h-[86px] shrink-0 items-center border-b border-white/5", showSidebarLabels ? "px-4" : "justify-center px-2")}>
          <NavLink to="/" className="flex min-w-0 items-center" aria-label="Growdash - início">
            {showSidebarLabels ? (
              <BrandLogo eager className="h-[66px] w-[178px] shrink-0" />
            ) : (
              <BrandMark className="h-10 w-10 shrink-0 drop-shadow-[0_0_12px_rgba(255,193,45,.3)]" />
            )}
          </NavLink>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-lg p-2 text-white/60 hover:bg-white/10 md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <TooltipProvider delayDuration={180}>
        <nav className={cn("grow overflow-y-auto px-2 py-4", showSidebarLabels ? "growdash-scrollbar" : "growdash-scrollbar-hidden")}>
          {NAV_SECTIONS.map((section) => (
            <section key={section.label} className="mb-5">
              {showSidebarLabels && (
                <div className="mb-1 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[.19em] text-white/55">
                  <span>{section.label}</span>
                  <ChevronDown className="h-3 w-3" />
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
                  const link = (
                    <NavLink
                      to={item.path}
                      end={item.path === "/"}
                      title={!showSidebarLabels ? item.label : undefined}
                      aria-label={item.label}
                      className={cn(
                        "group flex h-10 w-full items-center rounded-lg text-[13px] font-medium transition-colors",
                        showSidebarLabels ? "gap-3 px-3" : "justify-center px-0",
                        !showSidebarLabels
                          ? "border border-transparent bg-transparent text-white shadow-none hover:bg-transparent hover:text-white"
                          : isActive
                          ? "border border-[#f0bd35]/30 bg-gradient-to-r from-[#6a521e] to-[#3a301a] text-[#ffd868] shadow-[inset_0_1px_0_rgba(255,255,255,.06)]"
                          : "border border-transparent text-white/78 hover:bg-white/[.07] hover:text-white",
                      )}
                    >
                      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.7} />
                      {showSidebarLabels && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                  return collapsed && !showSidebarLabels ? (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={10} className="border-[#d3a62e]/35 bg-[#12100b] text-xs font-semibold text-[#f8df9a] shadow-xl">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : <div key={item.path}>{link}</div>;
                })}
              </div>
            </section>
          ))}
        </nav>
        </TooltipProvider>

        <div className="shrink-0 border-t border-white/10 p-2">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(
              "flex h-10 w-full items-center rounded-lg text-[12px] text-white/60 hover:bg-white/[.06] hover:text-white",
              showSidebarLabels ? "gap-3 px-3" : "justify-center",
            )}
            aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {showSidebarLabels && <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>}
          </button>
          <NavLink to="/perfil" aria-label="Abrir meu perfil" className={cn("mt-1 flex items-center rounded-lg px-2 py-2 hover:bg-white/[.06]", showSidebarLabels ? "gap-3" : "justify-center")}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f7e6bf] to-[#a37c43] text-[11px] font-extrabold text-[#21190e]">
              {initials || "GD"}
            </span>
            {showSidebarLabels && (
              <div className="min-w-0 grow">
                <div className="truncate text-[12px] font-semibold">{displayName}</div>
                <div className="truncate text-[10px] text-white/45">{isMaster ? "Proprietário" : "Membro"}</div>
              </div>
            )}
            {showSidebarLabels && <ChevronRight className="h-4 w-4 text-white/40" />}
          </NavLink>
          {showSidebarLabels && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-1 flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[11px] text-white/50 hover:bg-white/[.06] hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          )}
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar navegação"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={cn("min-h-screen min-w-0 max-w-full transition-[padding] duration-300", collapsed ? "md:pl-16" : "md:pl-[220px]")}>
        <header className="brand-topbar growdash-global-header sticky top-0 z-30 flex min-h-12 min-w-0 flex-wrap items-center gap-2 border-b px-2 py-2 text-white shadow-sm sm:px-5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="mr-3 rounded-md p-1.5 text-white/75 hover:bg-white/10 md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="mr-4 hidden rounded-md p-1.5 text-white/65 hover:bg-white/10 md:block"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <PanelLeftClose className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </button>
          <div className="order-3 w-full min-w-0 grow lg:order-none lg:w-auto">
            <TopbarMonthlyGoal realized={goalRevenue} target={goalTarget} accountLabel={goalAccountLabel} schemaReady={goalData?.schemaReady ?? false} loading={loadingGoals} />
          </div>
          <div className="order-2 ml-auto flex shrink-0 items-center rounded-full border border-white/15 bg-white/[.05] p-0.5 text-[10px] lg:order-none">
            <button
              type="button"
              onClick={() => setSegment("infoproduto")}
              className={cn("rounded-full px-3 py-1 font-bold transition", segment === "infoproduto" ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(242,197,72,.2)]" : "text-white/55")}
            >
              Infoproduto
            </button>
            <button
              type="button"
              onClick={() => setSegment("saas")}
              className={cn("rounded-full px-3 py-1 font-bold transition", segment === "saas" ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(242,197,72,.2)]" : "text-white/55")}
            >
              SaaS
            </button>
          </div>
        </header>
        <main className="growdash-main min-h-[calc(100vh-48px)] min-w-0 max-w-full overflow-x-clip p-2 pb-[calc(.5rem+env(safe-area-inset-bottom))] sm:p-5">
          <GlobalAnnouncementBanner />
          <Outlet />
        </main>
      </div>
      {!isOnline && (
        <div role="status" className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 z-[100] max-w-[calc(100vw-1.5rem)] rounded-xl border border-amber-400/35 bg-[#17130a]/95 px-4 py-3 text-xs font-semibold text-amber-100 shadow-2xl backdrop-blur-xl">
          Você está offline. Os dados exibidos podem estar desatualizados e nenhuma alteração será enviada até a conexão voltar.
        </div>
      )}
    </div>
  );
}
