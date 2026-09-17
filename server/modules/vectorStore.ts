import { getEmbedding } from './aiClient';
import type { VectorChunk } from '../types';

interface StoredChunk {
  chunk: VectorChunk;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

class VectorStore {
  private store: Map<string, VectorChunk[]> = new Map();

  async addChunks(noteId: string, chunks: string[], source: 'original' | 'wiki' = 'original'): Promise<VectorChunk[]> {
    const vectorChunks: VectorChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await getEmbedding(chunks[i]);
      if (embedding) {
        vectorChunks.push({
          id: `chunk-${noteId}-${i}`,
          content: chunks[i],
          chunkIndex: i,
          embedding,
          source,
        });
      }
    }

    const existing = this.store.get(noteId) || [];
    this.store.set(noteId, [...existing, ...vectorChunks]);

    return vectorChunks;
  }

  getChunks(noteId: string): VectorChunk[] {
    return this.store.get(noteId) || [];
  }

  async search(noteId: string, query: string, topK = 5): Promise<Array<{ chunk: VectorChunk; score: number }>> {
    const chunks = this.store.get(noteId);
    if (!chunks || chunks.length === 0) return [];

    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding) return [];

    const results = chunks.map(chunk => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async searchAll(query: string, topK = 10): Promise<Array<{
    noteId: string;
    chunk: VectorChunk;
    score: number;
  }>> {
    const results: Array<{ noteId: string; chunk: VectorChunk; score: number }> = [];

    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding) return [];

    for (const [noteId, chunks] of this.store) {
      for (const chunk of chunks) {
        const score = cosineSimilarity(queryEmbedding, chunk.embedding);
        results.push({ noteId, chunk, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  loadChunk(noteId: string, chunk: VectorChunk) {
    const existing = this.store.get(noteId) || [];
    this.store.set(noteId, [...existing, chunk]);
  }

  loadAll(noteId: string, chunks: VectorChunk[]) {
    this.store.set(noteId, [...(this.store.get(noteId) || []), ...chunks]);
  }

  clear(noteId: string) {
    this.store.delete(noteId);
  }

  listNoteIds(): string[] {
    return [...this.store.keys()];
  }
}

export const vectorStore = new VectorStore();
