import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clearStoredHandle,
  isFsAccessSupported,
  loadStoredHandle,
  requestHandle,
  verifyPermission,
} from "./handle";
import { buildIndex, loadIndex, type DocsIndex } from "./indexer";
import {
  loadAllThreads,
  newThread,
  removeThread,
  saveThread,
  titleFromText,
  type ChatMessage,
  type Thread,
} from "./threads";

export type SSDStatus =
  | "unsupported"
  | "disconnected"
  | "needs-permission"
  | "connecting"
  | "loading"
  | "indexing"
  | "ready"
  | "error";

interface SSDContextValue {
  status: SSDStatus;
  folderName: string | null;
  index: DocsIndex | null;
  threads: Thread[];
  progressMessage: string | null;
  errorMessage: string | null;
  supported: boolean;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reindex: () => Promise<void>;

  createThread: () => Promise<Thread>;
  deleteThread: (id: string) => Promise<void>;
  appendMessage: (id: string, message: ChatMessage) => Promise<void>;
  updateLastAssistant: (
    id: string,
    content: string,
    sources?: string[],
  ) => Promise<void>;
}

const Ctx = createContext<SSDContextValue | null>(null);

export function useSSD() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSSD must be used inside <SSDProvider>");
  return v;
}

export function SSDProvider({ children }: { children: ReactNode }) {
  const supported = isFsAccessSupported();
  const [status, setStatus] = useState<SSDStatus>(
    supported ? "disconnected" : "unsupported",
  );
  const [folderName, setFolderName] = useState<string | null>(null);
  const [index, setIndex] = useState<DocsIndex | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [progressMessage, setProgress] = useState<string | null>(null);
  const [errorMessage, setError] = useState<string | null>(null);
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null);

  const hydrate = useCallback(async (handle: FileSystemDirectoryHandle) => {
    handleRef.current = handle;
    setFolderName(handle.name);
    setStatus("loading");
    setProgress("Carregando conversas do SSD");
    try {
      const [existingIndex, loadedThreads] = await Promise.all([
        loadIndex(handle),
        loadAllThreads(handle),
      ]);
      setIndex(existingIndex);
      setThreads(loadedThreads);
      setStatus("ready");
      setProgress(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("error");
    }
  }, []);

  // On mount: try to silently re-attach previously granted handle.
  useEffect(() => {
    if (!supported) return;
    (async () => {
      const stored = await loadStoredHandle();
      if (!stored) return;
      // Query permission without prompting.
      // @ts-expect-error - queryPermission not typed
      const state = await stored.queryPermission({ mode: "readwrite" });
      if (state === "granted") {
        await hydrate(stored);
      } else {
        handleRef.current = stored;
        setFolderName(stored.name);
        setStatus("needs-permission");
      }
    })().catch(console.error);
  }, [supported, hydrate]);

  const connect = useCallback(async () => {
    if (!supported) return;
    setError(null);
    setStatus("connecting");
    try {
      let handle = handleRef.current;
      if (!handle) {
        handle = await requestHandle();
      } else {
        const ok = await verifyPermission(handle);
        if (!ok) {
          handle = await requestHandle();
        }
      }
      await hydrate(handle);
    } catch (err) {
      // AbortError when the user cancels the picker
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus(handleRef.current ? "needs-permission" : "disconnected");
        return;
      }
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro ao conectar");
      setStatus("error");
    }
  }, [supported, hydrate]);

  const disconnect = useCallback(async () => {
    await clearStoredHandle();
    handleRef.current = null;
    setFolderName(null);
    setIndex(null);
    setThreads([]);
    setStatus(supported ? "disconnected" : "unsupported");
  }, [supported]);

  const reindex = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    setStatus("indexing");
    setError(null);
    try {
      const idx = await buildIndex(handle, (msg) => setProgress(msg));
      setIndex(idx);
      setStatus("ready");
      setProgress(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro ao indexar");
      setStatus("error");
    }
  }, []);

  const persistThread = useCallback(async (thread: Thread) => {
    const handle = handleRef.current;
    if (!handle) return;
    await saveThread(handle, thread);
  }, []);

  const createThread = useCallback(async () => {
    const t = newThread();
    setThreads((prev) => [t, ...prev]);
    await persistThread(t);
    return t;
  }, [persistThread]);

  const deleteThread = useCallback(
    async (id: string) => {
      const handle = handleRef.current;
      if (!handle) return;
      setThreads((prev) => prev.filter((t) => t.id !== id));
      await removeThread(handle, id);
    },
    [],
  );

  const appendMessage = useCallback(
    async (id: string, message: ChatMessage) => {
      let updated: Thread | undefined;
      setThreads((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx === -1) return prev;
        const current = prev[idx];
        const nextTitle =
          current.messages.length === 0 && message.role === "user"
            ? titleFromText(message.content)
            : current.title;
        updated = {
          ...current,
          title: nextTitle,
          updatedAt: Date.now(),
          messages: [...current.messages, message],
        };
        const rest = prev.filter((t) => t.id !== id);
        return [updated, ...rest];
      });
      if (updated) await persistThread(updated);
    },
    [persistThread],
  );

  const updateLastAssistant = useCallback(
    async (id: string, content: string, sources?: string[]) => {
      let updated: Thread | undefined;
      setThreads((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx === -1) return prev;
        const current = prev[idx];
        const msgs = [...current.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "assistant") {
            msgs[i] = { ...msgs[i], content, ...(sources ? { sources } : {}) };
            break;
          }
        }
        updated = { ...current, messages: msgs, updatedAt: Date.now() };
        const rest = prev.filter((t) => t.id !== id);
        return [updated, ...rest];
      });
      if (updated) await persistThread(updated);
    },
    [persistThread],
  );

  const value = useMemo<SSDContextValue>(
    () => ({
      status,
      folderName,
      index,
      threads,
      progressMessage,
      errorMessage,
      supported,
      connect,
      disconnect,
      reindex,
      createThread,
      deleteThread,
      appendMessage,
      updateLastAssistant,
    }),
    [
      status,
      folderName,
      index,
      threads,
      progressMessage,
      errorMessage,
      supported,
      connect,
      disconnect,
      reindex,
      createThread,
      deleteThread,
      appendMessage,
      updateLastAssistant,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
