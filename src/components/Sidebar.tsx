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

type Item = {
  icon: LucideIcon;
  label: string;
  id: string;
  badge?: "new" | "dot";
  submenu?: string[];
};

const items: Item[] = [
  { icon: Home, label: "Início", id: "home" },
  {
    icon: Calendar,
    label: "Agenda",
    id: "agenda",
    submenu: ["Semana", "Sala de espera", "Relatório da Agenda", "Relatório de agendamentos"],
  },
  {
    icon: Users,
    label: "Contatos",
    id: "contatos",
    submenu: [
      "Pacientes",
      "Profissionais",
      "Fornecedores",
      "Leads",
      "Todos os contatos",
      "Aniversariantes",
      "Frequência",
      "Mesclar contatos",
      "Convidar colaboradores",
    ],
  },
  {
    icon: Stethoscope,
    label: "Atendimentos",
    id: "atendimentos",
    submenu: ["Listagem", "Atestados e prescrições", "Guias SP/SADT"],
  },
  {
    icon: ShoppingCart,
    label: "Vendas",
    id: "vendas",
    submenu: ["Vendas", "Orçamentos", "Pacotes"],
  },
  {
    icon: DollarSign,
    label: "Financeiro",
    id: "financeiro",
    submenu: ["Fluxo de caixa", "Contas a pagar", "Contas a receber", "Extrato"],
  },
  { icon: BadgePercent, label: "Comissões", id: "comissoes" },
  {
    icon: Package,
    label: "Estoque",
    id: "estoque",
    submenu: ["Produtos", "Movimentações"],
  },
  {
    icon: MessageSquare,
    label: "Comunicação",
    id: "comunicacao",
    submenu: ["WhatsApp", "E-mail", "SMS"],
  },
  {
    icon: FileEdit,
    label: "CliniDocs",
    id: "clinidocs",
    badge: "new",
    submenu: ["Modelos", "Documentos"],
  },
  {
    icon: Heart,
    label: "Marketing",
    id: "marketing",
    submenu: ["Campanhas", "Aniversariantes"],
  },
  { icon: Flower2, label: "Comunidade", id: "comunidade" },
  {
    icon: Settings,
    label: "Configurações",
    id: "config",
    submenu: ["Perfil", "Clínica", "Usuários"],
  },
];

export default function Sidebar() {
  const [active, setActive] = useState<string>("contatos");
  const [activeSub, setActiveSub] = useState<string>("Todos os contatos");
  const { expanded, toggle } = useSidebar();

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
          "flex flex-1 flex-col gap-1",
          expanded ? "px-3" : "items-center px-0",
        )}
      >
        {items.map((item) => {
          const { icon: Icon, label, id, badge, submenu } = item;
          const isActive = active === id;
          return (
            <div key={id} className="group/item relative w-full">
              <button
                type="button"
                onClick={() => {
                  setActive(id);
                  if (submenu?.length) setActiveSub(submenu[0]);
                }}
                title={expanded ? undefined : label}
                className={cn(
                  "relative flex items-center transition-all",
                  expanded
                    ? "h-12 w-full gap-3 rounded-2xl px-3"
                    : "mx-auto h-11 w-11 justify-center rounded-xl",
                  isActive
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

              {/* Flyout submenu (collapsed only) */}
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
                    {submenu.map((s) => {
                      const on = isActive && activeSub === s;
                      return (
                        <li key={s}>
                          <button
                            type="button"
                            onClick={() => {
                              setActive(id);
                              setActiveSub(s);
                            }}
                            className={cn(
                              "flex h-11 w-full items-center rounded-xl px-3 text-[15px] font-semibold transition-colors",
                              on
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground/80 hover:bg-primary-soft hover:text-primary",
                            )}
                          >
                            {s}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
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
      {!expanded && (
        <div className="flex justify-center pb-3">
          <button
            type="button"
            onClick={toggle}
            aria-label="Expandir"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-[hsl(var(--sidebar-icon))] transition-colors hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
      )}
    </aside>
  );
}
