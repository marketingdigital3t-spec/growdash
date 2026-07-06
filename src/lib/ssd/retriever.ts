import type { DocsIndex, IndexChunk } from "./indexer";
import { tokenize } from "./indexer";

export interface Retrieved {
  chunk: IndexChunk;
  score: number;
}

/** TF-IDF cosine-ish scoring — enough to surface relevant chunks locally. */
export function retrieve(index: DocsIndex | null, query: string, k = 6): Retrieved[] {
  if (!index || !index.chunks.length) return [];
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];

  // document frequency per token
  const df: Record<string, number> = {};
  for (const c of index.chunks) {
    for (const w of Object.keys(c.tf)) df[w] = (df[w] ?? 0) + 1;
  }
  const N = index.chunks.length;
  const idf = (w: string) => Math.log(1 + N / ((df[w] ?? 0) + 1));

  const scored: Retrieved[] = [];
  for (const chunk of index.chunks) {
    let score = 0;
    for (const w of qTokens) {
      const tf = chunk.tf[w];
      if (!tf || !chunk.len) continue;
      const weight = idf(w);
      score += (tf / chunk.len) * weight * weight;
    }
    if (score > 0) scored.push({ chunk, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
