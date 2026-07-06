import { NavLink, useNavigate, useParams } from "react-router-dom";
import { MessageSquarePlus, Trash2, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useThreads } from "@/hooks/useThreads";
import logo from "@/assets/chat-logo.png";

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
    <aside className="hidden md:flex h-screen w-72 shrink-0 flex-col border-r border-border/60 bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <img src={logo} alt="Aria" className="h-8 w-8" />
        <div className="text-sm font-semibold tracking-tight">Aria</div>
      </div>

      <div className="px-3">
        <Button onClick={handleNew} className="w-full justify-start gap-2" variant="secondary">
          <MessageSquarePlus className="h-4 w-4" />
          Nova conversa
        </Button>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-2 pb-4">
        {threads.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            <MessagesSquare className="mx-auto mb-2 h-5 w-5 opacity-60" />
            Nenhuma conversa ainda
          </div>
        ) : (
          <ul className="space-y-0.5">
            {threads.map((t) => {
              const active = t.id === threadId;
              return (
                <li key={t.id}>
                  <NavLink
                    to={`/c/${t.id}`}
                    className={cn(
                      "group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/60",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, t.id)}
                      aria-label="Excluir conversa"
                      className={cn(
                        "rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100",
                        active && "opacity-100",
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="border-t border-border/60 px-4 py-3 text-[11px] text-muted-foreground">
        Interface local · nenhum dado enviado
      </div>
    </aside>
  );
}
