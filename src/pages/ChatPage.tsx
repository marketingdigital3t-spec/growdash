import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, FolderOpen, HardDrive, Loader2, RefreshCcw } from "lucide-react";
import { SSDProvider, useSSD } from "@/lib/ssd/SSDContext";
import { ThreadSidebar } from "@/components/chat/ThreadSidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";

function ConnectGate() {
  const {
    status,
    connect,
    errorMessage,
    progressMessage,
    supported,
    folderName,
  } = useSSD();

  const connecting = status === "connecting" || status === "loading" || status === "indexing";

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d0d] p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f4d47a] via-[#d4a94a] to-[#8a6a1f] text-black shadow-[0_0_30px_-6px_rgba(212,169,74,0.5)]">
          <HardDrive className="h-6 w-6" />
        </div>
        <h2 className="mb-2 text-xl font-medium text-neutral-100">
          {status === "unsupported"
            ? "Navegador não suportado"
            : status === "needs-permission"
              ? "Reautorizar acesso ao SSD"
              : "Conecte seu SSD externo"}
        </h2>
        <p className="mx-auto mb-6 max-w-sm text-sm text-neutral-400">
          {status === "unsupported"
            ? "Este app usa a File System Access API. Abra em Chrome, Edge, Brave ou Arc."
            : status === "needs-permission"
              ? `A permissão para acessar “${folderName}” expirou. Reautorize para continuar.`
              : "Escolha a pasta no SSD onde ficarão suas conversas e documentos. O app só lê e escreve dentro dela — nada sai daí sem sua ação."}
        </p>

        {supported && status !== "unsupported" && (
          <button
            onClick={connect}
            disabled={connecting}
            className="mx-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#f4d47a] via-[#d4a94a] to-[#8a6a1f] px-5 py-2.5 text-sm font-semibold text-black shadow-[0_0_18px_-4px_rgba(212,169,74,0.5)] transition hover:brightness-110 disabled:opacity-60"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === "needs-permission" ? (
              <RefreshCcw className="h-4 w-4" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            {status === "needs-permission" ? "Reautorizar" : "Escolher pasta"}
          </button>
        )}

        {progressMessage && (
          <p className="mt-4 text-xs text-neutral-500">{progressMessage}</p>
        )}
        {errorMessage && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {errorMessage}
          </p>
        )}

        <div className="mt-8 rounded-lg border border-white/5 bg-black/40 p-4 text-left text-[11px] leading-relaxed text-neutral-500">
          <div className="mb-1 font-medium text-neutral-400">Estrutura criada na pasta:</div>
          <pre className="whitespace-pre text-[10.5px]">{`docs/       ← seus arquivos (.md .txt .pdf)
threads/    ← conversas
index.json  ← índice de busca`}</pre>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { status, threads, createThread } = useSSD();

  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!had) root.classList.remove("dark");
    };
  }, []);

  const ready = status === "ready" || status === "indexing";

  useEffect(() => {
    if (!ready) return;
    if (threadId) {
      const exists = threads.some((t) => t.id === threadId);
      if (!exists && threads.length > 0) {
        navigate(`/c/${threads[0].id}`, { replace: true });
      }
      return;
    }
    if (threads.length > 0) {
      navigate(`/c/${threads[0].id}`, { replace: true });
    } else {
      void createThread().then((t) => navigate(`/c/${t.id}`, { replace: true }));
    }
  }, [ready, threadId, threads, navigate, createThread]);

  const active = threadId ? threads.find((t) => t.id === threadId) : undefined;

  return (
    <div className="flex h-screen w-full bg-[#050505] text-neutral-100">
      {ready ? (
        <>
          <ThreadSidebar />
          {active ? (
            <ChatWindow key={active.id} thread={active} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
              Carregando…
            </div>
          )}
        </>
      ) : (
        <ConnectGate />
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <SSDProvider>
      <Shell />
    </SSDProvider>
  );
}
