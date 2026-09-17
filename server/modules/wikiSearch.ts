import type { WikiReference } from '../types';
import { request } from 'https';

const WIKI_BASES = {
  zh: 'https://zh.wikipedia.org/w/api.php',
  en: 'https://en.wikipedia.org/w/api.php',
};

const FETCH_TIMEOUT = 5000;

async function fetchWithTimeout(url: string): Promise<{ ok: boolean; status: number; json: () => Promise<any> } | null> {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const req = request(url, {
      headers: {
        'User-Agent': 'CuteNote/1.0 (https://www.cutenote.app)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        try {
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 400,
            status: res.statusCode!,
            json: () => Promise.resolve(JSON.parse(body)),
          });
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      console.warn(`[wikiSearch] Request error:`, err.message);
      resolve(null);
    });

    req.end();
  });
}

interface WikiSearchResult {
  pages: Array<{
    pageid: number;
    title: string;
    description?: string;
    extract?: string;
  }>;
}

async function wikiSearch(
  query: string,
  language: 'zh' | 'en',
  limit = 5
): Promise<WikiReference[]> {
  const url = new URL(WIKI_BASES[language]);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', query);
  url.searchParams.set('srlimit', String(limit));
  url.searchParams.set('srprop', 'snippet');
  url.searchParams.set('origin', '*');

  const response = await fetchWithTimeout(url.toString());
  if (!response || !response.ok) return [];

  try {
    const data: WikiSearchResult = await response.json();
    const results = data.query?.search || [];

    return results.map((r) => ({
      title: r.title,
      url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
      summary: r.snippet
        ? r.snippet.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        : '',
      language,
    }));
  } catch (err) {
    console.error(`[wikiSearch] ${language} parse failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

async function wikiExtract(
  titles: string[],
  language: 'zh' | 'en'
): Promise<WikiReference[]> {
  if (titles.length === 0) return [];

  const url = new URL(WIKI_BASES[language]);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('prop', 'extracts|info');
  url.searchParams.set('exintro', '1');
  url.searchParams.set('explaintext', '1');
  url.searchParams.set('inprop', 'url');
  url.searchParams.set('titles', titles.join('|'));
  url.searchParams.set('origin', '*');

  const response = await fetchWithTimeout(url.toString());
  if (!response || !response.ok) return [];

  try {
    const data = await response.json();
    const pages = data.query?.pages || {};
    const results: WikiReference[] = [];

    for (const page of Object.values(pages) as any[]) {
      if (page.title && page.extract) {
        const extract = page.extract.replace(/\s+/g, ' ').trim();
        results.push({
          title: page.title,
          url: page.fullurl || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
          summary: extract.slice(0, 500),
          language,
        });
      }
    }

    return results;
  } catch (err) {
    console.error(`[wikiSearch] ${language} extract parse failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

export interface WikiSearchResponse {
  references: WikiReference[];
  combinedSummary: string;
}

const SEARCH_OVERALL_TIMEOUT = 6000;

export async function searchWiki(keywords: string[]): Promise<WikiSearchResponse> {
  if (keywords.length === 0) {
    return { references: [], combinedSummary: '' };
  }

  try {
    return await Promise.race([
      doSearchWiki(keywords),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`searchWiki timeout ${SEARCH_OVERALL_TIMEOUT}ms`)), SEARCH_OVERALL_TIMEOUT)
      ),
    ]);
  } catch (err) {
    console.warn('[wikiSearch] searchWiki timed out or failed, returning empty results');
    return { references: [], combinedSummary: '' };
  }
}

async function doSearchWiki(keywords: string[]): Promise<WikiSearchResponse> {
  const zhSearch = await Promise.allSettled(
    keywords.slice(0, 3).map(kw => wikiSearch(kw, 'zh', 3))
  );
  const enSearch = await Promise.allSettled(
    keywords.slice(0, 3).map(kw => wikiSearch(kw, 'en', 3))
  );

  let allReferences: WikiReference[] = [];
  for (const r of zhSearch) {
    if (r.status === 'fulfilled') allReferences.push(...r.value);
  }
  for (const r of enSearch) {
    if (r.status === 'fulfilled') allReferences.push(...r.value);
  }

  const seen = new Set<string>();
  allReferences = allReferences.filter(r => {
    const key = r.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const topTitles = allReferences.slice(0, 5).map(r => r.title);
  const zhExtracts = await wikiExtract(topTitles.filter(t => /^[一-鿿]/.test(t)), 'zh');
  const enExtracts = await wikiExtract(topTitles.filter(t => !/^[一-鿿]/.test(t)), 'en');

  const finalReferences = [...zhExtracts, ...enExtracts].slice(0, 8);

  const combinedSummary = finalReferences
    .map(r => `${r.title}: ${r.summary}`)
    .join('\n\n');

  return {
    references: finalReferences.length > 0 ? finalReferences : allReferences.slice(0, 5),
    combinedSummary,
  };
}

export async function searchWikiSimple(query: string): Promise<WikiReference[]> {
  try {
    const [zh, en] = await Promise.race([
      Promise.allSettled([
        wikiSearch(query, 'zh', 5),
        wikiSearch(query, 'en', 5),
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('searchWikiSimple timeout')), 8000)
      ),
    ]);

    const results: WikiReference[] = [];
    if (zh.status === 'fulfilled') results.push(...zh.value);
    if (en.status === 'fulfilled') results.push(...en.value);

    return results;
  } catch {
    return [];
  }
}
