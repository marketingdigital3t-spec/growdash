import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NAV, type NavItem } from "@/nav/nav-config";

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isActive = (item: NavItem) =>
    item.path === "/"
      ? pathname === "/"
      : pathname === item.path ||
        pathname.startsWith(item.path + "/") ||
        item.submenu?.some((s) => s.path === pathname);

  return (
    <aside className="relative z-30 flex h-full w-[72px] shrink-0 flex-col border-r border-border bg-card py-3">
      <div className="mb-2 h-14" />

      <nav className="flex flex-1 flex-col items-center gap-1 overflow-visible px-0">
        {NAV.map((item) => {
          const { icon: Icon, label, id, badge, submenu, path } = item;
          const active = isActive(item);

          return (
            <div key={id} className="group/item relative w-full">
              <button
                type="button"
                onClick={() => navigate(submenu?.length ? submenu[0].path : path)}
                aria-label={label}
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

              {/* Hover flyout: title + submenu (or just title if no submenu) */}
              <div
                className={cn(
                  "pointer-events-none absolute left-full top-0 z-40 ml-2 min-w-[260px] rounded-2xl border border-border bg-card p-4 opacity-0 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.25)] transition-opacity",
                  "group-hover/item:pointer-events-auto group-hover/item:opacity-100",
                )}
              >
                <div className={cn("px-3 text-[17px] font-extrabold text-foreground", submenu?.length && "mb-2")}>
                  {label}
                </div>
                {submenu?.length ? (
                  <ul className="flex flex-col">
                    {submenu.map((s) => (
                      <li key={s.path}>
                        <NavLink
                          to={s.path}
                          className={({ isActive: linkActive }) =>
                            cn(
                              "flex h-11 w-full items-center rounded-xl px-3 text-[15px] font-semibold transition-colors",
                              linkActive
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
                ) : null}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
