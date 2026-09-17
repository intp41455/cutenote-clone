import { useState, useEffect } from 'react';
import { getPublicNotes, type PublicNote } from '../lib/api';

const PAGE_SIZE = 10;

const CATEGORY_COLORS: Record<string, string> = {
  ai: 'bg-purple-100 text-purple-700',
  health: 'bg-green-100 text-green-700',
  programming: 'bg-blue-100 text-blue-700',
  finance: 'bg-amber-100 text-amber-700',
  education: 'bg-pink-100 text-pink-700',
  general: 'bg-slate-100 text-slate-600',
};

export default function ExplorePage() {
  const [allNotes, setAllNotes] = useState<PublicNote[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    getPublicNotes()
      .then(setAllNotes)
      .catch(() => setAllNotes([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = Array.from(new Set(allNotes.map((n) => n.category).filter(Boolean)));

  const filteredNotes = filter === 'all'
    ? allNotes
    : allNotes.filter((n) => n.category === filter);

  const notes = filteredNotes.slice(0, visibleCount);
  const done = visibleCount >= filteredNotes.length;

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  const getCategoryColor = (category: string) => {
    const key = Object.keys(CATEGORY_COLORS).find((k) =>
      category.toLowerCase().includes(k)
    );
    return CATEGORY_COLORS[key || 'general'];
  };

  return (
    <section className="py-10 sm:py-14">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h1 className="text-3xl font-bold text-stone-900">公开笔记</h1>
        <p className="mt-3 text-sm text-stone-600 leading-relaxed">
          这里展示根据公开互联网内容生成的完整笔记，不包含用户上传的文件或粘贴的私密内容。
        </p>

        {/* 分类筛选 */}
        {!loading && categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => { setFilter('all'); setVisibleCount(PAGE_SIZE); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-amber-200 text-stone-600 hover:border-orange-300'
              }`}
            >
              全部
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setFilter(cat); setVisibleCount(PAGE_SIZE); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === cat
                    ? 'bg-orange-500 text-white'
                    : 'bg-white border border-amber-200 text-stone-600 hover:border-orange-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {!loading && (
          <p className="mt-3 text-xs text-stone-400">已展示 {notes.length} 条</p>
        )}

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-sm text-stone-500">正在读取</p>
          </div>
        ) : allNotes.length === 0 ? (
          <div className="py-16 text-center text-stone-400 text-sm">
            暂无公开笔记
          </div>
        ) : (
          <>
            <div className="mt-6 divide-y divide-amber-100">
              {notes.map((n) => (
                <a
                  key={n.id}
                  href={`#/notes/${n.id}`}
                  className="block py-5 group"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {n.category && (
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${getCategoryColor(n.category)}`}>
                        {n.category}
                      </span>
                    )}
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-50 text-stone-500 border border-amber-100">
                      {n.platform}
                    </span>
                    {n.duration && (
                      <span className="inline-block text-xs text-stone-400">⏱ {n.duration}</span>
                    )}
                  </div>
                  <h2 className="mt-1 text-lg font-medium text-stone-900 group-hover:text-orange-600 transition-colors">
                    {n.title}
                  </h2>
                  <p className="mt-1 text-sm text-stone-500 line-clamp-2">{n.summary}</p>
                  {n.tags && n.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {n.tags.slice(0, 4).map((tag, i) => (
                        <span key={i} className="text-xs text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-stone-400">{fmtTime(n.createdAt)}</p>
                </a>
              ))}
            </div>

            <div className="mt-8 text-center">
              {done ? (
                <p className="text-sm text-stone-400">没有更多了</p>
              ) : (
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="px-6 py-2.5 rounded-lg border border-amber-200 bg-white text-sm text-stone-700 hover:bg-orange-50 hover:border-orange-300 transition-colors"
                >
                  加载更多
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
