import { useState, useEffect, useRef, useCallback } from 'react';
import { getNote, deleteNote, askAI, type PublicNote, type OutlineNode } from '../lib/api';
import { toPng } from 'html-to-image';
import type { Route } from '../lib/router';
import KnowledgeGraphView from './views/KnowledgeGraphView';
import RagSearchView from './views/RagSearchView';
import DrawioView from './views/DrawioView';

type ViewMode = 'image' | 'mindmap' | 'markdown' | 'original' | 'knowledge-graph' | 'rag' | 'drawio' | 'ask';

interface NoteDetailPageProps {
  id: string;
  onNavigate: (route: Route) => void;
}

export default function NoteDetailPage({ id, onNavigate }: NoteDetailPageProps) {
  const [note, setNote] = useState<PublicNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('image');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const longImageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const n = await getNote(id);
        setNote(n);
        setView(n.format === 'markdown' ? 'markdown' : n.format);
      } catch {
        setNote(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('确定删除这条笔记？')) return;
    setDeleting(true);
    try {
      await deleteNote(id);
      onNavigate({ page: 'my-notes' });
    } catch {
      alert('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    if (!longImageRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(longImageRef.current, {
        pixelRatio: 2,
        backgroundColor: '#FFF8F0',
      });
      const link = document.createElement('a');
      link.download = `${note?.title?.slice(0, 20) || '笔记'}-长图.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-slate-500">正在读取笔记</p>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="py-24 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-slate-500">笔记不存在或已被删除</p>
        <button
          onClick={() => onNavigate({ page: 'my-notes' })}
          className="mt-4 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 transition-colors"
        >
          返回我的笔记
        </button>
      </div>
    );
  }

  const isPublic = note.isPublic;

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const tabs: Array<{ key: ViewMode; label: string; dot?: boolean }> = [
    { key: 'image', label: '长图' },
    { key: 'mindmap', label: '脑图' },
    { key: 'markdown', label: 'Markdown' },
    { key: 'original', label: '原文' },
    { key: 'knowledge-graph', label: '知识图谱' },
    { key: 'rag', label: 'RAG检索' },
    { key: 'drawio', label: 'Drawio' },
    { key: 'ask', label: 'AI 问答', dot: true },
  ];

  return (
    <section className="py-8 sm:py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* 返回按钮 */}
        <button
          onClick={() => onNavigate({ page: isPublic ? 'explore' : 'my-notes' })}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-orange-600 transition-colors mb-4"
        >
          <span>←</span>
          <span>返回</span>
        </button>

        {/* 标题区域 */}
        <div className="mb-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium mb-2">
            {note.category}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
          {note.title}
        </h1>

        {/* 元信息 */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span>⏱</span>
            <span>{note.duration}</span>
          </span>
          <span className="text-slate-300">·</span>
          <span>{note.platform}</span>
          <span className="text-slate-300">·</span>
          <span>{fmtTime(note.createdAt)}</span>
        </div>

        {/* 工具栏 */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {/* 标签切换 */}
          <div className="flex items-center gap-0.5 text-sm bg-orange-50/50 rounded-lg p-1 border border-orange-100">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-all ${
                  view === t.key
                    ? 'bg-white text-orange-600 font-medium shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.dot && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                {t.label}
                {view === t.key && <span className="text-orange-400">✓</span>}
              </button>
            ))}
          </div>

          {/* 右侧按钮 */}
          <div className="flex items-center gap-2 text-sm">
            {note.originalUrl && (
              <a
                href={note.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors"
              >
                查看原链接
              </a>
            )}
            {view === 'image' && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-3 py-1.5 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-50"
              >
                {exporting ? '导出中…' : '导出长图'}
              </button>
            )}
            {!isPublic && (
              <>
                <button
                  onClick={() => onNavigate({ page: 'edit-note', id: note.id })}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  编辑
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deleting ? '删除中…' : '删除'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 内容区 */}
        <div className="mt-6">
          {view === 'image' && <LongImageView note={note} ref={longImageRef} />}
          {view === 'mindmap' && <MindMapView outline={note.outline ?? []} title={note.title} />}
          {view === 'markdown' && <MarkdownView markdown={note.markdown ?? ''} />}
          {view === 'original' && <OriginalTextView note={note} />}
          {view === 'knowledge-graph' && <KnowledgeGraphView graph={note.knowledgeGraph} noteId={note.id} />}
          {view === 'rag' && <RagSearchView noteId={note.id} noteTitle={note.title} />}
          {view === 'drawio' && <DrawioView noteId={note.id} noteTitle={note.title} />}
          {view === 'ask' && <AskPanel noteId={note.id} />}
        </div>
      </div>
    </section>
  );
}

/* ==================== 长图视图 ==================== */

const SECTION_COLORS = [
  'from-orange-400 to-rose-400',
  'from-blue-400 to-cyan-400',
  'from-emerald-400 to-teal-400',
  'from-purple-400 to-pink-400',
  'from-amber-400 to-orange-400',
  'from-rose-400 to-pink-400',
];

function LongImageView(
  { note }: { note: PublicNote },
  ref: React.RefObject<HTMLDivElement | null>,
) {
  return (
    <div
      ref={ref}
      className="rounded-2xl bg-gradient-to-br from-orange-100 via-rose-50 to-amber-50 p-1 shadow-md"
    >
      <div className="rounded-2xl bg-white p-6 sm:p-8">
        {/* 分类徽章 */}
        <div className="mb-4">
          <span className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-medium">
            {note.category}
          </span>
        </div>

        {/* 标题 */}
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
          {note.title}
        </h2>

        {/* 描述 */}
        {note.summary && (
          <p className="mt-2 text-sm text-slate-500 leading-relaxed line-clamp-3">
            {note.summary}
          </p>
        )}

        {/* 标签 */}
        {note.tags && note.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {note.tags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-medium border border-orange-100"
              >
                <span>🏷</span>
                <span>{tag}</span>
              </span>
            ))}
          </div>
        )}

        {/* 分隔线 */}
        <div className="my-6 h-px bg-gradient-to-r from-transparent via-orange-200 to-transparent" />

        {/* 编号章节 */}
        <div className="space-y-5">
          {(note.outline ?? []).map((node, i) => (
            <div key={i} className="flex gap-4">
              <div
                className={`flex-none w-8 h-8 rounded-lg bg-gradient-to-br ${
                  SECTION_COLORS[i % SECTION_COLORS.length]
                } text-white text-xs font-bold flex items-center justify-center`}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 text-sm">{node.title}</div>
                {node.content && (
                  <p className="mt-1.5 text-sm text-slate-500 leading-relaxed whitespace-pre-line">
                    {node.content}
                  </p>
                )}
                {node.quote && (
                  <blockquote className="mt-2.5 pl-3 border-l-3 border-orange-300 bg-orange-50/50 rounded-r-lg py-2 px-3">
                    <p className="text-sm text-slate-600 italic leading-relaxed">
                      {node.quote}
                    </p>
                  </blockquote>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 页脚 */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>CuteNote 颜值笔记</span>
          <span>由 AI 生成 · 仅供参考</span>
        </div>
      </div>
    </div>
  );
}

/* ==================== 思维导图视图 ==================== */

const MINDMAP_BRANCH_COLORS = [
  { border: 'border-orange-400', bg: 'bg-orange-50', text: 'text-orange-800' },
  { border: 'border-blue-400', bg: 'bg-blue-50', text: 'text-blue-800' },
  { border: 'border-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-800' },
  { border: 'border-purple-400', bg: 'bg-purple-50', text: 'text-purple-800' },
  { border: 'border-rose-400', bg: 'bg-rose-50', text: 'text-rose-800' },
  { border: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-800' },
];

function MindMapView({ outline, title }: { outline: OutlineNode[]; title: string }) {
  const [zoom, setZoom] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(outline.map((_, i) => `node-${i}`)),
  );
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateRef = useRef(translate);
  translateRef.current = translate;

  const toggleNode = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set<string>();
    const walk = (nodes: OutlineNode[], prefix: string) => {
      nodes.forEach((n, i) => {
        const id = `${prefix}-${i}`;
        all.add(id);
        if (n.children) walk(n.children, id);
      });
    };
    walk(outline, 'root');
    setExpanded(all);
  }, [outline]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setTranslate({
      x: translateRef.current.x + dx,
      y: translateRef.current.y + dy,
    });
    dragStart.current = { x: e.clientX, y: e.clientY };
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const renderBranch = (node: OutlineNode, depth: number, parentId: string, index: number): React.ReactNode => {
    const color = MINDMAP_BRANCH_COLORS[depth % MINDMAP_BRANCH_COLORS.length];
    const nodeId = `${parentId}-${index}`;
    const isExpanded = expanded.has(nodeId);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={nodeId} className="flex flex-col gap-2">
        <div
          onClick={() => hasChildren && toggleNode(nodeId)}
          className={`px-3.5 py-2 rounded-lg border-l-4 text-sm font-medium shadow-sm transition-all cursor-pointer ${color.border} ${color.bg} ${color.text} ${hasChildren ? 'hover:shadow-md' : ''}`}
        >
          <span className="flex items-center gap-2">
            {node.title}
            {hasChildren && (
              <span className="text-xs opacity-60">
                {isExpanded ? '▾' : '▸'}
              </span>
            )}
          </span>
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-4 flex flex-col gap-2 border-l-2 border-slate-200 pl-5">
            {node.children!.map((c, i) => renderBranch(c, depth + 1, nodeId, i))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="relative rounded-2xl border border-orange-100 bg-white overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ minHeight: '400px' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 控制按钮 */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(2, z + 0.15)); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center text-lg font-bold shadow-sm"
          title="放大"
        >
          +
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(0.4, z - 0.15)); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center text-lg font-bold shadow-sm"
          title="缩小"
        >
          −
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setZoom(1); setTranslate({ x: 0, y: 0 }); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center text-sm shadow-sm"
          title="重置"
        >
          ⤢
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); expandAll(); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center text-sm shadow-sm"
          title="展开全部"
        >
          ☰
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); collapseAll(); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center text-sm shadow-sm"
          title="折叠全部"
        >
          ⊟
        </button>
      </div>

      {/* 脑图内容 */}
      <div
        className="p-6 sm:p-10 transition-transform origin-center"
        style={{
          transform: `scale(${zoom}) translate(${translate.x}px, ${translate.y}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease',
        }}
      >
        <div className="flex items-start gap-6 min-w-max">
          <div className="flex-none px-5 py-3 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-white text-sm font-semibold shadow-lg">
            {title.length > 20 ? title.slice(0, 20) + '…' : title}
          </div>
          <div className="flex flex-col gap-3 border-l-2 border-orange-200 pl-6">
            {outline.map((node, i) => renderBranch(node, 0, 'root', i))}
          </div>
        </div>
      </div>

      {/* 缩放指示 */}
      <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-white/80 border border-slate-200 text-xs text-slate-500">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}

/* ==================== Markdown 视图 ==================== */

function MarkdownView({ markdown }: { markdown: string }) {
  const html = markdown
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-slate-100 text-orange-700 text-xs rounded font-mono">$1</code>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="my-6 border-0 h-px bg-gradient-to-r from-transparent via-orange-200 to-transparent" />')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="pl-3 border-l-3 border-orange-300 bg-orange-50/50 rounded-r-lg py-1.5 my-2"><p class="text-sm text-slate-600 italic">$1</p></blockquote>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="mt-5 mb-2 text-lg font-semibold text-slate-900">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="mt-6 mb-3 text-xl font-bold text-slate-900">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="mb-4 text-2xl font-bold text-slate-900">$1</h1>')
    // Tables
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        return ''; // separator row
      }
      const isHeader = /^\|?\s*项目\s*\|/.test(match);
      const tag = isHeader ? 'th' : 'td';
      const classAttr = isHeader
        ? 'class="px-3 py-2 bg-orange-50 font-semibold text-slate-800 border border-slate-200"'
        : 'class="px-3 py-2 text-slate-700 border border-slate-200"';
      const row = cells.map((c) => `<${tag} ${classAttr}>${c}</${tag}>`).join('');
      return `<tr>${row}</tr>`;
    })
    .replace(/(<tr>[\s\S]*?<\/tr>)(?!\s*<tr)/g, '<table class="w-full text-sm border-collapse mb-4">$1</table>')
    // Lists
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-5 list-decimal text-slate-700 leading-relaxed">$2</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-5 list-disc text-slate-700 leading-relaxed">$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '<div class="h-3"></div>')
    .replace(/(<li[^>]*>[\s\S]*?<\/li>)(?![\s\S]*?<li)/, '$1');
  const listWrapped = html.replace(/(<li[\s\S]*?<\/li>)(?!\s*<li)/g, '<ul class="space-y-1.5 my-2">$1</ul>');
  return (
    <div
      className="rounded-2xl border border-orange-100 bg-white p-6 sm:p-8 prose-sm"
      dangerouslySetInnerHTML={{ __html: listWrapped }}
    />
  );
}

/* ==================== 原文视图 ==================== */

function OriginalTextView({ note }: { note: PublicNote }) {
  if (!note.originalText) {
    return (
      <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center">
        <div className="text-3xl mb-2">📄</div>
        <p className="text-slate-500 text-sm">暂无原文内容</p>
        <p className="text-slate-400 text-xs mt-1">原文内容仅对 AI 生成的笔记可用</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-orange-100 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-orange-50 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">📄 原文内容</span>
        <span className="text-xs text-slate-400">{note.category} · {note.duration}</span>
      </div>
      <div className="p-5 sm:p-6 max-h-[600px] overflow-y-auto">
        <pre
          className="text-sm text-slate-600 whitespace-pre-wrap font-mono leading-relaxed"
        >
          {note.originalText}
        </pre>
      </div>
    </div>
  );
}

/* ==================== AI 问答面板 ==================== */

function AskPanel({ noteId }: { noteId: string }) {
  const [q, setQ] = useState('');
  const [chat, setChat] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([]);
  const [asking, setAsking] = useState(false);

  const ask = async () => {
    const question = q.trim();
    if (!question || asking) return;
    setChat((c) => [...c, { role: 'user', text: question }]);
    setQ('');
    setAsking(true);
    try {
      const answer = await askAI(noteId, question);
      setChat((c) => [...c, { role: 'ai', text: answer }]);
    } catch {
      setChat((c) => [...c, { role: 'ai', text: '抱歉，AI 问答暂时不可用，请稍后重试。' }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <span>💬</span>
        <span>问 AI 关于这篇笔记</span>
      </h3>
      {chat.length > 0 && (
        <div className="mb-4 space-y-3 max-h-64 overflow-y-auto">
          {chat.map((m, i) => (
            <div
              key={i}
              className={`text-sm rounded-xl px-4 py-2.5 max-w-[85%] ${
                m.role === 'user'
                  ? 'ml-auto bg-gradient-to-r from-orange-500 to-rose-500 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="例如：这篇笔记的核心结论是什么？"
          className="flex-1 px-4 py-2.5 bg-orange-50/50 border border-orange-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 placeholder-slate-400"
        />
        <button
          onClick={ask}
          disabled={asking}
          className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm hover:from-orange-600 hover:to-rose-600 transition-all shadow-sm disabled:opacity-50"
        >
          {asking ? '思考中…' : '提问'}
        </button>
      </div>
    </div>
  );
}
