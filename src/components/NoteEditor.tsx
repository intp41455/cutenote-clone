import { useState, useEffect } from 'react';
import { getNote, createNote, updateNote, type OutputFormat } from '../lib/api';
import type { Route } from '../lib/router';

interface NoteEditorProps {
  id?: string;
  onNavigate: (route: Route) => void;
}

export default function NoteEditor({ id, onNavigate }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [format, setFormat] = useState<OutputFormat>('markdown');
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    getNote(id)
      .then((note) => {
        setTitle(note.title);
        setMarkdown(note.markdown);
        setFormat(note.format);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : '加载笔记失败');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!title.trim() || !markdown.trim()) {
      setError('标题和内容不能为空');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (id) {
        await updateNote(id, { title: title.trim(), markdown, format });
      } else {
        const note = await createNote({ title: title.trim(), markdown, format });
        onNavigate({ page: 'note', id: note.id });
        return;
      }
      onNavigate({ page: 'note', id });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-slate-500">正在加载笔记</p>
      </div>
    );
  }

  return (
    <section className="py-10 sm:py-14">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">
          {id ? '编辑笔记' : '新建笔记'}
        </h1>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {/* 标题 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入笔记标题…"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
            />
          </div>

          {/* 输出格式 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              输出格式
            </label>
            <div className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg p-1">
              {(
                [
                  ['image', '长图笔记'],
                  ['mindmap', '思维导图'],
                  ['markdown', 'Markdown'],
                ] as [OutputFormat, string][]
              ).map(([fmt, label]) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`flex-1 px-3 py-1.5 rounded-md transition-all ${
                    format === fmt
                      ? 'bg-white text-blue-600 font-medium shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Markdown 编辑器 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder={'# 标题\n\n## 章节\n\n- 要点一\n- 要点二\n\n正文内容…'}
              className="w-full min-h-[400px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 resize-y"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onNavigate({ page: 'my-notes' })}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim() || !markdown.trim()}
              className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {saving && (
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {saving ? '保存中…' : id ? '保存修改' : '创建笔记'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
