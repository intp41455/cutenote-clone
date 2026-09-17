import type { OutlineNode, KnowledgeGraph } from '../types';

// ── Drawio XML Helpers ───────────────────────────────────────────

interface CellData {
  id: number;
  value: string;
  style: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parent?: number;
  source?: number;
  target?: number;
  edge?: boolean;
  vertex?: boolean;
  connectable?: boolean;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function nodeCell(
  id: number,
  value: string,
  style: string,
  x: number,
  y: number,
  width = 160,
  height = 40,
  parent = 0
): CellData {
  return {
    id,
    value: escapeXml(value),
    style,
    x,
    y,
    width,
    height,
    parent,
    vertex: true,
    connectable: true,
  };
}

function edgeCell(
  id: number,
  style: string,
  source: number,
  target: number,
  parent = 0
): CellData {
  return {
    id,
    value: '',
    style,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    parent,
    source,
    target,
    edge: true,
  };
}

function cellToXml(cell: CellData, indent = '    '): string {
  const attrs: string[] = [`id="${cell.id}"`];
  if (cell.vertex) attrs.push('vertex="1"');
  if (cell.edge) attrs.push('edge="1"');
  if (cell.connectable !== undefined) attrs.push(`connectable="${cell.connectable}"`);
  if (cell.source) attrs.push(`source="${cell.source}"`);
  if (cell.target) attrs.push(`target="${cell.target}"`);
  attrs.push(`parent="${cell.parent || 0}"`);

  return `${indent}<mxCell ${attrs.join(' ')} value="${cell.value}">
${indent}  <mxGeometry x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}" as="geometry" />
${indent}</mxCell>`;
}

function wrapInDrawio(cells: CellData[]): string {
  const mxGraphModel = cells.map(c => cellToXml(c)).join('\n');

  return `<mxfile host="CuteNote">
  <diagram id="cutenote-diagram" name="笔记结构图">
    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="800" pageHeight="600" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
${mxGraphModel}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

// ── Style Definitions ────────────────────────────────────────────

const STYLE_CENTER = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#F97316;fontColor=#FFFFFF;strokeColor=#EA580C;fontSize=14;fontStyle=1;';
const STYLE_BRANCH = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF7ED;fontColor=#1E293B;strokeColor=#FDBA74;fontSize=12;';
const STYLE_CHILD = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;fontColor=#374151;strokeColor=#E5E7EB;fontSize=11;';
const STYLE_EDGE = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;strokeColor=#FDBA74;strokeWidth=2;';
const STYLE_KG_NODE = 'ellipse;whiteSpace=wrap;html=1;fillColor=#EEF2FF;fontColor=#374151;strokeColor=#6366F1;fontSize=11;fontStyle=1;';
const STYLE_KG_EDGE = 'edgeStyle=orthogonalEdgeStyle;rounded=0;strokeColor=#94A3B8;strokeWidth=1;dashed=1;';

// ── Mind Map Generator ───────────────────────────────────────────

export function generateMindMap(title: string, outline: OutlineNode[]): string {
  const cells: CellData[] = [];
  let idCounter = 2;

  // Center node
  cells.push(nodeCell(idCounter++, title, STYLE_CENTER, 300, 280, 180, 50));
  const centerId = idCounter - 1;

  // Branches
  const branchCount = outline.length;
  const startY = Math.max(50, 300 - (branchCount * 70) / 2);

  outline.forEach((branch, i) => {
    const branchId = idCounter++;
    const y = startY + i * 70;

    cells.push(nodeCell(branchId, branch.title, STYLE_BRANCH, 530, y, 180, 40));
    cells.push(edgeCell(idCounter++, STYLE_EDGE, centerId, branchId));

    // Children
    if (branch.children && branch.children.length > 0) {
      const childStartY = y - (branch.children.length * 30) / 2 + 5;
      branch.children.forEach((child, ci) => {
        const childId = idCounter++;
        const childY = childStartY + ci * 30;

        cells.push(nodeCell(childId, child.title, STYLE_CHILD, 760, childY, 150, 28));
        cells.push(edgeCell(idCounter++, STYLE_EDGE, branchId, childId));
      });
    }
  });

  return wrapInDrawio(cells);
}

// ── Structural Framework Diagram ─────────────────────────────────

export function generateFrameworkDiagram(title: string, outline: OutlineNode[]): string {
  const cells: CellData[] = [];
  let idCounter = 2;

  // Title node at top
  cells.push(nodeCell(idCounter++, title, 'rounded=0;whiteSpace=wrap;html=1;fillColor=#F97316;fontColor=#FFFFFF;strokeColor=#EA580C;fontSize=16;fontStyle=1;', 250, 20, 300, 50));
  const titleId = idCounter - 1;

  // Main sections in a row
  const sectionCount = outline.length;
  const sectionWidth = 140;
  const totalWidth = sectionCount * (sectionWidth + 20);
  const startX = Math.max(20, (800 - totalWidth) / 2);

  outline.forEach((section, i) => {
    const sectionId = idCounter++;
    const x = startX + i * (sectionWidth + 20);

    cells.push(nodeCell(sectionId, section.title, STYLE_BRANCH, x, 120, sectionWidth, 50));
    cells.push(edgeCell(idCounter++, STYLE_EDGE, titleId, sectionId));

    // Sub-items below each section
    if (section.content) {
      // Split content into sentences for sub-items
      const sentences = section.content.split(/[。！？.!?]/).filter(s => s.trim().length > 5).slice(0, 3);
      sentences.forEach((sentence, si) => {
        const subId = idCounter++;
        const shortText = sentence.trim().slice(0, 30) + (sentence.trim().length > 30 ? '...' : '');
        cells.push(nodeCell(subId, shortText, STYLE_CHILD, x - 10, 200 + si * 35, sectionWidth + 20, 28));
        cells.push(edgeCell(idCounter++, STYLE_EDGE, sectionId, subId));
      });
    }
  });

  return wrapInDrawio(cells);
}

// ── Knowledge Graph Diagram ──────────────────────────────────────

export function generateKnowledgeGraphDiagram(graph: KnowledgeGraph): string {
  const cells: CellData[] = [];
  let idCounter = 2;

  // Simple force-directed layout approximation
  const nodes = graph.nodes;
  const positions = new Map<string, { x: number; y: number }>();

  // Place nodes in a circle if few, or use basic layout
  const centerX = 400;
  const centerY = 300;
  const radius = Math.max(100, Math.min(250, 80 + nodes.length * 15));

  nodes.forEach((node, i) => {
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius - 45;
    const y = centerY + Math.sin(angle) * radius - 20;
    positions.set(node.id, { x, y });
    cells.push(nodeCell(idCounter++, node.label, STYLE_KG_NODE, x, y, 90, 40));
  });

  // Shift IDs to match the cell IDs (cells start at 2)
  const nodeIdMap = new Map<string, number>();
  let cellId = 2;
  nodes.forEach(node => {
    nodeIdMap.set(node.id, cellId);
    cellId++;
  });

  // Add edges
  graph.edges.forEach(edge => {
    const sourceId = nodeIdMap.get(edge.source);
    const targetId = nodeIdMap.get(edge.target);
    if (sourceId && targetId) {
      cells.push(edgeCell(idCounter++, STYLE_KG_EDGE, sourceId, targetId));
    }
  });

  return wrapInDrawio(cells);
}

// ── Combined Diagram ─────────────────────────────────────────────

export function generateCombinedDiagram(
  title: string,
  outline: OutlineNode[],
  knowledgeGraph?: KnowledgeGraph
): string {
  const cells: CellData[] = [];
  let idCounter = 2;

  // Part 1: Framework diagram (left side)
  cells.push(nodeCell(idCounter++, '结构框架', 'text;html=1;fontSize=14;fontStyle=1;fontColor=#F97316;', 20, 20, 100, 30));
  const frameTitle = nodeCell(idCounter++, title, STYLE_CENTER, 80, 60, 200, 40);
  cells.push(frameTitle);

  outline.forEach((section, i) => {
    const sectionId = idCounter++;
    const y = 130 + i * 50;
    cells.push(nodeCell(sectionId, section.title, STYLE_BRANCH, 80, y, 200, 36));
    cells.push(edgeCell(idCounter++, STYLE_EDGE, frameTitle.id, sectionId));
  });

  // Part 2: Knowledge Graph (right side) - if available
  if (knowledgeGraph && knowledgeGraph.nodes.length > 0) {
    cells.push(nodeCell(idCounter++, '知识图谱', 'text;html=1;fontSize=14;fontStyle=1;fontColor=#6366F1;', 420, 20, 100, 30));

    const kgNodes = knowledgeGraph.nodes.slice(0, 10);
    const kgStartX = 440;
    const kgStartY = 60;

    kgNodes.forEach((node, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = kgStartX + col * 110;
      const y = kgStartY + row * 55;
      cells.push(nodeCell(idCounter++, node.label, STYLE_KG_NODE, x, y, 95, 36));
    });
  }

  return wrapInDrawio(cells);
}
