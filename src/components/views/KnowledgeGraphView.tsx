import { useState, useEffect, useRef, useCallback } from 'react';
import type { KnowledgeGraph, KnowledgeGraphNode, KnowledgeGraphEdge } from '../../lib/api';

interface KnowledgeGraphViewProps {
  graph: KnowledgeGraph | undefined;
  noteId: string;
  loading?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  entity: '#F97316',
  concept: '#8B5CF6',
  person: '#3B82F6',
  organization: '#10B981',
  location: '#EF4444',
  event: '#F59E0B',
};

const TYPE_LABELS: Record<string, string> = {
  entity: '实体',
  concept: '概念',
  person: '人物',
  organization: '组织',
  location: '地点',
  event: '事件',
};

function getNodeColor(type: string): string {
  return TYPE_COLORS[type] ?? '#F97316';
}

interface SimNode extends KnowledgeGraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;
}

interface SimEdge extends KnowledgeGraphEdge {
  sourceNode?: SimNode;
  targetNode?: SimNode;
}

function simulateGraph(nodes: SimNode[], edges: SimEdge[], width: number, height: number, iterations: number = 300): void {
  const cx = width / 2;
  const cy = height / 2;

  for (let i = 0; i < nodes.length; i++) {
    nodes[i].x = cx + Math.cos((2 * Math.PI * i) / nodes.length) * Math.min(width, height) * 0.35;
    nodes[i].y = cy + Math.sin((2 * Math.PI * i) / nodes.length) * Math.min(width, height) * 0.35;
  }

  const repulsion = 8000;
  const attraction = 0.01;
  const centerGravity = 0.005;
  const damping = 0.9;

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  for (const edge of edges) {
    edge.sourceNode = nodeMap.get(edge.source);
    edge.targetNode = nodeMap.get(edge.target);
  }

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1 - iter / iterations;

    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].fixed) continue;
      let fx = 0;
      let fy = 0;

      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.max(20, Math.sqrt(dx * dx + dy * dy));
        const force = repulsion / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      fx += (cx - nodes[i].x) * centerGravity;
      fy += (cy - nodes[i].y) * centerGravity;

      nodes[i].vx = (nodes[i].vx + fx) * damping;
      nodes[i].vy = (nodes[i].vy + fy) * damping;
    }

    for (const edge of edges) {
      if (!edge.sourceNode || !edge.targetNode) continue;
      const dx = edge.targetNode.x - edge.sourceNode.x;
      const dy = edge.targetNode.y - edge.sourceNode.y;
      const dist = Math.max(20, Math.sqrt(dx * dx + dy * dy));
      const targetDist = 150;
      const force = (dist - targetDist) * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (!edge.sourceNode.fixed) {
        edge.sourceNode.vx += fx;
        edge.sourceNode.vy += fy;
      }
      if (!edge.targetNode.fixed) {
        edge.targetNode.vx -= fx;
        edge.targetNode.vy -= fy;
      }
    }

    for (const node of nodes) {
      if (node.fixed) continue;
      node.x += node.vx * temp;
      node.y += node.vy * temp;
      node.x = Math.max(40, Math.min(width - 40, node.x));
      node.y = Math.max(40, Math.min(height - 40, node.y));
    }
  }
}

export default function KnowledgeGraphView({ graph, noteId, loading }: KnowledgeGraphViewProps) {
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [edges, setEdges] = useState<SimEdge[]>([]);
  const [zoom, setZoom] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(500);

  useEffect(() => {
    const container = svgRef.current?.parentElement;
    if (container) {
      setWidth(container.clientWidth || 800);
      setHeight(500);
    }
  }, []);

  useEffect(() => {
    if (!graph || loading) return;
    const simNodes: SimNode[] = graph.nodes.map(n => ({
      ...n,
      x: 0, y: 0, vx: 0, vy: 0, fixed: false,
    }));
    const simEdges: SimEdge[] = graph.edges.map(e => ({ ...e }));

    simulateGraph(simNodes, simEdges, width, height);
    setNodes(simNodes);
    setEdges(simEdges);
  }, [graph, loading, width, height]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (draggingNode) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  }, [draggingNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingNode) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom - translate.x;
      const y = (e.clientY - rect.top) / zoom - translate.y;
      setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x, y, fixed: true } : n));
      return;
    }
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setTranslate({ x: translate.x + dx, y: translate.y + dy });
    dragStart.current = { x: e.clientX, y: e.clientY };
  }, [dragging, draggingNode, translate, zoom]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    setDraggingNode(null);
  }, []);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggingNode(nodeId);
    setSelectedNode(nodes.find(n => n.id === nodeId) ?? null);
  }, [nodes]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const fmtScore = (s: number) => (s * 100).toFixed(1);

  if (loading) {
    return (
      <div className="rounded-2xl border border-orange-100 bg-white p-12 text-center">
        <div className="inline-block w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-slate-500">正在加载知识图谱</p>
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="rounded-2xl border border-orange-100 bg-white p-12 text-center">
        <div className="text-4xl mb-3">🔗</div>
        <p className="text-slate-500 text-sm">暂无知识图谱数据</p>
        <p className="text-slate-400 text-xs mt-1">该笔记是手动创建的，AI 生成的笔记会包含知识图谱</p>
      </div>
    );
  }

  const relatedEdges = selectedNode
    ? edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
    : [];

  const connectedNodes = selectedNode
    ? edges
        .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
        .map(e => e.source === selectedNode.id ? e.target : e.source)
    : [];

  return (
    <div className="rounded-2xl border border-orange-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-orange-50 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">🔗 知识图谱</span>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{graph.nodes.length} 个节点</span>
          <span>·</span>
          <span>{graph.edges.length} 条关系</span>
        </div>
      </div>

      {/* Legend */}
      <div className="px-5 py-2 border-b border-orange-50 flex flex-wrap gap-3">
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[key] }} />
            {label}
          </span>
        ))}
      </div>

      {/* SVG Canvas */}
      <div
        className="relative overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ height: 500 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          onClick={handleBackgroundClick}
          style={{ cursor: draggingNode ? 'grabbing' : undefined }}
        >
          <g transform={`translate(${translate.x}, ${translate.y}) scale(${zoom})`}>
            {/* Edges */}
            {edges.map((edge, i) => {
              if (!edge.sourceNode || !edge.targetNode) return null;
              const highlight = selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id);
              return (
                <g key={i}>
                  <line
                    x1={edge.sourceNode.x}
                    y1={edge.sourceNode.y}
                    x2={edge.targetNode.x}
                    y2={edge.targetNode.y}
                    stroke={highlight ? '#F97316' : '#E2E8F0'}
                    strokeWidth={highlight ? 2 : 1}
                  />
                  <text
                    x={(edge.sourceNode.x + edge.targetNode.x) / 2}
                    y={(edge.sourceNode.y + edge.targetNode.y) / 2}
                    textAnchor="middle"
                    fontSize="9"
                    fill={highlight ? '#F97316' : '#94A3B8'}
                    fontWeight={highlight ? '600' : 'normal'}
                  >
                    {edge.relationship}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const dimmed = selectedNode && node.id !== selectedNode.id && !connectedNodes.includes(node.id);
              const opacity = dimmed ? 0.25 : 1;
              const isSelected = selectedNode?.id === node.id;
              return (
                <g
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  style={{ cursor: 'pointer', opacity }}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isSelected ? 28 : 24}
                    fill={getNodeColor(node.type)}
                    stroke={isSelected ? '#1E293B' : 'white'}
                    strokeWidth={isSelected ? 3 : 2}
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
                  />
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill="white"
                    fontWeight="600"
                  >
                    {node.label.length > 8 ? node.label.slice(0, 8) + '…' : node.label}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 38}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#64748B"
                  >
                    {TYPE_LABELS[node.type] ?? node.type}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(2, z + 0.2)); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center text-lg font-bold shadow-sm"
            title="放大"
          >
            +
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.4, z - 0.2)); }}
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
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-white/80 border border-slate-200 text-xs text-slate-500">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Selected node detail */}
      {selectedNode && (
        <div className="px-5 py-4 border-t border-orange-50 bg-orange-50/30">
          <div className="flex items-start gap-3">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-none"
              style={{ backgroundColor: getNodeColor(selectedNode.type) }}
            >
              {TYPE_LABELS[selectedNode.type]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-800 text-sm">{selectedNode.label}</div>
              {selectedNode.description && (
                <p className="mt-1 text-sm text-slate-500 leading-relaxed">{selectedNode.description}</p>
              )}
              {relatedEdges.length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="text-xs text-slate-400">关联关系:</span>
                  {relatedEdges.map((e, i) => {
                    const otherNodeId = e.source === selectedNode.id ? e.target : e.source;
                    const otherNode = nodes.find(n => n.id === otherNodeId);
                    return (
                      <div key={i} className="text-xs text-slate-500 flex items-center gap-1">
                        <span>↔</span>
                        <span>{otherNode?.label ?? otherNodeId}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-orange-600">{e.relationship}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
