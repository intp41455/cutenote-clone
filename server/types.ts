// Shared types for the analysis pipeline

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
  embedding: number[];
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

export type NoteSource = 'bilibili' | 'youtube' | 'web' | 'file' | 'manual';

export interface Note {
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
  source: NoteSource;
  platform: string;
  // New fields for analysis pipeline
  knowledgeGraph?: KnowledgeGraph;
  vectorChunks?: VectorChunk[];
  drawioXml?: string;
  wikiReferences?: WikiReference[];
  analysis?: ContentAnalysis;
}

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface GenerationJob {
  id: string;
  status: JobStatus;
  input: string;
  format: OutputFormat;
  noteId?: string;
  progress: number;
  error?: string;
  stage?: string;
  createdAt: string;
}

export interface DB {
  notes: Note[];
  jobs: GenerationJob[];
}
