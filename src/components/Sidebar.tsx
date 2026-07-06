import { useState } from "react";
import {
  Home,
  Calendar,
  Users,
  Stethoscope,
  ShoppingCart,
  DollarSign,
  Tag,
  Package,
  MessageSquare,
  PenSquare,
  Heart,
  Sparkles,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { icon: LucideIcon; label: string; id: string; badge?: boolean };

const items: Item[] = [
  { icon: Home, label: "Início", id: "home" },
  { icon: Calendar, label: "Agenda", id: "agenda" },
  { icon: Users, label: "Pacientes", id: "pacientes" },
  { icon: Stethoscope, label: "Profissionais", id: "profissionais" },
  { icon: ShoppingCart, label: "Vendas", id: "vendas" },
  { icon: DollarSign, label: "Financeiro", id: "financeiro" },
  { icon: Tag, label: "Promoções", id: "promocoes" },
  { icon: Package, label: "Produtos", id: "produtos" },
  { icon: MessageSquare, label: "Mensagens", id: "mensagens" },
  { icon: PenSquare, label: "Anotações", id: "anotacoes", badge: true },
  { icon: Heart, label: "Fidelidade", id: "fidelidade" },
  { icon: Sparkles, label: "Marketing", id: "marketing" },
  { icon: Settings, label: "Configurações", id: "config" },
];

export default function Sidebar() {
  const [active, setActive] = useState("home");

  return (
    <aside className="flex h-full w-[72px] shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-4">
      {items.map(({ icon: Icon, label, id, badge }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            title={label}
            className={cn(
              "group relative flex h-11 w-11 items-center justify-center rounded-xl transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.55)]"
                : "text-[hsl(var(--sidebar-icon))] hover:bg-primary-soft hover:text-primary",
            )}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
            {badge && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-green ring-2 ring-card" />
            )}
          </button>
        );
      })}
    </aside>
  );
}
