import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import { NAV } from "@/nav/nav-config";

export default function Sidebar() {
  const { expanded, toggle } = useSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isItemActive = (path: string, hasSub: boolean) => {
    if (path === "/") return pathname === "/";
    if (hasSub) return pathname === path || pathname.startsWith(path + "/");
    return pathname === path;
  };

  return (
    <aside
      className={cn(
        "relative z-30 flex h-full shrink-0 flex-col border-r border-border bg-card py-3 transition-[width] duration-200 ease-out",
        expanded ? "w-[260px]" : "w-[72px]",
      )}
    >
      <div className={cn("mb-2 h-14", expanded ? "px-3" : "px-0")} />

      <nav
        className={cn(
          "flex flex-1 flex-col gap-1 overflow-y-auto",
          expanded ? "px-3" : "items-center px-0",
        )}
      >
        {NAV.map((item) => {
          const { icon: Icon, label, id, badge, submenu, path } = item;
          const active = isItemActive(path, !!submenu?.length);

          const handleClick = () => {
            if (submenu?.length) navigate(submenu[0].path);
            else navigate(path);
          };

          return (
            <div key={id} className="group/item relative w-full">
              <button
                type="button"
                onClick={handleClick}
                title={expanded ? undefined : label}
                className={cn(
                  "relative flex items-center transition-all",
                  expanded
                    ? "h-12 w-full gap-3 rounded-2xl px-3"
                    : "mx-auto h-11 w-11 justify-center rounded-xl",
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_8px_22px_-8px_hsl(var(--primary)/0.55)]"
                    : "text-[hsl(var(--sidebar-icon))] hover:bg-primary-soft hover:text-primary",
                )}
              >
                <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.8} />
                {expanded && (
                  <span className="flex-1 truncate text-left text-[15px] font-bold">
                    {label}
                  </span>
                )}
                {expanded && badge === "new" && (
                  <span className="rounded-full bg-[hsl(145_65%_92%)] px-2.5 py-0.5 text-xs font-bold text-[hsl(145_60%_35%)]">
                    novo
                  </span>
                )}
                {!expanded && badge === "new" && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-green ring-2 ring-card" />
                )}
              </button>

              {/* Expanded: inline submenu when active */}
              {expanded && submenu?.length && active && (
                <ul className="mb-1 mt-1 flex flex-col gap-0.5 pl-11 pr-1">
                  {submenu.map((s) => (
                    <li key={s.path}>
                      <NavLink
                        to={s.path}
                        className={({ isActive }) =>
                          cn(
                            "flex h-9 items-center rounded-lg px-3 text-[14px] font-semibold transition-colors",
                            isActive
                              ? "bg-primary-soft text-primary"
                              : "text-foreground/70 hover:bg-muted hover:text-foreground",
                          )
                        }
                      >
                        {s.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}

              {/* Collapsed: flyout submenu on hover */}
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
    </aside>
  );
}
