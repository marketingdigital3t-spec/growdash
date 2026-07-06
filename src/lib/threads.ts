export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export interface Thread {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

const KEY = "aria:threads:v1";

export function loadThreads(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Thread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(threads));
  } catch {}
}

export function newThread(): Thread {
  return {
    id: crypto.randomUUID(),
    title: "Nova conversa",
    updatedAt: Date.now(),
    messages: [],
  };
}

export function titleFromText(text: string) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 40 ? clean.slice(0, 40) + "…" : clean || "Nova conversa";
}
