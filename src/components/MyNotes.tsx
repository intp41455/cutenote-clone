import { useState, useEffect } from 'react';
import { listNotes, deleteNote, type PublicNote } from '../lib/api';
import type { Route } from '../lib/router';

interface MyNotesProps {
  onNavigate: (route: Route) => void;
}

const PAGE_SIZE = 12;

export default function MyNotes({ onNavigate }: MyNotesProps) {
  const [notes, setNotes] = useState<PublicNote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async (p: number, keyword: string) => {
    setLoading(true);
    try {
      const res = await listNotes(p, PAGE_SIZE, keyword || undefined);
      setNotes(res.notes);
      setTotal(res.total);
      setPage(res.page);
    } catch {
      setNotes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, search);
  }, [search]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除这条笔记？')) return;
    setDeleting(id);
    try {
      await deleteNote(id);
      const next = notes.filter((n) => n.id !== id);
      setNotes(next);
      setTotal((t) => t - 1);
      if (next.length === 0 && page > 1) {
        load(page - 1, search);
      }
    } catch {
      alert('删除失败，请重试');
    } finally {
      setDeleting(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  const fmtLabel = (format: PublicNote['format']) =>
    format === 'image' ? '长图笔记' : format === 'mindmap' ? '思维导图' : 'Markdown';

  return (
    <section className="py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 头部 */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">我的笔记</h1>
            <p className="mt-1 text-sm text-slate-500">共 {total} 条笔记</p>
          </div>
          <button
            onClick={() => onNavigate({ page: 'new-note' })}
            className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            + 新建笔记
          </button>
        </div>

        {/* 搜索 */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索笔记标题、内容…"
            className="w-full max-w-md px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
          />
        </div>

        {/* 加载/列表 */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-sm text-slate-500">正在加载</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-slate-500 mb-1">
              {search ? '没有找到匹配的笔记' : '还没有笔记'}
            </p>
            <p className="text-sm text-slate-400 mb-5">
              {search ? '换个关键词试试' : '创建第一条笔记，开始记录吧'}
            </p>
            {!search && (
              <button
                onClick={() => onNavigate({ page: 'new-note' })}
                className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                + 新建笔记
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                      {fmtLabel(note.format)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {note.platform}
                    </span>
                  </div>
                  <h3
                    className="text-base font-medium text-slate-900 line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => onNavigate({ page: 'note', id: note.id })}
                  >
                    {note.title}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-3 mt-1">
                    {note.summary}
                  </p>
                  <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {fmtTime(note.updatedAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onNavigate({ page: 'edit-note', id: note.id })}
                        className="px-2.5 py-1 text-xs rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        disabled={deleting === note.id}
                        className="px-2.5 py-1 text-xs rounded-md text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deleting === note.id ? '删除中…' : '删除'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => load(page - 1, search)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              上一页
            </button>
            <span className="text-sm text-slate-500 px-3">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => load(page + 1, search)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
