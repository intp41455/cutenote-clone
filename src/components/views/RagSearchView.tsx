import { useState, useCallback } from 'react';
import { searchRag, type RAGSearchResult } from '../../lib/api';

interface RagSearchViewProps {
  noteId: string;
  noteTitle: string;
}

export default function RagSearchView({ noteId, noteTitle }: RagSearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RAGSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [scope, setScope] = useState<'current' | 'all'>('current');

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    try {
      const res = await searchRag(q, scope === 'current' ? noteId : undefined, 10);
      setResults(res);
      setHasSearched(true);
    } catch {
      setResults([]);
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  }, [query, searching, scope, noteId]);

  const fmtScore = (s: number) => {
    if (s >= 0.7) return { label: `${(s * 100).toFixed(0)}%`, color: 'text-emerald-600 bg-emerald-50' };
    if (s >= 0.4) return { label: `${(s * 100).toFixed(0)}%`, color: 'text-amber-600 bg-amber-50' };
    return { label: `${(s * 100).toFixed(0)}%`, color: 'text-slate-500 bg-slate-100' };
  };

  const suggestions = [
    '这篇笔记讲了什么？',
    '核心观点是什么？',
    '有哪些关键概念？',
    '总结要点',
  ];

  return (
    <div className="rounded-2xl border border-orange-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-orange-50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">🔍 RAG 向量检索</span>
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setScope('current')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                scope === 'current'
                  ? 'bg-orange-100 text-orange-700 font-medium'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              当前笔记
            </button>
            <button
              onClick={() => setScope('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                scope === 'all'
                  ? 'bg-orange-100 text-orange-700 font-medium'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              全部笔记
            </button>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="p-5 sm:p-6">
        <div className="flex gap-2 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="输入问题或关键词进行向量检索…"
            className="flex-1 px-4 py-2.5 bg-orange-50/50 border border-orange-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 placeholder-slate-400"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm hover:from-orange-600 hover:to-rose-600 transition-all shadow-sm disabled:opacity-50"
          >
            {searching ? '检索中…' : '检索'}
          </button>
        </div>

        {/* Suggestion chips */}
        {!hasSearched && (
          <div className="flex flex-wrap gap-2 mb-4">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => { setQuery(s); }}
                className="px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-xs text-orange-600 hover:bg-orange-100 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {searching && (
          <div className="py-12 text-center">
            <div className="inline-block w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-sm text-slate-500">正在检索向量数据库</p>
          </div>
        )}

        {hasSearched && !searching && results.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-slate-500 text-sm">未找到相关结果</p>
            <p className="text-slate-400 text-xs mt-1">尝试使用不同的关键词检索</p>
          </div>
        )}

        {hasSearched && !searching && results.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-400">
                找到 {results.length} 个相关片段
              </span>
              <span className="flex-1 h-px bg-slate-100" />
            </div>
            <div className="space-y-3">
              {results.map((result, i) => {
                const score = fmtScore(result.score);
                return (
                  <div
                    key={result.chunkId}
                    className="rounded-xl border border-orange-100 bg-white p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1 flex-none">
                        <span className="text-xs font-bold text-slate-400">{i + 1}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${score.color}`}>
                          {score.label}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              result.source === 'wiki'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {result.source === 'wiki' ? '📚 Wiki' : '📄 原文'}
                          </span>
                          <span className="text-xs text-slate-400">片段 #{result.chunkIndex}</span>
                          {result.noteTitle && scope === 'all' && (
                            <span className="text-xs text-slate-400 truncate max-w-[200px]">
                              · {result.noteTitle}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                          {result.content.length > 300
                            ? result.content.slice(0, 300) + '…'
                            : result.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
