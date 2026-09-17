import { chatCompletion, isConfigured } from './aiClient';
import type { KnowledgeGraph, KnowledgeGraphNode, KnowledgeGraphEdge, WikiReference } from '../types';

const ENTITY_TYPES = ['entity', 'concept', 'person', 'organization', 'location', 'event'] as const;

const TYPE_COLORS: Record<string, string> = {
  entity: '#6366f1',
  concept: '#06b6d4',
  person: '#f59e0b',
  organization: '#10b981',
  location: '#8b5cf6',
  event: '#ef4444',
};

function classifyEntity(text: string): KnowledgeGraphNode['type'] {
  const t = text.toLowerCase();
  if (/公司|集团|企业|组织|协会|大学|学院|学校|bank|corp|inc|co\.|ltd/i.test(text)) return 'organization';
  if (/博士|教授|医生|研究员|院士|博士|先生|女士/i.test(text)) return 'person';
  if (/省|市|区|县|国|地区|省|州|市|country|city|state|province/i.test(text)) return 'location';
  if (/年|月|日|日|事件|运动|战争|会议|大会|峰会|会议|conference|war|event/i.test(text)) return 'event';
  if (/技术|算法|协议|标准|理论|模型|系统|方法|理论|method|theory|algorithm/i.test(text)) return 'concept';
  return 'entity';
}

// ── AI-based extraction ──────────────────────────────────────────

async function extractWithAI(text: string): Promise<KnowledgeGraph> {
  if (!isConfigured()) return extractWithRules(text);

  const prompt = `你是一个知识图谱提取专家。请分析以下文本，提取实体和关系。

文本内容：
${text.slice(0, 3000)}

请返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "nodes": [
    {"label": "实体名", "type": "entity|concept|person|organization|location|event", "description": "简短描述"}
  ],
  "edges": [
    {"source": "源实体名", "target": "目标实体名", "relationship": "关系描述", "weight": 0.5到1.0之间的数值}
  ]
}`;

  try {
    const result = await chatCompletion([
      { role: 'system', content: '你是知识图谱提取专家，只返回 JSON 数据，不要有任何其他文字。' },
      { role: 'user', content: prompt },
    ]);

    if (!result) return extractWithRules(text);

    // Parse JSON from response (handle possible markdown wrapping)
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return extractWithRules(text);

    const parsed = JSON.parse(jsonMatch[0]);

    const nodes: KnowledgeGraphNode[] = (parsed.nodes || []).map((n: any, i: number) => ({
      id: `node-${i}`,
      label: n.label || `节点${i}`,
      type: ENTITY_TYPES.includes(n.type) ? n.type : classifyEntity(n.label || ''),
      description: n.description || '',
    }));

    const edges: KnowledgeGraphEdge[] = (parsed.edges || []).map((e: any) => ({
      source: findNodeId(nodes, e.source),
      target: findNodeId(nodes, e.target),
      relationship: e.relationship || '相关',
      weight: typeof e.weight === 'number' ? e.weight : 0.5,
    }));

    return { nodes, edges };
  } catch (err) {
    console.error('[knowledgeGraph] AI extraction failed:', err);
    return extractWithRules(text);
  }
}

function findNodeId(nodes: KnowledgeGraphNode[], label: string): string {
  const node = nodes.find(n => n.label === label);
  return node ? node.id : `node-external-${label}`;
}

// ── Rule-based extraction (fallback) ────────────────────────────

function extractWithRules(text: string): KnowledgeGraph {
  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];
  const seenLabels = new Set<string>();

  // Extract Chinese entities (noun-like sequences)
  const chinesePattern = /[一-鿿]{2,6}/g;
  const matches = text.match(chinesePattern) || [];

  // Filter by frequency and relevance
  const freq = new Map<string, number>();
  for (const m of matches) {
    if (m.length < 2) continue;
    freq.set(m, (freq.get(m) || 0) + 1);
  }

  // Take top entities by frequency
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const topEntities = sorted.slice(0, 15);

  for (const [label, freq_count] of topEntities) {
    if (seenLabels.has(label)) continue;
    seenLabels.add(label);

    const id = `node-${nodes.length}`;
    const type = classifyEntity(label);
    const description = `${label} - 在文本中出现${freq_count}次`;

    nodes.push({ id, label, type, description });

    // Create connections to other entities that appear nearby
    if (nodes.length > 1) {
      // Connect to the entity that appears most frequently nearby
      const idx = text.indexOf(label);
      if (idx >= 0) {
        const context = text.slice(Math.max(0, idx - 50), idx + 50 + label.length);
        for (let j = 0; j < nodes.length - 1; j++) {
          if (j === nodes.length - 1) continue;
          if (context.includes(nodes[j].label) && nodes[j].label !== label) {
            edges.push({
              source: id,
              target: nodes[j].id,
              relationship: '相关',
              weight: Math.min(0.3 + (freq_count / 20), 1.0),
            });
            break;
          }
        }
      }
    }
  }

  // Create a hierarchical structure from the first few entities
  if (nodes.length >= 3) {
    // Create a chain of relationships
    for (let i = 1; i < Math.min(nodes.length, 8); i++) {
      edges.push({
        source: nodes[i - 1].id,
        target: nodes[i].id,
        relationship: '关联',
        weight: 0.6 + Math.random() * 0.4,
      });
    }
  }

  return { nodes, edges };
}

// ── Entity linking with Wikipedia ────────────────────────────────

export function linkEntitiesToWiki(graph: KnowledgeGraph, wikiRefs: WikiReference[]): KnowledgeGraph {
  const linkedNodes = graph.nodes.map(node => {
    const match = wikiRefs.find(r =>
      r.title.includes(node.label) || node.label.includes(r.title)
    );
    if (match) {
      return {
        ...node,
        description: node.description || `${match.title}: ${match.summary.slice(0, 100)}`,
      };
    }
    return node;
  });

  return { nodes: linkedNodes, edges: graph.edges };
}

// ── Main entry point ─────────────────────────────────────────────

export async function extractKnowledgeGraph(
  text: string,
  wikiRefs?: WikiReference[]
): Promise<KnowledgeGraph> {
  let graph: KnowledgeGraph;

  if (isConfigured()) {
    graph = await extractWithAI(text);
  } else {
    graph = extractWithRules(text);
  }

  if (wikiRefs && wikiRefs.length > 0) {
    graph = linkEntitiesToWiki(graph, wikiRefs);
  }

  return graph;
}

export { TYPE_COLORS };
