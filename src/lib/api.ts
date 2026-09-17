/**
 * CuteNote API 客户端 — 对接本地后端 (localhost:3001，经 Vite 代理转发)
 */

export type OutputFormat = 'image' | 'mindmap' | 'markdown';

export interface OutlineNode {
  title: string;
  content?: string;
  quote?: string;
  children?: OutlineNode[];
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'entity' | 'concept' | 'person' | 'organization' | 'location' | 'event';
  description?: string;
  wikiRef?: string;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relationship: string;
  weight: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export interface VectorChunk {
  id: string;
  content: string;
  chunkIndex: number;
  source: 'original' | 'wiki';
}

export interface WikiReference {
  title: string;
  url: string;
  summary: string;
  language: 'zh' | 'en';
}

export interface ContentAnalysis {
  keywords: string[];
  entities: string[];
  themes: string[];
  structure: string[];
  wordCount: number;
  paragraphCount: number;
}

export interface PublicNote {
  id: string;
  title: string;
  format: OutputFormat;
  summary: string;
  outline: OutlineNode[];
  markdown: string;
  category: string;
  tags: string[];
  duration: string;
  originalUrl: string;
  originalText: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  source: 'bilibili' | 'youtube' | 'web' | 'file' | 'manual';
  platform: string;
  knowledgeGraph?: KnowledgeGraph;
  vectorChunks?: VectorChunk[];
  drawioXml?: string;
  wikiReferences?: WikiReference[];
  analysis?: ContentAnalysis;
}

export interface GenerationJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  input: string;
  format: OutputFormat;
  noteId?: string;
  progress: number;
  stage?: string;
  error?: string;
  createdAt: string;
}

export interface NotesListResponse {
  notes: PublicNote[];
  total: number;
  page: number;
  limit: number;
}

export interface RAGSearchResult {
  chunkId: string;
  content: string;
  score: number;
  chunkIndex: number;
  source: string;
  noteId: string;
  noteTitle: string;
}

export interface ConfigStatus {
  configured: boolean;
  baseUrl?: string;
  chatModel?: string;
  embeddingModel?: string;
  embeddingFallback: string;
}

class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(err.code ?? 'UNKNOWN', err.message ?? res.statusText, res.status);
  }
  return data as T;
}

/* ---------------------------------------------------------------- */
/* 配置状态                                                          */
/* ---------------------------------------------------------------- */

export async function getConfigStatus(): Promise<ConfigStatus> {
  return request<ConfigStatus>('/api/config');
}

/* ---------------------------------------------------------------- */
/* 公开笔记                                                          */
/* ---------------------------------------------------------------- */

export async function getPublicNotes(): Promise<PublicNote[]> {
  const res = await request<{ notes: PublicNote[] }>('/api/public-notes');
  return res.notes;
}

/* ---------------------------------------------------------------- */
/* 我的笔记 CRUD                                                     */
/* ---------------------------------------------------------------- */

export async function listNotes(
  page = 1,
  limit = 12,
  search?: string,
): Promise<NotesListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return request<NotesListResponse>(`/api/notes?${params}`);
}

export async function getNote(id: string): Promise<PublicNote> {
  return request<PublicNote>(`/api/notes/${id}`);
}

export async function createNote(data: {
  title: string;
  markdown: string;
  format: OutputFormat;
  summary?: string;
}): Promise<PublicNote> {
  return request<PublicNote>('/api/notes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateNote(
  id: string,
  data: { title?: string; markdown?: string; format?: OutputFormat; summary?: string },
): Promise<PublicNote> {
  return request<PublicNote>(`/api/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteNote(id: string): Promise<void> {
  await request<{ success: boolean }>(`/api/notes/${id}`, { method: 'DELETE' });
}

/* ---------------------------------------------------------------- */
/* 生成任务                                                          */
/* ---------------------------------------------------------------- */

export async function createGenerationJob(
  input: string,
  format: OutputFormat,
): Promise<GenerationJob> {
  return request<GenerationJob>('/api/generation-jobs', {
    method: 'POST',
    body: JSON.stringify({ input, format }),
  });
}

export async function getGenerationJob(id: string): Promise<GenerationJob> {
  return request<GenerationJob>(`/api/generation-jobs/${id}`);
}

/** 发起生成：轮询任务直到完成，返回最终笔记。 */
export async function startGeneration(
  input: string,
  format: OutputFormat,
  onProgress?: (p: number, stage?: string) => void,
): Promise<PublicNote> {
  const job = await createGenerationJob(input, format);
  const deadline = Date.now() + 120_000;
  let current = job;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1_500));
    current = await getGenerationJob(job.id);
    onProgress?.(current.progress, current.stage);
    if (current.status === 'completed' || current.status === 'failed') break;
  }

  if (current.status !== 'completed' || !current.noteId) {
    throw new Error(current.error ?? '生成失败，请稍后重试');
  }
  return getNote(current.noteId);
}

/* ---------------------------------------------------------------- */
/* RAG 向量检索                                                      */
/* ---------------------------------------------------------------- */

export async function searchRag(
  query: string,
  noteId?: string,
  topK = 10,
): Promise<RAGSearchResult[]> {
  const body = noteId
    ? { query, noteId, topK }
    : { query, topK };
  const res = await request<{ results: RAGSearchResult[] }>('/api/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.results;
}

/* ---------------------------------------------------------------- */
/* 知识图谱                                                          */
/* ---------------------------------------------------------------- */

export async function getKnowledgeGraph(noteId: string): Promise<KnowledgeGraph> {
  return request<KnowledgeGraph>(`/api/knowledge-graph/${noteId}`);
}

/* ---------------------------------------------------------------- */
/* Drawio 图表                                                       */
/* ---------------------------------------------------------------- */

export async function getDrawio(noteId: string): Promise<string> {
  const res = await request<{ xml: string }>(`/api/drawio/${noteId}`);
  return res.xml;
}

/* ---------------------------------------------------------------- */
/* Wiki 检索                                                         */
/* ---------------------------------------------------------------- */

export async function wikiSearch(query: string): Promise<WikiReference[]> {
  const params = new URLSearchParams({ q: query });
  const res = await request<{ references: WikiReference[] }>(`/api/wiki-search?${params}`);
  return res.references;
}

/* ---------------------------------------------------------------- */
/* AI 问答                                                           */
/* ---------------------------------------------------------------- */

export async function askAI(noteId: string, question: string): Promise<string> {
  const res = await request<{ answer: string }>('/api/ask', {
    method: 'POST',
    body: JSON.stringify({ noteId, question }),
  });
  return res.answer;
}
