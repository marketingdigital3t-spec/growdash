import { useState } from "react";
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
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

type Item = { icon: LucideIcon; label: string; id: string; badge?: "new" | "dot" };

const items: Item[] = [
  { icon: Home, label: "Início", id: "home" },
  { icon: Calendar, label: "Agenda", id: "agenda" },
  { icon: Users, label: "Contatos", id: "contatos" },
  { icon: Stethoscope, label: "Atendimentos", id: "atendimentos" },
  { icon: ShoppingCart, label: "Vendas", id: "vendas" },
  { icon: DollarSign, label: "Financeiro", id: "financeiro" },
  { icon: BadgePercent, label: "Comissões", id: "comissoes" },
  { icon: Package, label: "Estoque", id: "estoque" },
  { icon: MessageSquare, label: "Comunicação", id: "comunicacao" },
  { icon: FileEdit, label: "CliniDocs", id: "clinidocs", badge: "new" },
  { icon: Heart, label: "Marketing", id: "marketing" },
  { icon: Flower2, label: "Comunidade", id: "comunidade" },
  { icon: Settings, label: "Configurações", id: "config" },
];

export default function Sidebar() {
  const [active, setActive] = useState("agenda");
  const { expanded, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col border-r border-border bg-card py-3 transition-[width] duration-200 ease-out",
        expanded ? "w-[260px]" : "w-[72px]",
      )}
    >
      <div className={cn("mb-2 h-14", expanded ? "px-3" : "px-0")}>
        {/* spacer to align with topbar height (logo lives in TopBar) */}
      </div>

      <nav className={cn("flex flex-1 flex-col gap-1", expanded ? "px-3" : "items-center px-0")}>
        {items.map(({ icon: Icon, label, id, badge }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              title={expanded ? undefined : label}
              className={cn(
                "group relative flex items-center transition-all",
                expanded
                  ? "h-12 w-full gap-3 rounded-2xl px-3"
                  : "h-11 w-11 justify-center rounded-xl",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_8px_22px_-8px_hsl(var(--primary)/0.55)]"
                  : "text-[hsl(var(--sidebar-icon))] hover:bg-primary-soft hover:text-primary",
              )}
            >
              <Icon
                className={cn(expanded ? "h-[22px] w-[22px]" : "h-[22px] w-[22px]", "shrink-0")}
                strokeWidth={1.8}
              />
              {expanded && (
                <span className="flex-1 truncate text-left text-[15px] font-bold">{label}</span>
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
          );
        })}
      </nav>

      {expanded && (
        <div className="flex justify-center pb-3">
          <button
            type="button"
            onClick={toggle}
            aria-label="Recolher"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-[hsl(var(--sidebar-icon))] transition-colors hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4 rotate-180" strokeWidth={2.2} />
          </button>
        </div>
      )}
    </aside>
  );
}
