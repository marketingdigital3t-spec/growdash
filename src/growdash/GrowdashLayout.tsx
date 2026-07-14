import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Menu,
  Moon,
  PanelLeftClose,
  Sparkles,
  X,
} from "lucide-react";
import { NAV_SECTIONS } from "./navigation";
import { cn } from "@/lib/utils";

export default function GrowdashLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-[#f3f1ef] text-[#1b1917]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-[#11110f] text-white transition-all duration-300",
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
            className={cn(
              "flex h-10 w-full items-center rounded-lg text-[12px] text-white/60 hover:bg-white/[.06] hover:text-white",
              collapsed ? "justify-center" : "gap-3 px-3",
            )}
          >
            <Moon className="h-4 w-4" />
            {!collapsed && <span>Modo Escuro</span>}
          </button>
          <div className={cn("mt-1 flex items-center rounded-lg px-2 py-2", collapsed ? "justify-center" : "gap-3")}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f7e6bf] to-[#a37c43] text-[11px] font-extrabold text-[#21190e]">
              TJ
            </span>
            {!collapsed && (
              <div className="min-w-0 grow">
                <div className="truncate text-[12px] font-semibold">Thiego Jesus</div>
                <div className="truncate text-[10px] text-white/45">Proprietário</div>
              </div>
            )}
            {!collapsed && <ChevronRight className="h-4 w-4 text-white/40" />}
          </div>
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

      <div className={cn("min-h-screen transition-[padding] duration-300", collapsed ? "lg:pl-[78px]" : "lg:pl-[220px]")}>
        <header className="sticky top-0 z-30 flex h-12 items-center border-b border-[#332817] bg-[#11110f] px-3 text-white shadow-sm sm:px-5">
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
          <div className="flex min-w-0 items-center gap-2 text-[11px] text-white/66">
            <span className="grid h-5 w-5 place-items-center rounded-full border border-white/15">◎</span>
            <span className="truncate">Meta ainda não iniciada · meta R$ 250.000</span>
          </div>
          <div className="mx-5 hidden h-1 min-w-24 grow overflow-hidden rounded-full bg-white/10 sm:block">
            <div className="h-full w-[2%] rounded-full bg-gradient-to-r from-[#9d6f11] to-[#f3c747]" />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3 text-[10px]">
            <span className="hidden text-white/45 md:inline">R$ 0 · <b className="text-[#e06a60]">0%</b></span>
            <span className="rounded-full border border-[#f2c548]/50 bg-[#f2c548] px-3 py-1 font-bold text-[#382707] shadow-[0_0_18px_rgba(242,197,72,.25)]">
              Infoprodutor
            </span>
            <span className="hidden text-white/55 sm:inline">SaaS</span>
          </div>
        </header>
        <main className="min-h-[calc(100vh-48px)] p-3 sm:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
