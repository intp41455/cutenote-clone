import { chatCompletion, isConfigured } from './aiClient';
import { extractContent, detectPlatform, chunkText, extractKeywords, countWords, countParagraphs } from './contentExtractor';
import { searchWiki } from './wikiSearch';
import { vectorStore } from './vectorStore';
import { extractKnowledgeGraph } from './knowledgeGraph';
import { generateMindMap, generateFrameworkDiagram, generateKnowledgeGraphDiagram, generateCombinedDiagram } from './drawioGenerator';
import type { Note, OutlineNode, ContentAnalysis, OutputFormat } from '../types';

export interface ProgressUpdate {
  progress: number;
  stage: string;
}

export interface AnalysisResult {
  title: string;
  summary: string;
  outline: OutlineNode[];
  markdown: string;
  category: string;
  tags: string[];
  duration: string;
  originalUrl: string;
  originalText: string;
  platform: string;
  source: Note['source'];
  knowledgeGraph?: Note['knowledgeGraph'];
  vectorChunks?: Note['vectorChunks'];
  drawioXml?: string;
  wikiReferences?: Note['wikiReferences'];
  analysis?: ContentAnalysis;
}

// ── Category Detection ───────────────────────────────────────────

export function detectCategory(text: string): string {
  const t = text.toLowerCase();
  if (/ai|人工智能|机器学习|深度学习|llm|大模型|chatgpt|gpt|transformer|神经网络/.test(t)) return 'ai';
  if (/健康|饮食|营养|运动|减肥|医疗|疾病|阿尔茨海默|糖尿病|血压/.test(t)) return 'health';
  if (/编程|代码|python|java|javascript|typescript|react|vue|前端|后端|算法|数据结构|开发/.test(t)) return 'programming';
  if (/金融|股票|投资|基金|理财|经济|市场|资产|股价|涨停|跌停/.test(t)) return 'finance';
  if (/教育|学习|考试|考研|高考|英语|数学|物理|化学|课程|教学/.test(t)) return 'education';
  return 'general';
}

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI',
  health: '健康知识',
  programming: '编程',
  finance: '金融',
  education: '教育',
  general: '综合',
};

const CATEGORY_TAGS: Record<string, string[]> = {
  ai: ['人工智能', '机器学习', '大模型', '深度学习', 'AI应用', '技术前沿'],
  health: ['健康管理', '饮食营养', '疾病预防', '运动健康', '认知健康', '养生保健'],
  programming: ['编程开发', '算法设计', '前端开发', '后端开发', '系统架构', '工程实践'],
  finance: ['投资分析', '市场研究', '资产配置', '风险管理', '财务规划', '经济指标'],
  education: ['学习方法', '考试备考', '课程学习', '知识管理', '教育规划', '技能提升'],
  general: ['知识整理', '学习笔记', '内容分析', '信息提取', '总结归纳', '参考资料'],
};

// ── Note Generation with AI ──────────────────────────────────────

async function generateWithAI(
  extracted: { title: string; text: string; description?: string; url?: string },
  keywords: string[],
  wikiSummary: string,
  format: OutputFormat
): Promise<Partial<AnalysisResult>> {
  if (!isConfigured()) return {};

  const wikiContext = wikiSummary ? `\n\n参考知识库补充信息：\n${wikiSummary.slice(0, 2000)}` : '';
  const contentForPrompt = extracted.text.slice(0, 4000) || extracted.description || extracted.title;

  const prompt = `你是一个专业的内容分析助手。请对以下内容进行深度分析，生成结构化的学习笔记。

内容标题：${extracted.title}
内容来源：${extracted.url || '文本输入'}
关键词：${keywords.join(', ')}
${wikiContext}

原文内容：
${contentForPrompt}

请返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "title": "优化后的笔记标题（不超过30字）",
  "summary": "内容摘要（100-200字，概括核心要点）",
  "outline": [
    {
      "title": "章节标题",
      "content": "章节详细内容（2-3段，详细展开）",
      "quote": "如有重要引用则填写，否则留空"
    }
  ],
  "tags": ["标签1", "标签2", "标签3"],
  "keyInsights": ["关键洞察1", "关键洞察2", "关键洞察3"]
}`;

  try {
    const result = await chatCompletion([
      { role: 'system', content: '你是专业的内容分析助手，擅长将视频、文章、文档等内容转化为结构化的学习笔记。只返回 JSON 数据。' },
      { role: 'user', content: prompt },
    ]);

    if (!result) return {};

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    const parsed = JSON.parse(jsonMatch[0]);

    const outline: OutlineNode[] = (parsed.outline || []).map((s: any) => ({
      title: s.title || '未命名章节',
      content: s.content || '',
      quote: s.quote || undefined,
    }));

    return {
      title: parsed.title || extracted.title,
      summary: parsed.summary || '',
      outline,
      tags: parsed.tags || [],
    };
  } catch (err) {
    console.error('[analysisEngine] AI generation failed:', err);
    return {};
  }
}

// ── Rule-based Generation (Fallback) ─────────────────────────────

function generateWithRules(
  extracted: { title: string; text: string; description?: string; url?: string },
  keywords: string[],
  category: string
): Partial<AnalysisResult> {
  const text = extracted.text || extracted.description || '';
  const title = extracted.title || '内容分析笔记';

  // Generate outline from content structure
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 20);
  const outline: OutlineNode[] = [];

  // Extract main points from paragraphs
  const mainPoints = paragraphs.slice(0, 6).map((p, i) => {
    const cleaned = p.trim();
    const firstSentence = cleaned.split(/[。！？.!?]/)[0]?.trim() || cleaned.slice(0, 50);

    return {
      title: firstSentence.length > 20 ? firstSentence.slice(0, 20) + '...' : firstSentence,
      content: cleaned.length > 500 ? cleaned.slice(0, 500) + '...' : cleaned,
      quote: i === 0 && cleaned.length > 50 ? cleaned.slice(0, 100) : undefined,
    };
  });

  if (mainPoints.length === 0) {
    // No paragraphs - create from keywords
    for (let i = 0; i < Math.min(keywords.length, 5); i++) {
      outline.push({
        title: `${keywords[i]} 详解`,
        content: `关于 ${keywords[i]} 的详细分析和讨论。`,
      });
    }
  } else {
    outline.push(...mainPoints);
  }

  // Generate summary
  const summary = `${title} 是一份关于 ${keywords.slice(0, 3).join('、')} 等内容 ${keywords.length > 3 ? '等' : ''} 的深度分析笔记。本笔记涵盖了 ${outline.length} 个核心要点，对原始内容进行了系统性的整理和提炼。`;

  // Generate tags
  const tags = keywords.slice(0, 4).length >= 2
    ? keywords.slice(0, 4)
    : [...(CATEGORY_TAGS[category] || []), ...keywords].slice(0, 4);

  return {
    title,
    summary,
    outline,
    tags,
  };
}

// ── Markdown Generation ──────────────────────────────────────────

function generateMarkdown(
  title: string,
  summary: string,
  outline: OutlineNode[],
  category: string,
  tags: string[],
  keywords: string[],
  wikiRefs: Array<{ title: string; url: string; summary: string; language: 'zh' | 'en' }> | undefined
): string {
  const catLabel = CATEGORY_LABELS[category] || '综合';

  let md = `# ${title}\n\n`;
  md += `> 分类：${catLabel} | 标签：${tags.join(', ')}\n\n`;
  md += `## 概述\n\n${summary}\n\n`;
  md += `## 章节要点\n\n`;

  outline.forEach((section, i) => {
    md += `### ${i + 1}. ${section.title}\n\n`;
    if (section.content) md += `${section.content}\n\n`;
    if (section.quote) md += `> ${section.quote}\n\n`;
  });

  if (keywords.length > 0) {
    md += `## 关键数据\n\n`;
    md += `| 项目 | 详情 |\n|------|------|\n`;
    keywords.slice(0, 5).forEach((kw, i) => {
      md += `| 关键词 ${i + 1} | ${kw} |\n`;
    });
    md += `\n`;
  }

  if (wikiRefs && wikiRefs.length > 0) {
    md += `## 参考资料\n\n`;
    wikiRefs.forEach(ref => {
      const langLabel = ref.language === 'zh' ? '中文' : '英文';
      md += `- [${ref.title}](${ref.url})（${langLabel}）\n`;
    });
    md += `\n`;
  }

  md += `---\n\n*本笔记由 CuteNote AI 分析引擎自动生成，仅供参考*\n`;

  return md;
}

// ── Main Analysis Function ───────────────────────────────────────

export async function analyzeContent(
  input: string,
  format: OutputFormat,
  onProgress?: (update: ProgressUpdate) => void
): Promise<AnalysisResult> {
  const reportProgress = (progress: number, stage: string) => {
    onProgress?.({ progress, stage });
  };

  // Step 1: Content extraction (0-20%)
  reportProgress(5, '正在提取内容...');
  const extracted = await extractContent(input);
  reportProgress(20, '内容提取完成');

  const platform = detectPlatform(input);
  const source: Note['source'] =
    platform === 'Bilibili' ? 'bilibili' :
    platform === 'YouTube' ? 'youtube' :
    platform === '网页' ? 'web' :
    platform === '文本' ? 'manual' :
    'file';

  // Step 2: Keyword extraction & category detection (20-25%)
  reportProgress(25, '正在提取关键词...');
  const fullText = extracted.text || extracted.description || input;
  const keywords = extractKeywords(fullText);
  const category = detectCategory(fullText);
  reportProgress(30, '关键词提取完成');

  // Step 3: Wikipedia search (25-40%)
  reportProgress(30, '正在检索 Wikipedia...');
  let wikiResult: Awaited<ReturnType<typeof searchWiki>>;
  try {
    wikiResult = await searchWiki(keywords.slice(0, 5));
  } catch (err) {
    console.error('[analysisEngine] Wikipedia search failed:', err);
    wikiResult = { references: [], combinedSummary: '' };
  }
  reportProgress(40, 'Wikipedia 检索完成');

  // Step 4: Vector embeddings (40-55%)
  reportProgress(40, '正在生成向量嵌入...');
  const chunks = chunkText(fullText);
  const wikiChunks = wikiResult.combinedSummary
    ? chunkText(wikiResult.combinedSummary)
    : [];

  // Temp note ID for vector storage
  const tempId = `temp-${Date.now()}`;

  let vectorChunks;
  try {
    const originalChunks = await vectorStore.addChunks(tempId, chunks, 'original');
    const wikiVectorChunks = wikiChunks.length > 0
      ? await vectorStore.addChunks(tempId, wikiChunks, 'wiki')
      : [];
    vectorChunks = [...originalChunks, ...wikiVectorChunks];
  } catch (err) {
    console.error('[analysisEngine] Vector embedding failed:', err);
  }
  reportProgress(55, '向量嵌入完成');

  // Step 5: Knowledge graph (55-70%)
  reportProgress(55, '正在构建知识图谱...');
  let knowledgeGraph: Awaited<ReturnType<typeof extractKnowledgeGraph>>;
  try {
    knowledgeGraph = await extractKnowledgeGraph(fullText, wikiResult.references);
  } catch (err) {
    console.error('[analysisEngine] Knowledge graph extraction failed:', err);
    knowledgeGraph = { nodes: [], edges: [] };
  }
  reportProgress(70, '知识图谱构建完成');

  // Step 6: Generate note content (70-95%)
  reportProgress(70, '正在生成笔记内容...');

  let genResult: Partial<AnalysisResult>;
  if (isConfigured()) {
    reportProgress(75, '正在调用 AI 分析...');
    try {
      genResult = await generateWithAI(extracted, keywords, wikiResult.combinedSummary, format);
    } catch (err) {
      console.error('[analysisEngine] AI generation failed, falling back to rules:', err);
      genResult = generateWithRules(extracted, keywords, category);
    }
  } else {
    genResult = generateWithRules(extracted, keywords, category);
  }

  // Fallback to rules if AI didn't produce results
  if (!genResult.outline || genResult.outline.length === 0) {
    genResult = generateWithRules(extracted, keywords, category);
  }

  const title = genResult.title || extracted.title || '内容分析笔记';
  const summary = genResult.summary || `${title} 是一份关于 ${keywords.slice(0, 3).join('、')} 的深度分析笔记。`;
  const outline = genResult.outline || [];
  const tags = genResult.tags?.length ? genResult.tags : keywords.slice(0, 4);

  // Generate markdown
  const markdown = generateMarkdown(title, summary, outline, category, tags, keywords, wikiResult.references);

  // Generate duration
  const wordCount = countWords(fullText);
  const paragraphCount = countParagraphs(fullText);
  const duration = source === 'bilibili' || source === 'youtube'
    ? '视频内容'
    : source === 'web'
    ? '网页内容'
    : source === 'file'
    ? '文件内容'
    : `约 ${wordCount} 字`;

  reportProgress(90, '笔记生成完成');

  // Step 7: Drawio generation (95-100%)
  reportProgress(90, '正在生成 Drawio 图表...');

  const mindMapXml = generateMindMap(title, outline);
  const frameworkXml = generateFrameworkDiagram(title, outline);
  const kgXml = generateKnowledgeGraphDiagram(knowledgeGraph);
  const combinedXml = generateCombinedDiagram(title, outline, knowledgeGraph);

  // Combine all Drawio diagrams
  const drawioXml = `<!-- 思维导图 -->
${mindMapXml}

<!-- 结构框架图 -->
${frameworkXml}

<!-- 知识图谱 -->
${kgXml}

<!-- 综合图表 -->
${combinedXml}`;

  reportProgress(100, '分析完成');

  // Clean up temp vector chunks (will be re-added with real note ID)
  vectorStore.clear(tempId);

  return {
    title,
    summary,
    outline,
    markdown,
    category,
    tags,
    duration,
    originalUrl: extracted.url || '',
    originalText: fullText,
    platform,
    source,
    knowledgeGraph,
    vectorChunks,
    drawioXml,
    wikiReferences: wikiResult.references,
    analysis: {
      keywords,
      entities: keywords,
      themes: outline.map(o => o.title),
      structure: outline.map(o => o.title),
      wordCount,
      paragraphCount,
    },
  };
}

// ── AI Q&A ───────────────────────────────────────────────────────

export async function askAI(note: Note, question: string): Promise<string> {
  if (!isConfigured()) {
    return `基于笔记内容，关于「${question}」的回答如下：\n\n${generateMockAnswer(note, question)}`;
  }

  const context = `笔记标题：${note.title}
分类：${note.category}
摘要：${note.summary}
大纲：${note.outline.map((o, i) => `${i + 1}. ${o.title}: ${o.content || ''}`).join('\n')}
Markdown：${note.markdown.slice(0, 3000)}`;

  try {
    const result = await chatCompletion([
      { role: 'system', content: `你是一个笔记分析助手。请基于以下笔记内容回答用户问题。

${context}` },
      { role: 'user', content: question },
    ]);

    return result || `基于笔记内容，关于「${question}」的回答如下：\n\n${generateMockAnswer(note, question)}`;
  } catch (err) {
    console.error('[analysisEngine] AI Q&A failed:', err);
    return `基于笔记内容，关于「${question}」的回答如下：\n\n${generateMockAnswer(note, question)}`;
  }
}

function generateMockAnswer(note: Note, question: string): string {
  const relatedSection = note.outline.find(o =>
    question.includes(o.title) || o.title.includes(question)
  );

  if (relatedSection) {
    return `根据笔记「${note.title}」中的相关内容：\n\n${relatedSection.content || '该章节包含重要信息。'}\n\n如需了解更多，请查看完整的笔记内容。`;
  }

  const allSections = note.outline.map((o, i) => `${i + 1}. ${o.title}`).join('\n');
  return `根据笔记「${note.title}」的内容，以下是相关章节结构：\n\n${allSections}\n\n关于「${question}」，笔记中提到：${note.summary}`;
}

// ── RAG Search ───────────────────────────────────────────────────

export async function ragSearch(noteId: string, query: string, topK = 5) {
  return await vectorStore.search(noteId, query, topK);
}

export async function ragSearchAll(query: string, topK = 10) {
  return await vectorStore.searchAll(query, topK);
}
