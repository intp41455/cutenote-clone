import { useState, useEffect } from 'react';
import { getPublicNotes, type PublicNote } from '../lib/api';

const CATEGORY_COLORS: Record<string, string> = {
  ai: 'bg-purple-100 text-purple-700',
  health: 'bg-green-100 text-green-700',
  programming: 'bg-blue-100 text-blue-700',
  finance: 'bg-amber-100 text-amber-700',
  education: 'bg-pink-100 text-pink-700',
  general: 'bg-slate-100 text-slate-600',
};

export default function RecentNotes() {
  const [notes, setNotes] = useState<PublicNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicNotes()
      .then((data) => setNotes(data.slice(0, 6)))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, []);

  const formatText = (format: PublicNote['format']) =>
    format === 'image' ? '长图笔记' : format === 'mindmap' ? '思维导图' : 'Markdown';

  const getCategoryColor = (category: string) => {
    const key = Object.keys(CATEGORY_COLORS).find((k) =>
      category.toLowerCase().includes(k)
    );
    return CATEGORY_COLORS[key || 'general'];
  };

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-start sm:items-center sm:justify-between mb-8">
          <h2 className="text-2xl font-bold text-stone-900">最近公开笔记</h2>
          <a href="#/explore" className="text-sm text-orange-600 hover:text-orange-700 font-medium">
            全部 →
          </a>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-sm text-stone-500">正在读取</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm">
            暂无公开笔记
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => (
              <a
                key={note.id}
                href={`#/notes/${note.id}`}
                className="bg-white rounded-xl border border-amber-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h3 className="text-base font-medium text-stone-900 line-clamp-2">
                      {note.title}
                    </h3>
                    <span className="flex-none px-2 py-0.5 text-xs rounded-full bg-amber-50 text-stone-500 border border-amber-100">
                      {formatText(note.format)}
                    </span>
                  </div>
                  <p className="text-sm text-stone-600 line-clamp-3 mb-3">
                    {note.summary}
                  </p>
                  {note.category && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(note.category)}`}>
                        {note.category}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-stone-400">
                    <span>
                      {note.platform}
                      {note.duration ? ` · ⏱ ${note.duration}` : ''}
                      · {new Date(note.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                    <span className="text-orange-500">查看 →</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
