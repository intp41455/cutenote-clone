import * as cheerio from 'cheerio';
import https from 'https';

export interface ExtractedContent {
  title: string;
  text: string;
  description?: string;
  source: 'url' | 'text' | 'file';
  url?: string;
  metadata?: Record<string, string>;
}

// ── URL Detection ────────────────────────────────────────────────

export function isUrl(input: string): boolean {
  return /^https?:\/\/\S+$/i.test(input.trim());
}

export function isFileExtension(input: string): boolean {
  return /\.(txt|md|markdown|html|htm|csv|json|pdf|doc|docx)$/i.test(input.trim());
}

export function detectPlatform(input: string): string {
  const url = input.toLowerCase();
  if (url.includes('bilibili.com') || url.includes('b23.tv') || url.includes('bvid')) return 'Bilibili';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('youtu')) return 'YouTube';
  if (/\.(txt|md|markdown|csv|json)$/i.test(url)) return '文本文件';
  if (/\.(html|htm)$/i.test(url)) return 'HTML文件';
  if (/\.(pdf|doc|docx)$/i.test(url)) return '文档文件';
  if (/\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(url)) return '音频文件';
  if (/\.(mp4|avi|mkv|mov|wmv|flv|webm)$/i.test(url)) return '视频文件';
  if (isUrl(input)) return '网页';
  return '文本';
}

// ── URL Content Extraction ───────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractTextFromHtml(html: string, url?: string): ExtractedContent {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, noscript, iframe, svg, nav, footer, header, aside, form').remove();
  // Remove common boilerplate
  $('[class*="advert"], [class*="banner"], [class*="sidebar"], [id*="advert"]').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();

  // Extract title
  let title = $('title').text().trim() ||
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    '';

  // Extract description
  const description = $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    '';

  // Extract main content - try common content selectors
  const contentSelectors = [
    'article',
    '[role="main"]',
    'main',
    '.content',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.markdown-body',
    '.post-body',
    '#content',
    '.article',
    '.post',
    '.entry',
    '.video-introduction',
    '.video-description',
  ];

  let contentText = '';
  for (const sel of contentSelectors) {
    const el = $(sel).first();
    if (el.length > 0) {
      const text = el.text().replace(/\s+/g, ' ').trim();
      if (text.length > contentText.length) {
        contentText = text;
      }
    }
  }

  // Fallback: get all text from body
  if (!contentText || contentText.length < 100) {
    contentText = $('body').text().replace(/\s+/g, ' ').trim();
  }

  // Clean up excessive whitespace
  contentText = contentText.replace(/\n{3,}/g, '\n\n').trim();

  return {
    title: title || '未命名页面',
    text: contentText || '',
    description,
    source: 'url',
    url,
    metadata: {
      'og:title': $('meta[property="og:title"]').attr('content') || '',
      'og:image': $('meta[property="og:image"]').attr('content') || '',
    },
  };
}

// ── Bilibili-specific extraction ─────────────────────────────────

function extractBilibili(html: string, url: string): ExtractedContent {
  const $ = cheerio.load(html);
  const base = extractTextFromHtml(html, url);

  // Try to get video title from og:title
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  if (ogTitle) base.title = ogTitle;

  // Get video description from .video-introduction or .desc
  const descEl = $('.video-introduction').first().text() ||
    $('.desc').first().text() || '';
  if (descEl) {
    base.description = descEl.trim();
    if (!base.text) base.text = descEl.trim();
  }

  // Get tags
  const tags: string[] = [];
  $('.tag-link, .tag-text').each((_, el) => {
    const t = $(el).text().trim();
    if (t) tags.push(t);
  });
  if (tags.length > 0) base.metadata = { ...base.metadata, tags: tags.join(', ') };

  // Get uploader info
  const uploader = $('.up-name').first().text().trim() ||
    $('.owner-name').first().text().trim() || '';
  if (uploader) base.metadata = { ...base.metadata, uploader };

  return base;
}

// ── YouTube-specific extraction ──────────────────────────────────

function extractYouTube(html: string, url: string): ExtractedContent {
  const $ = cheerio.load(html);
  const base = extractTextFromHtml(html, url);

  // Get title
  const title = $('meta[property="og:title"]').attr('content') ||
    $('title').text().replace(/ - YouTube$/, '').trim() || '';
  if (title) base.title = title;

  // Get description
  const desc = $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') || '';
  if (desc) base.description = desc;

  // Get tags from meta
  const tagsMeta = $('meta[name="keywords"]').attr('content') || '';
  if (tagsMeta) {
    base.metadata = { ...base.metadata, tags: tagsMeta };
  }

  return base;
}

// ── File Content Extraction ──────────────────────────────────────

function extractFromFile(input: string): ExtractedContent {
  // For file uploads, the input is typically the filename
  const fileName = input.trim();
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  return {
    title: fileName.replace(/\.[^.]+$/, ''), // filename without extension
    text: '', // actual file content would need to be read from disk
    source: 'file',
    metadata: { extension: ext, filename: fileName },
  };
}

// ── Bilibili Subtitle Extraction ─────────────────────────────────

async function fetchJSON(url: string, timeoutMs = 15000): Promise<any | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { resolve(null); }, timeoutMs);
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.bilibili.com/',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => { clearTimeout(timeout); resolve(null); });
  });
}

async function fetchText(url: string, timeoutMs = 15000): Promise<string | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { resolve(null); }, timeoutMs);
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { clearTimeout(timeout); resolve(data); });
    });
    req.on('error', () => { clearTimeout(timeout); resolve(null); });
  });
}

function parseBvid(url: string): string | null {
  const m = url.match(/(?:bvid=|\/)(BV[0-9A-Za-z]+)/);
  return m ? m[1] : null;
}

function parseVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function extractBilibiliSubtitles(url: string): Promise<string | null> {
  const bvid = parseBvid(url);
  if (!bvid) return null;

  // Get video info (cid)
  const info = await fetchJSON(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
  if (!info || info.code !== 0) return null;

  const { cid, title, desc, owner, stat } = info.data;
  let subtitleText = '';

  // Try to get subtitles via player API
  const player = await fetchJSON(
    `https://api.bilibili.com/x/player/wbi/v2?bvid=${bvid}&cid=${cid}`,
    10000
  );
  if (player && player.data && player.data.subtitle && player.data.subtitle.subtitles) {
    for (const sub of player.data.subtitle.subtitles) {
      const subUrl = `https:${sub.subtitle_url}`;
      const json = await fetchJSON(subUrl, 10000);
      if (json && Array.isArray(json.body)) {
        subtitleText += json.body.map((b: any) => b.content).join('\n');
      }
    }
  }

  // Combine: subtitles (primary) + description (supplement)
  const combined = [subtitleText, desc].filter(Boolean).join('\n\n');
  return combined || null;
}

async function extractYouTubeSubtitles(url: string): Promise<string | null> {
  const videoId = parseVideoId(url);
  if (!videoId) return null;

  // Try timedtext API with common languages
  const langs = ['zh-Hans', 'zh-CN', 'zh', 'en'];
  for (const lang of langs) {
    const txt = await fetchText(
      `https://video.google.com/timedtext?lang=${lang}&v=${videoId}&kind=asr`,
      8000
    );
    if (txt && txt.length > 50) {
      // Parse XML-like timedtext to plain text
      const lines = txt.split('\n').filter(l => {
        const m = l.match(/<text[^>]*>([^<]+)<\/text>/);
        return m;
      });
      const clean = lines
        .map(l => l.replace(/<text[^>]*>([^<]+)<\/text>/, '$1'))
        .map(l => l.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'))
        .join('\n');
      if (clean.length > 50) return clean;
    }
  }

  // Fallback: try to extract captions from video page HTML
  const html = await fetchWithTimeout(`https://www.youtube.com/watch?v=${videoId}`, 10000);
  if (!html) return null;

  // Extract ytInitialPlayerResponse which may contain caption info
  const captionMatch = html.match(/"captionTracks":(\[.*?\])\s*,"videoContext"/s);
  if (captionMatch) {
    try {
      const tracks = JSON.parse(captionMatch[1]);
      // Find Chinese track first, then English
      const target = tracks.find(t => t.languageCode?.startsWith('zh')) || tracks[0];
      if (target?.baseUrl) {
        const baseUrl = target.baseUrl.replace(/&fmt=.*$/, '');
        const txt = await fetchText(baseUrl, 8000);
        if (txt && txt.length > 50) {
          const lines = txt.split('\n').filter(l => {
            const m = l.match(/<text[^>]*>([^<]+)<\/text>/);
            return m;
          });
          const clean = lines
            .map(l => l.replace(/<text[^>]*>([^<]+)<\/text>/, '$1'))
            .map(l => l.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'))
            .join('\n');
          if (clean.length > 50) return clean;
        }
      }
    } catch { /* ignore parse error */ }
  }

  return null;
}

// ── Main Entry Point ─────────────────────────────────────────────

export async function extractContent(input: string): Promise<ExtractedContent> {
  const trimmed = input.trim();

  // URL input
  if (isUrl(trimmed)) {
    const url = trimmed;
    const platform = detectPlatform(url);

    try {
      const html = await fetchWithTimeout(url);
      let result: ExtractedContent;

      if (platform === 'Bilibili') {
        result = extractBilibili(html, url);
      } else if (platform === 'YouTube') {
        result = extractYouTube(html, url);
      } else {
        result = extractTextFromHtml(html, url);
      }

      // Fetch subtitles/transcript for video platforms
      if (platform === 'Bilibili' || platform === 'YouTube') {
        try {
          const subtitles = platform === 'Bilibili'
            ? await extractBilibiliSubtitles(url)
            : await extractYouTubeSubtitles(url);
          if (subtitles && subtitles.length > 100) {
            result.text = subtitles + (result.text ? '\n\n' + result.text : '');
            result.metadata = { ...result.metadata, hasSubtitles: 'true', subtitleLength: String(subtitles.length) };
            console.log(`[contentExtractor] Extracted ${subtitles.length} chars of subtitles from ${platform}`);
          }
        } catch (subErr) {
          console.error('[contentExtractor] Subtitle extraction failed:', subErr);
        }
      }

      return result;
    } catch (err) {
      console.error('[contentExtractor] URL fetch failed:', err);
      // Fallback: use URL as title
      return {
        title: url,
        text: '',
        source: 'url',
        url,
        metadata: { fetchError: String(err) },
      };
    }
  }

  // File extension input
  if (isFileExtension(trimmed)) {
    return extractFromFile(trimmed);
  }

  // Plain text input
  return {
    title: trimmed.slice(0, 50) + (trimmed.length > 50 ? '...' : ''),
    text: trimmed,
    source: 'text',
  };
}

// ── Text Analysis Utilities ──────────────────────────────────────

export function countWords(text: string): number {
  const chinese = text.match(/[一-鿿]/g)?.length || 0;
  const english = text.match(/[a-zA-Z]+/g)?.length || 0;
  return chinese + english;
}

export function countParagraphs(text: string): number {
  return text.split(/\n{2,}/).filter(p => p.trim().length > 0).length;
}

export function chunkText(text: string, maxChunkSize = 500): string[] {
  if (!text.trim()) return [];

  // Split by paragraphs first
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length > maxChunkSize && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If single chunk is too large, split by sentences
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChunkSize * 1.5) {
      result.push(chunk);
    } else {
      // Split by sentences
      const sentences = chunk.split(/(?<=[。！？.!?])\s*/);
      let sub = '';
      for (const s of sentences) {
        if (sub.length + s.length > maxChunkSize && sub) {
          result.push(sub.trim());
          sub = s;
        } else {
          sub += s;
        }
      }
      if (sub.trim()) result.push(sub.trim());
    }
  }

  return result.filter(c => c.trim().length > 10);
}

export function extractKeywords(text: string, maxKeywords = 15): string[] {
  // Extract keywords using frequency analysis
  const STOP_WORDS = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
    '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
    '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '为',
    '被', '从', '把', '对', '但', '而', '与', '及', '或', '等', '其', '中',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'and', 'but', 'or', 'not', 'so', 'this', 'that', 'these', 'those',
  ]);

  // Extract English keywords
  const engWords = text.match(/[a-zA-Z]{3,}/g) || [];
  const engFreq = new Map<string, number>();
  for (const w of engWords) {
    const lw = w.toLowerCase();
    if (!STOP_WORDS.has(lw)) {
      engFreq.set(lw, (engFreq.get(lw) || 0) + 1);
    }
  }

  // Extract Chinese keywords (bigrams)
  const chinese = text.replace(/[^\u4e00-\u9fff]/g, '');
  const cnFreq = new Map<string, number>();
  for (let i = 0; i < chinese.length - 1; i++) {
    const bigram = chinese.slice(i, i + 2);
    if (!STOP_WORDS.has(bigram)) {
      cnFreq.set(bigram, (cnFreq.get(bigram) || 0) + 1);
    }
  }

  // Combine and sort by frequency
  const all: { word: string; freq: number }[] = [];
  for (const [word, freq] of engFreq) {
    if (freq >= 2) all.push({ word, freq });
  }
  for (const [word, freq] of cnFreq) {
    if (freq >= 2) all.push({ word, freq });
  }

  all.sort((a, b) => b.freq - a.freq);

  // Remove bigrams that are substrings of longer matched words
  const keywords: string[] = [];
  for (const item of all) {
    if (!keywords.some(k => k.includes(item.word) || item.word.includes(k))) {
      keywords.push(item.word);
      if (keywords.length >= maxKeywords) break;
    }
  }

  return keywords;
}
