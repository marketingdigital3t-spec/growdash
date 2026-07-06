import { NavLink, useNavigate, useParams } from "react-router-dom";
import {
  MessageSquarePlus,
  Trash2,
  HardDrive,
  RefreshCcw,
  Loader2,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSSD } from "@/lib/ssd/SSDContext";

export function ThreadSidebar() {
  const {
    threads,
    createThread,
    deleteThread,
    folderName,
    index,
    status,
    reindex,
    disconnect,
  } = useSSD();
  const navigate = useNavigate();
  const { threadId } = useParams();

  const handleNew = async () => {
    const t = await createThread();
    navigate(`/c/${t.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteThread(id);
    if (id === threadId) navigate("/");
  };

  const indexing = status === "indexing";

  return (
    <aside className="hidden md:flex h-screen w-[260px] shrink-0 flex-col bg-[#0a0a0a] text-neutral-200">
      {/* Brand */}
      <div className="flex items-center gap-2 px-3 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#f4d47a] via-[#d4a94a] to-[#8a6a1f] text-black shadow-[0_0_20px_-4px_rgba(212,169,74,0.55)]">
          <HardDrive className="h-4 w-4" />
        </div>
        <div className="text-sm font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-[#f4d47a] to-[#d4a94a] bg-clip-text text-transparent">Grow</span>
          <span className="text-neutral-100">dash AI</span>
        </div>
      </div>

      {/* SSD status card */}
      <div className="mx-2 mb-2 rounded-lg border border-white/5 bg-black/40 px-3 py-2.5 text-[11px]">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-neutral-500">SSD conectado</div>
            <div className="truncate text-neutral-200">{folderName ?? "—"}</div>
          </div>
          <button
            type="button"
            onClick={disconnect}
            className="rounded p-1 text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
            aria-label="Desconectar SSD"
            title="Desconectar SSD"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-neutral-500">
            {index
              ? `${index.docCount} docs · ${index.chunkCount} trechos`
              : "sem índice"}
          </div>
          <button
            type="button"
            onClick={() => void reindex()}
            disabled={indexing}
            className="inline-flex items-center gap-1 rounded-full border border-[#d4a94a]/30 px-2 py-0.5 text-[10.5px] text-[#f4d47a] transition hover:bg-[#d4a94a]/10 disabled:opacity-60"
          >
            {indexing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCcw className="h-3 w-3" />
            )}
            {index ? "Reindexar" : "Indexar"}
          </button>
        </div>
      </div>

      {/* New chat */}
      <div className="px-2">
        <button
          type="button"
          onClick={handleNew}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-white/5"
        >
          <MessageSquarePlus className="h-4 w-4 text-[#d4a94a]" />
          <span>Novo chat</span>
        </button>
      </div>

      {/* Threads */}
      <div className="mt-2 flex-1 overflow-y-auto px-2 pb-4">
        <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          Recentes
        </div>
        {threads.length === 0 ? (
          <div className="px-3 py-6 text-xs text-neutral-500">
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
                      "flex items-center gap-2 rounded-lg px-3 py-2 pr-8 text-sm transition-colors",
                      active
                        ? "bg-white/[0.06] text-neutral-50"
                        : "text-neutral-300 hover:bg-white/[0.04]",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  </NavLink>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, t.id)}
                    aria-label="Excluir conversa"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-neutral-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#f4d47a] via-[#d4a94a] to-[#8a6a1f] text-xs font-semibold text-black">
            G
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-neutral-100">Growdash</div>
            <div className="text-[11px] text-neutral-500">Cérebro no SSD</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
