import { NavLink, useNavigate, useParams } from "react-router-dom";
import {
  MessageSquarePlus,
  Search,
  Library,
  FolderClosed,
  LayoutGrid,
  MoreHorizontal,
  Trash2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useThreads } from "@/hooks/useThreads";

const NAV = [
  { label: "Novo chat", icon: MessageSquarePlus, action: "new" as const },
  { label: "Buscar chats", icon: Search },
  { label: "Biblioteca", icon: Library },
  { label: "Projetos", icon: FolderClosed },
  { label: "Aplicativos", icon: LayoutGrid },
  { label: "Mais", icon: MoreHorizontal },
];

export function ThreadSidebar() {
  const { threads, createThread, deleteThread } = useThreads();
  const navigate = useNavigate();
  const { threadId } = useParams();

  const handleNew = () => {
    const t = createThread();
    navigate(`/c/${t.id}`);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteThread(id);
    if (id === threadId) navigate("/");
  };

  return (
    <aside className="hidden md:flex h-screen w-[260px] shrink-0 flex-col bg-[#0a0a0a] text-neutral-200">
      {/* Brand */}
      <div className="flex items-center gap-2 px-3 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#f4d47a] via-[#d4a94a] to-[#8a6a1f] text-black shadow-[0_0_20px_-4px_rgba(212,169,74,0.55)]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="text-sm font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-[#f4d47a] to-[#d4a94a] bg-clip-text text-transparent">Grow</span>
          <span className="text-neutral-100">dash AI</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2">
        <ul className="space-y-0.5">
          {NAV.map(({ label, icon: Icon, action }) => (
            <li key={label}>
              <button
                type="button"
                onClick={action === "new" ? handleNew : undefined}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent"
              >
                <Icon className="h-4 w-4 opacity-80" />
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Threads */}
      <div className="mt-4 flex-1 overflow-y-auto px-2 pb-4">
        <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
          Recentes
        </div>
        {threads.length === 0 ? (
          <div className="px-3 py-6 text-xs text-sidebar-foreground/50">
            Nenhuma conversa ainda
          </div>
        ) : (
          <ul className="space-y-0.5">
            {threads.map((t) => {
              const active = t.id === threadId;
              return (
                <li key={t.id} className="group relative">
                  <NavLink
                    to={`/c/${t.id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent/70",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  </NavLink>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, t.id)}
                    aria-label="Excluir conversa"
                    className={cn(
                      "absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-sidebar-foreground/60 opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover:opacity-100",
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer / user */}
      <div className="border-t border-sidebar-border/60 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(var(--growth-accent))] text-xs font-semibold text-primary-foreground">
            G
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">Growdash</div>
            <div className="text-[11px] text-sidebar-foreground/50">Interface local</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
