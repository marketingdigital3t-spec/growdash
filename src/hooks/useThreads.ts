import { useCallback, useEffect, useState } from "react";
import { loadThreads, newThread, saveThreads, titleFromText, type ChatMessage, type Thread } from "@/lib/threads";

const EVT = "aria:threads:changed";

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>(() => loadThreads());

  useEffect(() => {
    const sync = () => setThreads(loadThreads());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const persist = useCallback((next: Thread[]) => {
    saveThreads(next);
    setThreads(next);
    window.dispatchEvent(new Event(EVT));
  }, []);

  const createThread = useCallback((): Thread => {
    const t = newThread();
    persist([t, ...loadThreads()]);
    return t;
  }, [persist]);

  const deleteThread = useCallback(
    (id: string) => {
      persist(loadThreads().filter((t) => t.id !== id));
    },
    [persist],
  );

  const renameThread = useCallback(
    (id: string, title: string) => {
      persist(
        loadThreads().map((t) => (t.id === id ? { ...t, title, updatedAt: Date.now() } : t)),
      );
    },
    [persist],
  );

  const appendMessage = useCallback(
    (id: string, message: ChatMessage) => {
      const current = loadThreads();
      const idx = current.findIndex((t) => t.id === id);
      if (idx === -1) return;
      const t = current[idx];
      const nextTitle =
        t.messages.length === 0 && message.role === "user" ? titleFromText(message.content) : t.title;
      const updated: Thread = {
        ...t,
        title: nextTitle,
        updatedAt: Date.now(),
        messages: [...t.messages, message],
      };
      const next = [updated, ...current.filter((x) => x.id !== id)];
      persist(next);
    },
    [persist],
  );

  const updateLastAssistant = useCallback(
    (id: string, content: string) => {
      const current = loadThreads();
      const idx = current.findIndex((t) => t.id === id);
      if (idx === -1) return;
      const t = current[idx];
      const msgs = [...t.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], content };
          break;
        }
      }
      const updated = { ...t, messages: msgs, updatedAt: Date.now() };
      const next = [updated, ...current.filter((x) => x.id !== id)];
      persist(next);
    },
    [persist],
  );

  return { threads, createThread, deleteThread, renameThread, appendMessage, updateLastAssistant };
}
