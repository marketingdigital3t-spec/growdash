import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import { NAV, type NavItem } from "@/nav/nav-config";

export default function Sidebar() {
  const { expanded, toggle } = useSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const activeSection: NavItem =
    NAV.find((n) =>
      n.path === "/"
        ? pathname === "/"
        : pathname === n.path ||
          pathname.startsWith(n.path + "/") ||
          n.submenu?.some((s) => s.path === pathname),
    ) ?? NAV[0];

  return (
    <aside className="relative z-30 flex h-full shrink-0">
      {/* Icon rail */}
      <div className="flex h-full w-[72px] shrink-0 flex-col border-r border-border bg-card py-3">
        <div className="mb-2 h-14" />

        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-0">
          {NAV.map((item) => {
            const { icon: Icon, label, id, badge, submenu, path } = item;
            const active = activeSection.id === id;

            const handleClick = () => {
              navigate(submenu?.length ? submenu[0].path : path);
            };

            return (
              <div key={id} className="group/item relative w-full">
                <button
                  type="button"
                  onClick={handleClick}
                  title={label}
                  className={cn(
                    "relative mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_8px_22px_-8px_hsl(var(--primary)/0.55)]"
                      : "text-[hsl(var(--sidebar-icon))] hover:bg-primary-soft hover:text-primary",
                  )}
                >
                  <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.8} />
                  {badge === "new" && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-green ring-2 ring-card" />
                  )}
                </button>

                {/* Flyout when the panel is hidden */}
                {!expanded && submenu?.length && (
                  <div
                    className={cn(
                      "pointer-events-none absolute left-full top-0 z-40 ml-2 min-w-[280px] rounded-2xl border border-border bg-card p-4 opacity-0 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.25)] transition-opacity",
                      "group-hover/item:pointer-events-auto group-hover/item:opacity-100",
                    )}
                  >
                    <div className="mb-2 px-3 text-[17px] font-extrabold text-foreground">
                      {label}
                    </div>
                    <ul className="flex flex-col">
                      {submenu.map((s) => (
                        <li key={s.path}>
                          <NavLink
                            to={s.path}
                            className={({ isActive }) =>
                              cn(
                                "flex h-11 w-full items-center rounded-xl px-3 text-[15px] font-semibold transition-colors",
                                isActive
                                  ? "bg-primary text-primary-foreground"
                                  : "text-foreground/80 hover:bg-primary-soft hover:text-primary",
                              )
                            }
                          >
                            {s.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex justify-center pb-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={expanded ? "Recolher" : "Expandir"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-[hsl(var(--sidebar-icon))] transition-colors hover:bg-muted"
          >
            <ChevronRight
              className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
              strokeWidth={2.2}
            />
          </button>
        </div>
      </div>

      {/* Submenu panel */}
      <div
        className={cn(
          "h-full overflow-hidden border-r border-border bg-card transition-[width] duration-200 ease-out",
          expanded ? "w-[260px]" : "w-0",
        )}
      >
        {expanded && (
          <div className="flex h-full w-[260px] flex-col px-5 py-5">
            <div className="mb-4 px-2 text-[20px] font-extrabold text-foreground">
              {activeSection.label}
            </div>
            {activeSection.submenu?.length ? (
              <ul className="flex flex-col gap-1">
                {activeSection.submenu.map((s) => (
                  <li key={s.path}>
                    <NavLink
                      to={s.path}
                      className={({ isActive }) =>
                        cn(
                          "flex h-11 w-full items-center rounded-xl px-4 text-[15px] font-semibold transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-[0_8px_22px_-8px_hsl(var(--primary)/0.55)]"
                            : "text-foreground/80 hover:bg-primary-soft hover:text-primary",
                        )
                      }
                    >
                      {s.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2 text-sm text-muted-foreground">
                Esta seção não possui submenu.
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
