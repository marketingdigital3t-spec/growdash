// Thread persistence on the SSD. One file per thread under threads/<id>.json.

import { deleteFile, getOrCreateDir, listFiles, readJson, writeJson } from "./fs";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  /** paths of doc chunks used to answer (assistant only) */
  sources?: string[];
}

export interface Thread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export function newThread(): Thread {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "Nova conversa",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function titleFromText(text: string) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 40 ? clean.slice(0, 40) + "…" : clean || "Nova conversa";
}

async function threadsDir(root: FileSystemDirectoryHandle) {
  return getOrCreateDir(root, "threads");
}

export async function loadAllThreads(root: FileSystemDirectoryHandle): Promise<Thread[]> {
  const dir = await threadsDir(root);
  const files = await listFiles(dir, ".json");
  const threads: Thread[] = [];
  for (const name of files) {
    const t = await readJson<Thread>(dir, name);
    if (t && t.id && Array.isArray(t.messages)) threads.push(t);
  }
  threads.sort((a, b) => b.updatedAt - a.updatedAt);
  return threads;
}

export async function saveThread(root: FileSystemDirectoryHandle, thread: Thread) {
  const dir = await threadsDir(root);
  await writeJson(dir, `${thread.id}.json`, thread);
}

export async function removeThread(root: FileSystemDirectoryHandle, id: string) {
  const dir = await threadsDir(root);
  await deleteFile(dir, `${id}.json`);
}
