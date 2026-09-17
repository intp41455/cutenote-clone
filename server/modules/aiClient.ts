import OpenAI from 'openai';

// Configuration from environment variables
const API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const CHAT_MODEL_RAW = process.env.CHAT_MODEL || 'gpt-4o';
const CHAT_MODELS = CHAT_MODEL_RAW.split('|').map(m => m.trim()).filter(Boolean);
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || '';

let client: OpenAI | null = null;

export function getConfig() {
  return {
    apiKey: API_KEY ? 'configured' : 'missing',
    baseUrl: BASE_URL,
    chatModel: CHAT_MODELS[0],
    modelPool: CHAT_MODELS,
    embeddingModel: EMBEDDING_MODEL || 'TF-IDF fallback',
  };
}

export function isConfigured(): boolean {
  return API_KEY.length > 0;
}

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: API_KEY,
      baseURL: BASE_URL,
    });
  }
  return client;
}

// ── Chat Completion ──────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string | null> {
  if (!isConfigured()) return null;

  for (let i = 0; i < CHAT_MODELS.length; i++) {
    const model = CHAT_MODELS[i];
    try {
      const c = getClient();
      const response = await c.chat.completions.create({
        model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 4096,
      });
      const content = response.choices[0]?.message?.content;
      if (content) {
        if (i > 0) console.log(`[aiClient] Fallback to model ${model} succeeded`);
        return content;
      }
    } catch (err) {
      console.error(`[aiClient] Model ${model} failed:`, (err as Error).message?.slice(0, 120));
      if (i < CHAT_MODELS.length - 1) {
        console.log(`[aiClient] Trying next model: ${CHAT_MODELS[i + 1]}`);
      }
    }
  }
  return null;
}

// ── Embeddings (with TF-IDF fallback) ────────────────────────────

export async function getEmbedding(text: string): Promise<number[] | null> {
  // Try OpenAI embeddings first
  if (EMBEDDING_MODEL && isConfigured()) {
    try {
      const c = getClient();
      const response = await c.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000), // avoid overly long inputs
      });
      return response.data[0]?.embedding ?? null;
    } catch (err) {
      console.error('[aiClient] embedding error, falling back to TF-IDF:', err);
    }
  }

  // TF-IDF fallback
  return tfidfEmbed(text);
}

// ── TF-IDF Vectorization (no API needed) ─────────────────────────

const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
  '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '为',
  '被', '从', '把', '对', '但', '而', '与', '及', '或', '等', '其', '中',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
  'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very',
  'this', 'that', 'these', 'those', 'am', 'if', 'because', 'until', 'while',
]);

// Fixed vocabulary for TF-IDF (top common Chinese/English terms for note-taking)
const VOCAB_SIZE = 512;

function tokenize(text: string): string[] {
  // Simple tokenization: split on non-alphanumeric/non-CJK chars
  // For Chinese, split into individual characters and bigrams
  const clean = text.replace(/\s+/g, ' ').trim().toLowerCase();
  const tokens: string[] = [];

  // English words
  const engWords = clean.match(/[a-z0-9]+/g) || [];
  tokens.push(...engWords.filter(w => w.length > 1 && !STOP_WORDS.has(w)));

  // Chinese characters - use bigrams for better semantic capture
  const chinese = clean.replace(/[^\u4e00-\u9fff]/g, '');
  for (let i = 0; i < chinese.length - 1; i++) {
    const bigram = chinese.slice(i, i + 2);
    if (!STOP_WORDS.has(bigram)) {
      tokens.push(bigram);
    }
  }

  // Keep original single chars if not in stop words
  for (const ch of chinese) {
    if (!STOP_WORDS.has(ch) && /[一-鿿]/.test(ch)) {
      tokens.push(ch);
    }
  }

  return tokens;
}

// Build a simple vocabulary from the text itself (self-contained TF-IDF)
function buildVocabulary(text: string): Map<string, number> {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  // Sort by frequency, take top N
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const vocab = new Map<string, number>();
  sorted.slice(0, VOCAB_SIZE).forEach(([token, _], i) => {
    vocab.set(token, i);
  });
  return vocab;
}

// Simple hash-based embedding that's deterministic and content-dependent
function tfidfEmbed(text: string): number[] {
  const tokens = tokenize(text);
  const embedding = new Array(VOCAB_SIZE).fill(0);

  // Count token frequencies
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }

  const totalTokens = tokens.length || 1;

  // Use hash function to map tokens to fixed-size vector
  for (const [token, count] of freq) {
    // Create a stable hash from the token
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % VOCAB_SIZE;
    const tf = count / totalTokens;
    embedding[idx] += tf;
  }

  // Normalize (L2)
  let norm = 0;
  for (const v of embedding) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < embedding.length; i++) {
    embedding[i] = +(embedding[i] / norm).toFixed(6);
  }

  return embedding;
}

// Batch embeddings
export async function getEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = [];
  for (const text of texts) {
    results.push(await getEmbedding(text));
  }
  return results;
}
