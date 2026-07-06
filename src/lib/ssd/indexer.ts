// Local TF-IDF index over the docs/ folder. No external calls — everything
// runs in the browser. When the AI backend is wired up we can swap TF-IDF
// scoring for real embeddings, but the file layout stays the same.

import { getOrCreateDir, readJson, readPdfText, readText, walkFiles, writeJson } from "./fs";

const TEXT_EXTS = new Set(["md", "txt", "json", "yaml", "yml", "csv", "html", "log"]);
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 180;

export interface IndexChunk {
  id: string;
  path: string;
  ordinal: number;
  text: string;
  /** term-frequency map: token -> count in this chunk */
  tf: Record<string, number>;
  /** total token count in this chunk */
  len: number;
}

export interface DocsIndex {
  updatedAt: number;
  docCount: number;
  chunkCount: number;
  chunks: IndexChunk[];
}

export function tokenize(input: string): string[] {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/[a-z0-9]{2,}/g) ?? []
  );
}

function computeTf(text: string): { tf: Record<string, number>; len: number } {
  const tokens = tokenize(text);
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
  return { tf, len: tokens.length };
}

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  const step = CHUNK_SIZE - CHUNK_OVERLAP;
  for (let i = 0; i < clean.length; i += step) {
    const piece = clean.slice(i, i + CHUNK_SIZE);
    if (piece.trim().length > 30) out.push(piece);
    if (i + CHUNK_SIZE >= clean.length) break;
  }
  return out;
}

async function extractFileText(
  path: string,
  handle: FileSystemFileHandle,
): Promise<string | null> {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  try {
    if (ext === "pdf") return await readPdfText(handle);
    if (TEXT_EXTS.has(ext)) return await readText(handle);
    return null;
  } catch (err) {
    console.warn("[ssd] falha ao ler", path, err);
    return null;
  }
}

export async function buildIndex(
  root: FileSystemDirectoryHandle,
  onProgress?: (msg: string) => void,
): Promise<DocsIndex> {
  const docsDir = await getOrCreateDir(root, "docs");
  const chunks: IndexChunk[] = [];
  let docCount = 0;

  for await (const entry of walkFiles(docsDir)) {
    onProgress?.(`Lendo ${entry.path}`);
    const text = await extractFileText(entry.path, entry.handle);
    if (!text) continue;
    docCount += 1;
    const pieces = chunkText(text);
    pieces.forEach((piece, ordinal) => {
      const { tf, len } = computeTf(piece);
      chunks.push({
        id: `${entry.path}#${ordinal}`,
        path: entry.path,
        ordinal,
        text: piece,
        tf,
        len,
      });
    });
  }

  const index: DocsIndex = {
    updatedAt: Date.now(),
    docCount,
    chunkCount: chunks.length,
    chunks,
  };
  await writeJson(root, "index.json", index);
  return index;
}

export async function loadIndex(
  root: FileSystemDirectoryHandle,
): Promise<DocsIndex | null> {
  return readJson<DocsIndex>(root, "index.json");
}
