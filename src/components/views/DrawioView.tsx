import { useState, useEffect } from 'react';
import { getDrawio } from '../../lib/api';

interface DrawioViewProps {
  noteId: string;
  noteTitle: string;
}

type DiagramType = 'mindmap' | 'framework' | 'knowledge-graph' | 'combined';

const DIAGRAM_LABELS: Record<DiagramType, string> = {
  mindmap: '思维导图',
  framework: '结构框架图',
  'knowledge-graph': '知识图谱图',
  combined: '综合图表',
};

export default function DrawioView({ noteId, noteTitle }: DrawioViewProps) {
  const [xml, setXml] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showXml, setShowXml] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getDrawio(noteId);
        setXml(data);
        setLoaded(true);
      } catch {
        setXml('');
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [noteId]);

  const handleDownload = () => {
    if (!xml) return;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${noteTitle?.slice(0, 20) || '笔记'}-图表.drawio`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyXml = async () => {
    if (!xml) return;
    try {
      await navigator.clipboard.writeText(xml);
      alert('XML 已复制到剪贴板');
    } catch {
      alert('复制失败');
    }
  };

  const renderDiagramPreview = () => {
    if (!xml) return null;

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const cells = doc.querySelectorAll('mxCell');
    const nodes: Array<{ x: number; y: number; w: number; h: number; value: string; style: string }> = [];
    const edges: Array<{ sourceX: number; sourceY: number; targetX: number; targetY: number }> = [];

    const nodeMap = new Map<string, { x: number; y: number; w: number; h: number }>();

    cells.forEach((cell) => {
      const parent = cell.getAttribute('parent');
      if (!parent) return;
      const style = cell.getAttribute('style') || '';
      const value = cell.getAttribute('value') || '';
      const geometry = cell.querySelector('mxGeometry');

      if (!geometry) return;

      const x = parseFloat(geometry.getAttribute('x') || '0');
      const y = parseFloat(geometry.getAttribute('y') || '0');
      const w = parseFloat(geometry.getAttribute('width') || '100');
      const h = parseFloat(geometry.getAttribute('height') || '40');

      if (style.includes('edgeStyle') || style.includes('orthogonalEdge')) {
        const source = cell.getAttribute('source');
        const target = cell.getAttribute('target');
        if (source && target && nodeMap.has(source) && nodeMap.has(target)) {
          const src = nodeMap.get(source)!;
          const tgt = nodeMap.get(target)!;
          edges.push({
            sourceX: src.x + src.w / 2,
            sourceY: src.y + src.h / 2,
            targetX: tgt.x + tgt.w / 2,
            targetY: tgt.y + tgt.h / 2,
          });
        }
        return;
      }

      if (!value) return;
      const id = cell.getAttribute('id') || '';
      nodeMap.set(id, { x, y, w, h });
      nodes.push({ x, y, w, h, value, style });
    });

    if (nodes.length === 0) return null;

    const padding = 30;
    const minX = Math.min(...nodes.map(n => n.x)) - padding;
    const minY = Math.min(...nodes.map(n => n.y)) - padding;
    const maxX = Math.max(...nodes.map(n => n.x + n.w)) + padding;
    const maxY = Math.max(...nodes.map(n => n.y + n.h)) + padding;
    const totalW = maxX - minX;
    const totalH = maxY - minY;

    const isCenterStyle = (s: string) => s.includes('gradient') || s.includes('fromOrange') || s.includes('#F97316');
    const isBranchStyle = (s: string) => s.includes('#FFF7ED') || s.includes('fillColor=#FFF7ED');
    const isKgNode = (s: string) => s.includes('ellipse') || s.includes('#8B5CF6');

    const getFillColor = (s: string): string => {
      if (isCenterStyle(s)) return '#F97316';
      if (isKgNode(s)) return '#8B5CF6';
      if (isBranchStyle(s)) return '#FFF7ED';
      return '#FFFFFF';
    };

    const getStrokeColor = (s: string): string => {
      if (isCenterStyle(s)) return '#EA580C';
      if (isKgNode(s)) return '#7C3AED';
      if (isBranchStyle(s)) return '#FDBA74';
      return '#E2E8F0';
    };

    const getTextFill = (s: string): string => {
      if (isCenterStyle(s) || isKgNode(s)) return 'white';
      return '#1E293B';
    };

    return (
      <svg
        viewBox={`${minX} ${minY} ${totalW} ${totalH}`}
        className="w-full"
        style={{ maxHeight: 400, maxWidth: '100%' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x={minX} y={minY} width={totalW} height={totalH} fill="transparent" />

        {edges.map((e, i) => (
          <line
            key={`edge-${i}`}
            x1={e.sourceX}
            y1={e.sourceY}
            x2={e.targetX}
            y2={e.targetY}
            stroke="#F97316"
            strokeWidth={1.5}
            opacity={0.6}
          />
        ))}

        {nodes.map((n, i) => {
          const cx = n.x + n.w / 2;
          const cy = n.y + n.h / 2;
          const fill = getFillColor(n.style);
          const stroke = getStrokeColor(n.style);
          const textFill = getTextFill(n.style);
          const isEllipse = isKgNode(n.style);
          const isCenter = isCenterStyle(n.style);
          const fontSize = isCenter ? 14 : 12;
          const displayValue = n.value.length > 25 ? n.value.slice(0, 25) + '…' : n.value;
          const lines = displayValue.split('\n');

          return (
            <g key={`node-${i}`}>
              {isEllipse ? (
                <ellipse cx={cx} cy={cy} rx={n.w / 2} ry={n.h / 2} fill={fill} stroke={stroke} strokeWidth={2} />
              ) : (
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10} fill={fill} stroke={stroke} strokeWidth={1.5} />
              )}
              {lines.map((line, li) => (
                <text
                  key={li}
                  x={cx}
                  y={cy + (li - (lines.length - 1) / 2) * (fontSize + 4)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fontWeight={isCenter || isKgNode(n.style) ? 600 : 400}
                  fill={textFill}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-orange-100 bg-white p-12 text-center">
        <div className="inline-block w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-slate-500">正在加载图表</p>
      </div>
    );
  }

  if (!xml) {
    return (
      <div className="rounded-2xl border border-orange-100 bg-white p-12 text-center">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-slate-500 text-sm">暂无 Drawio 图表数据</p>
        <p className="text-slate-400 text-xs mt-1">AI 生成的笔记会包含可导出的 Drawio 图表</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-orange-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-orange-50 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">📊 Drawio 图表</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowXml(!showXml)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-xs"
          >
            {showXml ? '隐藏 XML' : '查看 XML'}
          </button>
          <button
            onClick={handleCopyXml}
            className="px-3 py-1.5 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors text-xs"
          >
            复制 XML
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs hover:from-orange-600 hover:to-rose-600 transition-all shadow-sm"
          >
            下载 .drawio
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="p-5 sm:p-6">
        <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50/30 to-white p-4 mb-4">
          <div className="flex items-center justify-center">
            {renderDiagramPreview()}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span>📄</span> 思维导图
          </span>
          <span className="flex items-center gap-1">
            <span>🏗</span> 结构框架图
          </span>
          <span className="flex items-center gap-1">
            <span>🔗</span> 知识图谱图
          </span>
          <span className="flex items-center gap-1">
            <span>📋</span> 综合图表
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          下载后可用 Draw.io 或 diagrams.net 打开编辑
        </p>
      </div>

      {showXml && (
        <div className="px-5 py-4 border-t border-orange-50">
          <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto bg-slate-50 rounded-lg p-4">
            {xml}
          </pre>
        </div>
      )}
    </div>
  );
}
