import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { format } from "date-fns";
import { NAV_SECTIONS } from "./navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { PRESET_LABELS, type DatePreset } from "@/hooks/useDateFilter";
import { useIsMaster } from "@/hooks/useIsMaster";

export default function GrowdashLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { data: isMaster = false } = useIsMaster();
  const { data: adAccounts = [] } = useAdAccounts();
  const {
    adAccountId,
    setAdAccountId,
    preset,
    setPreset,
    startDate,
    endDate,
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

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuário";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase();

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (adAccountId !== "all" && businessUnitId && !visibleAccounts.some((account) => account.id === adAccountId)) {
      setAdAccountId("all");
    }
  }, [adAccountId, businessUnitId, setAdAccountId, visibleAccounts]);

  return (
    <div className="min-h-screen max-w-full overflow-x-clip bg-[#f3f1ef] text-[#1b1917] transition-colors dark:bg-[#090a0d] dark:text-[#f4f1e9]">
      <aside
        className={cn(
          "growdash-safe-sidebar fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-[#11110f] text-white transition-all duration-300",
          collapsed ? "w-[78px]" : "w-[220px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-[86px] shrink-0 items-center border-b border-white/5 px-4">
          <NavLink to="/" className="flex min-w-0 items-center gap-3" aria-label="Growdash - início">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#f4c94d]/50 bg-gradient-to-br from-[#8a6515] to-[#f4c94d] text-black shadow-[0_0_24px_rgba(244,201,77,.22)]">
              <Sparkles className="h-5 w-5" />
            </span>
            {!collapsed && (
              <span className="leading-[.82] tracking-tight">
                <span className="block text-[13px] font-medium text-[#d8bd71]">Grow</span>
                <span className="block text-[24px] font-black text-[#f4d266]">dash</span>
              </span>
            )}
          </NavLink>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="grow overflow-y-auto px-2 py-4 growdash-scrollbar">
          {NAV_SECTIONS.map((section) => (
            <section key={section.label} className="mb-5">
              {!collapsed && (
                <div className="mb-1 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[.19em] text-white/55">
                  <span>{section.label}</span>
                  <ChevronDown className="h-3 w-3" />
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/"}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          "group flex h-10 items-center rounded-lg text-[13px] font-medium transition-colors",
                          collapsed ? "justify-center px-0" : "gap-3 px-3",
                          isActive
                            ? "border border-[#f0bd35]/30 bg-gradient-to-r from-[#6a521e] to-[#3a301a] text-[#ffd868] shadow-[inset_0_1px_0_rgba(255,255,255,.06)]"
                            : "border border-transparent text-white/78 hover:bg-white/[.07] hover:text-white",
                        )
                      }
                    >
                      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.7} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-2">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(
              "flex h-10 w-full items-center rounded-lg text-[12px] text-white/60 hover:bg-white/[.06] hover:text-white",
              collapsed ? "justify-center" : "gap-3 px-3",
            )}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!collapsed && <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>}
          </button>
          <NavLink to="/perfil" className={cn("mt-1 flex items-center rounded-lg px-2 py-2 hover:bg-white/[.06]", collapsed ? "justify-center" : "gap-3")}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f7e6bf] to-[#a37c43] text-[11px] font-extrabold text-[#21190e]">
              {initials || "GD"}
            </span>
            {!collapsed && (
              <div className="min-w-0 grow">
                <div className="truncate text-[12px] font-semibold">{displayName}</div>
                <div className="truncate text-[10px] text-white/45">{isMaster ? "Proprietário" : "Membro"}</div>
              </div>
            )}
            {!collapsed && <ChevronRight className="h-4 w-4 text-white/40" />}
          </NavLink>
          {!collapsed && (
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
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={cn("min-h-screen min-w-0 max-w-full transition-[padding] duration-300", collapsed ? "lg:pl-[78px]" : "lg:pl-[220px]")}>
        <header className="growdash-global-header sticky top-0 z-30 flex min-h-12 min-w-0 flex-wrap items-center gap-2 border-b border-[#332817] bg-[#11110f] px-2 py-2 text-white shadow-sm sm:px-5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="mr-3 rounded-md p-1.5 text-white/75 hover:bg-white/10 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="mr-4 hidden rounded-md p-1.5 text-white/65 hover:bg-white/10 lg:block"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <PanelLeftClose className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </button>
          <div className="order-3 flex w-full min-w-0 grow items-center gap-2 overflow-hidden text-[10px] lg:order-none lg:w-auto lg:overflow-visible">
            <label className="relative min-w-0 flex-1 lg:flex-none">
              <span className="sr-only">Conta de anúncio global</span>
              <select
                value={adAccountId}
                onChange={(event) => setAdAccountId(event.target.value)}
                className="h-8 w-full min-w-0 rounded-md border border-white/15 bg-white/[.07] px-2 pr-7 text-white outline-none focus:border-[#f2c548]/70 lg:max-w-[220px]"
              >
                <option value="all" className="text-black">Todas as contas Meta</option>
                {visibleAccounts.map((account) => <option key={account.id} value={account.id} className="text-black">{account.name}</option>)}
              </select>
            </label>
            <label className="relative min-w-0 flex-1 lg:flex-none">
              <span className="sr-only">Período global</span>
              <CalendarRange className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-[#f2c548]" />
              <select
                value={preset}
                onChange={(event) => setPreset(event.target.value as DatePreset)}
                className="h-8 w-full min-w-0 rounded-md border border-white/15 bg-white/[.07] pl-8 pr-7 text-white outline-none focus:border-[#f2c548]/70 lg:w-auto"
              >
                {Object.entries(PRESET_LABELS).map(([key, label]) => (
                  <option key={key} value={key} className="text-black">{label}</option>
                ))}
              </select>
            </label>
            <span className="hidden text-white/45 xl:inline">
              {format(startDate, "dd/MM/yyyy")} – {format(endDate, "dd/MM/yyyy")}
            </span>
          </div>
          <div className="order-2 ml-auto flex shrink-0 items-center rounded-full border border-white/15 bg-white/[.05] p-0.5 text-[10px] lg:order-none">
            <button
              type="button"
              onClick={() => setSegment("infoproduto")}
              className={cn("rounded-full px-3 py-1 font-bold transition", segment === "infoproduto" ? "bg-[#f2c548] text-[#382707] shadow-[0_0_18px_rgba(242,197,72,.25)]" : "text-white/55")}
            >
              Infoproduto
            </button>
            <button
              type="button"
              onClick={() => setSegment("saas")}
              className={cn("rounded-full px-3 py-1 font-bold transition", segment === "saas" ? "bg-[#f2c548] text-[#382707] shadow-[0_0_18px_rgba(242,197,72,.25)]" : "text-white/55")}
            >
              SaaS
            </button>
          </div>
        </header>
        <main className="growdash-main min-h-[calc(100vh-48px)] min-w-0 max-w-full overflow-x-clip p-2 pb-[calc(.5rem+env(safe-area-inset-bottom))] sm:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
