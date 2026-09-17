import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import {
  type OutputFormat,
  type OutlineNode,
  type Note,
  type GenerationJob,
  type DB,
} from './types';
import {
  analyzeContent,
  askAI,
  ragSearch,
  ragSearchAll,
} from './modules/analysisEngine';
import { searchWikiSimple } from './modules/wikiSearch';
import { vectorStore } from './modules/vectorStore';
import { getConfig, isConfigured } from './modules/aiClient';

// Prevent unhandled promise rejections from crashing the server
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

/* ---------------------------------------------------------------- */
/* Storage                                                           */
/* ---------------------------------------------------------------- */

function loadDB(): DB {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch {
      /* fall through to init */
    }
  }
  const db: DB = { notes: [], jobs: [] };
  seedPublicNotes(db);
  saveDB(db);
  return db;
}

function saveDB(db: DB) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

/* ---------------------------------------------------------------- */
/* Seed data helpers (for public notes)                              */
/* ---------------------------------------------------------------- */

interface ContentTemplate {
  title: string;
  paragraphs: string[];
  quote?: string;
}

const CATEGORY_CONTENT: Record<string, ContentTemplate[]> = {
  ai: [
    { title: 'AI 概述与发展历程', paragraphs: ['人工智能正在以前所未有的速度改变世界。从专家系统到深度学习，AI 经历了多次技术革新。', '大语言模型的出现标志着 AI 进入新阶段，通过学习海量文本获得了理解和生成自然语言的能力。'], quote: 'AI 不是要取代人类，而是要增强人类的能力。' },
    { title: 'Transformer 架构解析', paragraphs: ['Transformer 是当代大模型的基石，通过自注意力机制实现对序列数据的并行处理。', '注意力机制允许模型在处理每个位置时关注所有其他位置，捕捉长距离依赖关系。'] },
    { title: '训练方法与数据', paragraphs: ['大模型训练分为预训练和微调两阶段。预训练使用海量无标注数据，微调针对特定任务优化。', '高质量数据是模型性能的关键，数据清洗和去重对效果有重要影响。'], quote: '数据质量比数据数量更重要。' },
    { title: '应用场景与实践', paragraphs: ['大模型应用场景快速扩展，包括文本生成、代码编写、数据分析、智能问答等。', 'Prompt Engineering 是释放模型能力的关键技巧。'] },
  ],
  health: [
    { title: '核心观点', paragraphs: ['本期内容围绕如何通过饮食保护大脑健康展开，重点讲解营养与认知的关系。', '大脑健康不仅与遗传有关，更与日常生活方式密切相关。'], quote: '你的大脑是你身体最强大的器官，但它也需要正确的燃料来维持运转。' },
    { title: '大脑退化的常见原因', paragraphs: ['阿尔茨海默病是一种进行性神经退行性疾病，目前全球有超过5500万人受到影响。', '高糖、高加工食品的饮食模式会加速大脑退化。'] },
    { title: '保护大脑的饮食方案', paragraphs: ['地中海饮食模式被多项研究证实对大脑健康有益。', '蓝莓、菠菜、牛油果等食物富含抗氧化物质，有助于保护神经元。'], quote: '吃彩虹色的食物，给你的大脑上保险。' },
    { title: '日常习惯建议', paragraphs: ['规律运动是保护大脑的有效手段，每周至少150分钟中等强度有氧运动。', '充足睡眠对大脑修复至关重要，深度睡眠期间大脑会清除代谢废物。'] },
  ],
  programming: [
    { title: '项目背景与需求分析', paragraphs: ['本项目旨在构建高效、可扩展的系统架构。在设计之初对性能、可维护性和安全性进行全面评估。', '需求分析阶段明确了核心功能模块和非功能性约束。'], quote: '好的设计是看不见的，它把所有复杂的东西都藏在优雅的接口后面。' },
    { title: '技术选型与架构设计', paragraphs: ['前端采用 React 框架配合 TypeScript 实现类型安全。', '后端基于 Node.js + Express 构建，API 设计遵循 RESTful 规范。'] },
    { title: '核心实现与关键代码', paragraphs: ['核心功能围绕数据流转展开：输入→处理→存储→展示。', '异步处理机制是系统的关键，通过 Promise 和 async/await 实现非阻塞 I/O。'] },
    { title: '性能优化策略', paragraphs: ['性能优化从三个层面进行：减少渲染次数、优化数据加载、缓存策略。', '数据层通过分页加载和虚拟滚动减少初始加载量。'], quote: '过早的优化是万恶之源，但后期的优化是万福之源。' },
  ],
  finance: [
    { title: '市场概述与宏观环境', paragraphs: ['当前宏观经济环境复杂多变，全球利率走势和产业政策调整共同影响着市场格局。', 'A股市场呈现结构性分化特征，不同板块表现差异显著。'], quote: '在别人贪婪时恐惧，在别人恐惧时贪婪。' },
    { title: '投资策略与框架', paragraphs: ['价值投资强调安全边际和长期持有，通过深入分析企业基本面寻找被低估的优质标的。', '趋势交易关注市场动量和资金流向。'] },
    { title: '风险管理要点', paragraphs: ['风险管理是投资的核心，仓位控制、止损设置和分散化是三个基本工具。', '保持充足的现金储备和灵活的操作空间至关重要。'] },
    { title: '总结与核心认知', paragraphs: ['投资是一场关于概率的游戏，短期靠运气，长期靠认知。', '持续学习和反思是提升投资能力的唯一途径。'] },
  ],
  education: [
    { title: '考试策略与整体规划', paragraphs: ['备考的核心是建立系统性的复习框架，将考试内容分解为知识点模块。', '时间管理是备考成功的关键，制定合理的复习计划。'], quote: '学习不是重复做同一件事，而是用不同的方式理解同一个问题。' },
    { title: '知识点梳理与分类', paragraphs: ['将知识点按章节和逻辑关系进行分类整理，使用思维导图等工具可视化知识结构。', '重点标注高频考点和难点内容。'] },
    { title: '解题技巧与方法', paragraphs: ['掌握各类题型的解题模板和技巧，排除法、代入法、特殊值法都是有效工具。', '解答题需要规范的步骤和清晰的逻辑。'] },
    { title: '常见错误与避坑指南', paragraphs: ['常见错误包括审题不清、计算失误、公式记错等，建立错题本定期回顾。', '避免盲目刷题而忽视理解，举一反三比数量堆砌更重要。'] },
  ],
  general: [
    { title: '背景介绍', paragraphs: ['本期内容围绕核心主题展开，旨在帮助读者系统理解相关概念并掌握实践方法。', '我们将从背景分析入手，逐步深入到核心观点、详细解读和实践建议。'] },
    { title: '核心观点', paragraphs: ['通过系统学习关键概念并掌握实践方法，可以显著提升相关领域的理解和应用能力。', '方法论可以总结为"明确目标→收集资料→提炼观点→案例验证→总结复盘"五个步骤。'], quote: '知识的力量不在于记住多少，而在于能否将知识转化为行动。' },
    { title: '详细分析与解读', paragraphs: ['深入分析的核心在于理解问题的本质和关键变量。通过拆解复杂问题为简单子问题逐一解决。', '数据分析是理解问题的利器，通过量化指标和趋势判断可以避免错误决策。'] },
    { title: '总结与行动指南', paragraphs: ['本期内容从背景介绍到核心观点，从详细分析到实践建议，形成完整的知识闭环。', '最重要的是行动起来，选择今天就能做的一个小改变。'] },
  ],
};

const CATEGORY_TAGS: Record<string, string[]> = {
  ai: ['人工智能', 'LLM', 'Transformer', '机器学习', '深度学习', '大模型'],
  health: ['大脑健康', '阿尔茨海默病', '饮食', '认知衰退', '营养', '神经保护'],
  programming: ['编程', '算法', '数据结构', '开发', '架构', '优化'],
  finance: ['投资', '理财', '股票', '基金', '市场分析', '风险管理'],
  education: ['考试', '学习', '备考', '技巧', '复习', '应试'],
  general: ['总结', '分析', '观点', '方法论', '实践', '建议'],
};

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI', health: '健康知识', programming: '编程',
  finance: '金融', education: '教育', general: '综合',
};

function detectCategory(input: string): string {
  const lower = input.toLowerCase();
  if (/ai|llm|大模型|人工智能|gpt|transformer|机器学习|深度学习/.test(lower)) return 'ai';
  if (/健康|饮食|大脑|疾病|营养|运动|睡眠/.test(lower)) return 'health';
  if (/编程|代码|算法|开发|前端|后端|react|javascript|python/.test(lower)) return 'programming';
  if (/金融|投资|理财|股票|a股|股|基金|市场/.test(lower)) return 'finance';
  if (/考研|考公|公务员|备考|考试|学习|教育|数学|英语/.test(lower)) return 'education';
  return 'general';
}

function generateTags(category: string): string[] {
  return (CATEGORY_TAGS[category] ?? CATEGORY_TAGS.general).slice(0, 4);
}

function generateDuration(source: Note['source']): string {
  const rand = Math.random;
  if (source === 'bilibili' || source === 'youtube') {
    return `${Math.floor(12 + rand() * 48)}分${String(Math.floor(rand() * 60)).padStart(2, '0')}秒`;
  }
  if (source === 'file') return '文件';
  if (source === 'web') return '网页';
  return '手动';
}

function generateOriginalUrl(input: string): string {
  const lower = input.toLowerCase();
  if (/^https?:\/\//.test(lower)) return input.trim();
  if (/bilibili|b站|b23/.test(lower)) return 'https://www.bilibili.com/video/BV1xxx411c7x';
  if (/youtube|youtu/.test(lower)) return 'https://www.youtube.com/watch?v=xxxxxxx';
  if (/\.(pdf|doc|docx|ppt|txt|md)/.test(lower)) return '';
  return 'https://www.cutenote.app/explore';
}

function generateOutline(title: string, category: string): OutlineNode[] {
  const pool = CATEGORY_CONTENT[category] ?? CATEGORY_CONTENT.general;
  const count = Math.min(pool.length, 4 + Math.floor(Math.random() * 3));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(t => ({
    title: t.title,
    content: t.paragraphs.join('\n\n'),
    quote: t.quote,
  }));
}

function generateMarkdown(title: string, category: string, sections: OutlineNode[]): string {
  const tagStr = (CATEGORY_TAGS[category] ?? CATEGORY_TAGS.general).join(', ');
  const lines: string[] = [];
  lines.push(`# ${title}`, '', `> 分类：${CATEGORY_LABELS[category] ?? '综合'} | 标签：${tagStr}`, '');
  lines.push('## 概述', '');
  lines.push(`本笔记基于「${title.slice(0, 20)}」内容生成，涵盖相关的核心主题。`);
  lines.push('', '## 章节要点', '');
  for (const [i, s] of sections.entries()) {
    lines.push(`### ${i + 1}. ${s.title}`, '', s.content, '');
    if (s.quote) { lines.push(`> ${s.quote}`, ''); }
  }
  lines.push('## 关键数据', '', '| 项目 | 内容 |', '|------|------|');
  lines.push(`| 分类 | ${CATEGORY_LABELS[category] ?? '综合'} |`);
  lines.push(`| 标签 | ${tagStr} |`);
  lines.push('| 生成时间 | ' + new Date().toLocaleDateString('zh-CN') + ' |', '');
  lines.push('---', '', '*本笔记由 CuteNote AI 自动生成，仅供参考*');
  return lines.join('\n');
}

function generateSummary(title: string, category: string, sections: OutlineNode[]): string {
  const catLabel = CATEGORY_LABELS[category] ?? '综合';
  const titles = sections.slice(0, 3).map(s => s.title);
  return `本笔记基于「${title.slice(0, 30)}」内容生成，属于${catLabel}类。AI 自动提炼了${titles.join('、')}等核心章节。`;
}

function detectSource(input: string): Note['source'] {
  const lower = input.toLowerCase();
  if (/bilibili|b站|b23/.test(lower)) return 'bilibili';
  if (/youtube|youtu/.test(lower)) return 'youtube';
  if (/\.(pdf|doc|docx|ppt|txt|md)/.test(lower)) return 'file';
  if (/^https?:\/\//.test(lower)) return 'web';
  return 'manual';
}

function detectPlatform(input: string): string {
  const lower = input.toLowerCase();
  if (/bilibili|b站|b23/.test(lower)) return 'Bilibili';
  if (/youtube|youtu/.test(lower)) return 'YouTube';
  if (/\.(pdf|doc|docx|ppt|txt|md)/.test(lower)) return '文件';
  if (/\.(mp3|mp4|wav|avi)/.test(lower)) return '音视频文件';
  if (/^https?:\/\//.test(lower)) return '网页';
  return '文本';
}

function generateMockNote(
  title: string, format: OutputFormat, platform?: string,
  createdAt?: string, isPublic = false
): Note {
  const category = detectCategory(title);
  const sections = generateOutline(title, category);
  const now = new Date().toISOString();
  const finalPlatform = platform ?? detectPlatform(title);
  const source = detectSource(title) === 'manual' ? detectSource(finalPlatform) : detectSource(title);

  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title, format, summary: generateSummary(title, category, sections),
    outline: sections, markdown: generateMarkdown(title, category, sections),
    category: CATEGORY_LABELS[category] ?? '综合',
    tags: generateTags(category), duration: generateDuration(source),
    originalUrl: generateOriginalUrl(title + ' ' + finalPlatform),
    originalText: '',
    createdAt: createdAt ?? now, updatedAt: now, isPublic, source, platform: finalPlatform,
  };
}

function seedPublicNotes(db: DB) {
  const seeds = [
    { title: '保护大脑的饮食课 | 总结笔记', platform: 'Bilibili', format: 'image' as OutputFormat, ageMin: 20 },
    { title: 'AI博主App命名方法论笔记', platform: 'B站', format: 'image' as OutputFormat, ageMin: 73 },
    { title: '考研英语小作文·自我介绍与寒暄语写作方法', platform: 'B站', format: 'markdown' as OutputFormat, ageMin: 138 },
    { title: 'A股分时图卖出技巧实战教学与当日盘面复盘', platform: 'B站', format: 'image' as OutputFormat, ageMin: 152 },
    { title: 'LLM 实用入门指南', platform: 'YouTube', format: 'mindmap' as OutputFormat, ageMin: 240 },
    { title: '机器学习系列课程总结', platform: 'B站', format: 'image' as OutputFormat, ageMin: 284 },
    { title: '耳机健康选购指南', platform: 'B站', format: 'markdown' as OutputFormat, ageMin: 306 },
    { title: '考研数学极限大关精讲', platform: 'B站', format: 'image' as OutputFormat, ageMin: 330 },
    { title: 'PCA 主成分分析：原理、数学推导与实践应用', platform: 'B站', format: 'mindmap' as OutputFormat, ageMin: 339 },
    { title: '曾明教授谈AI新时代', platform: 'B站', format: 'image' as OutputFormat, ageMin: 346 },
    { title: 'K-Means 聚类算法（无监督学习）详解', platform: 'B站', format: 'markdown' as OutputFormat, ageMin: 1030 },
    { title: '公务员面试备考要点·颜值笔记', platform: 'B站', format: 'image' as OutputFormat, ageMin: 1041 },
    { title: '宏观金融与投资逻辑总结笔记', platform: 'B站', format: 'image' as OutputFormat, ageMin: 1138 },
  ];
  for (const s of seeds) {
    const created = new Date(Date.now() - s.ageMin * 60 * 1000).toISOString();
    db.notes.push(generateMockNote(s.title, s.format, s.platform, created, true));
  }
}

/* ---------------------------------------------------------------- */
/* Routes: Config                                                    */
/* ---------------------------------------------------------------- */

app.get('/api/config', (_req, res) => {
  res.json({
    configured: isConfigured(),
    config: getConfig(),
    vectorStoreSize: vectorStore.listNoteIds().length,
  });
});

/* ---------------------------------------------------------------- */
/* Routes: Public notes                                              */
/* ---------------------------------------------------------------- */

app.get('/api/public-notes', (_req, res) => {
  const db = loadDB();
  const publicNotes = db.notes.filter(n => n.isPublic);
  publicNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ notes: publicNotes });
});

/* ---------------------------------------------------------------- */
/* Routes: Notes CRUD                                                */
/* ---------------------------------------------------------------- */

app.get('/api/notes', (req, res) => {
  const db = loadDB();
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const search = (req.query.search as string)?.toLowerCase() ?? '';

  let notes = db.notes.filter(n => !n.isPublic);
  if (search) {
    notes = notes.filter(n =>
      n.title.toLowerCase().includes(search) ||
      n.summary.toLowerCase().includes(search) ||
      n.markdown.toLowerCase().includes(search) ||
      n.category.toLowerCase().includes(search) ||
      n.tags.some(t => t.toLowerCase().includes(search))
    );
  }
  notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const total = notes.length;
  const start = (page - 1) * limit;
  const data = notes.slice(start, start + limit);
  res.json({ notes: data, total, page, limit });
});

app.post('/api/notes', (req, res) => {
  const db = loadDB();
  const { title, markdown, format, summary } = req.body;

  if (!title || !markdown) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '标题和内容不能为空' } });
  }

  const category = detectCategory(title);
  const sections = generateOutline(title, category);
  const now = new Date().toISOString();

  const note: Note = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title, format: format || 'markdown',
    summary: summary || generateSummary(title, category, sections),
    outline: sections, markdown,
    category: CATEGORY_LABELS[category] ?? '综合',
    tags: generateTags(category),
    duration: '手动', originalUrl: '', originalText: '',
    createdAt: now, updatedAt: now, isPublic: false,
    source: 'manual', platform: '手动创建',
  };

  db.notes.push(note);
  saveDB(db);
  res.status(201).json(note);
});

app.get('/api/notes/:id', (req, res) => {
  const db = loadDB();
  const note = db.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '笔记不存在' } });
  res.json(note);
});

app.put('/api/notes/:id', (req, res) => {
  const db = loadDB();
  const idx = db.notes.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '笔记不存在' } });

  const { title, markdown, format, summary, isPublic } = req.body;
  const existing = db.notes[idx];
  const now = new Date().toISOString();

  if (title && title.trim()) existing.title = title.trim();
  if (markdown) existing.markdown = markdown;
  if (format) existing.format = format;
  if (summary) existing.summary = summary;
  if (typeof isPublic === 'boolean') existing.isPublic = isPublic;
  if (title) {
    const category = detectCategory(existing.title);
    existing.outline = generateOutline(existing.title, category);
    existing.category = CATEGORY_LABELS[category] ?? '综合';
    existing.tags = generateTags(category);
  }
  existing.updatedAt = now;
  db.notes[idx] = existing;
  saveDB(db);
  res.json(existing);
});

app.delete('/api/notes/:id', (req, res) => {
  const db = loadDB();
  const idx = db.notes.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '笔记不存在' } });
  vectorStore.clear(req.params.id);
  db.notes.splice(idx, 1);
  saveDB(db);
  res.json({ success: true });
});

/* ---------------------------------------------------------------- */
/* Routes: Generation jobs (real analysis)                           */
/* ---------------------------------------------------------------- */

const jobTimers = new Map<string, NodeJS.Timeout>();

app.post('/api/generation-jobs', async (req, res) => {
  const db = loadDB();
  const { input, format } = req.body;

  if (!input) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '输入内容不能为空' } });
  }

  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const job: GenerationJob = {
    id, status: 'queued', input, format: format || 'image',
    progress: 0, stage: '排队中', createdAt: now,
  };

  db.jobs.push(job);
  saveDB(db);

  // Run analysis in background
  (async () => {
    try {
      const result = await analyzeContent(input, job.format, (update) => {
        const freshDB = loadDB();
        const jobIdx = freshDB.jobs.findIndex(j => j.id === id);
        if (jobIdx !== -1) {
          freshDB.jobs[jobIdx].status = 'processing';
          freshDB.jobs[jobIdx].progress = update.progress;
          freshDB.jobs[jobIdx].stage = update.stage;
          saveDB(freshDB);
        }
      });

      // Create the note with all analysis data
      const note: Note = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: result.title,
        format: job.format,
        summary: result.summary,
        outline: result.outline,
        markdown: result.markdown,
        category: CATEGORY_LABELS[result.category] ?? '综合',
        tags: result.tags,
        duration: result.duration,
        originalUrl: result.originalUrl,
        originalText: result.originalText,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublic: false,
        source: result.source,
        platform: result.platform,
        knowledgeGraph: result.knowledgeGraph,
        vectorChunks: result.vectorChunks,
        drawioXml: result.drawioXml,
        wikiReferences: result.wikiReferences,
        analysis: result.analysis,
      };

      const freshDB = loadDB();
      freshDB.notes.push(note);

      // Re-store vector chunks under actual note ID and persist to DB
      if (result.vectorChunks && result.vectorChunks.length > 0) {
        try {
          const { extractContent, chunkText } = await import('./modules/contentExtractor');
          const extracted = await extractContent(input);
          const text = extracted.text || extracted.description || input;
          const chunks = chunkText(text);
          await vectorStore.addChunks(note.id, chunks, 'original');
          if (result.wikiReferences && result.wikiReferences.length > 0) {
            const wikiText = result.wikiReferences.map(r => `${r.title}: ${r.summary}`).join('\n\n');
            const wikiChunks = chunkText(wikiText);
            if (wikiChunks.length > 0) {
              await vectorStore.addChunks(note.id, wikiChunks, 'wiki');
            }
          }
          // Update DB with real-ID chunks
          const finalChunks = vectorStore.getChunks(note.id);
          const noteIdx = freshDB.notes.findIndex(n => n.id === note.id);
          if (noteIdx !== -1) {
            freshDB.notes[noteIdx].vectorChunks = finalChunks;
          }
        } catch (err) {
          console.error('[generation-job] Vector re-store failed:', err);
        }
      }

      const jobIdx = freshDB.jobs.findIndex(j => j.id === id);
      if (jobIdx !== -1) {
        freshDB.jobs[jobIdx].status = 'completed';
        freshDB.jobs[jobIdx].noteId = note.id;
        freshDB.jobs[jobIdx].progress = 100;
        freshDB.jobs[jobIdx].stage = '完成';
      }

      saveDB(freshDB);
    } catch (err) {
      console.error('[generation-job] Analysis failed:', err);
      const freshDB = loadDB();
      const jobIdx = freshDB.jobs.findIndex(j => j.id === id);
      if (jobIdx !== -1) {
        freshDB.jobs[jobIdx].status = 'failed';
        freshDB.jobs[jobIdx].error = String(err);
        freshDB.jobs[jobIdx].stage = '失败';
      }
      saveDB(freshDB);
    }
  })();

  res.status(201).json(job);
});

app.get('/api/generation-jobs/:id', (req, res) => {
  const db = loadDB();
  const job = db.jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '任务不存在' } });
  res.json(job);
});

app.get('/api/generation-jobs', (_req, res) => {
  const db = loadDB();
  db.jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ jobs: db.jobs });
});

/* ---------------------------------------------------------------- */
/* Routes: RAG Vector Search                                         */
/* ---------------------------------------------------------------- */

app.post('/api/search', async (req, res) => {
  const { query, noteId, topK } = req.body;
  if (!query) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '查询内容不能为空' } });
  }

  try {
    let rawResults;
    if (noteId) {
      rawResults = await ragSearch(noteId, query, topK || 5);
    } else {
      rawResults = await ragSearchAll(query, topK || 10);
    }

    // Flatten to frontend format
    const db = loadDB();
    const formatted = rawResults.map((r: any) => ({
      chunkId: r.chunk?.id ?? r.id ?? '',
      content: r.chunk?.content ?? r.content ?? '',
      score: r.score ?? 0,
      chunkIndex: r.chunk?.chunkIndex ?? 0,
      source: r.chunk?.source ?? 'original',
      noteId: r.noteId ?? noteId ?? '',
      noteTitle: db.notes.find(n => n.id === (r.noteId ?? noteId))?.title ?? '',
    }));

    res.json({ results: formatted });
  } catch (err) {
    res.status(500).json({ error: { code: 'SEARCH_ERROR', message: String(err) } });
  }
});

/* ---------------------------------------------------------------- */
/* Routes: Knowledge Graph                                           */
/* ---------------------------------------------------------------- */

app.get('/api/knowledge-graph/:noteId', (req, res) => {
  const db = loadDB();
  const note = db.notes.find(n => n.id === req.params.noteId);
  if (!note) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '笔记不存在' } });
  if (!note.knowledgeGraph) {
    return res.json({ graph: { nodes: [], edges: [] } });
  }
  res.json({ graph: note.knowledgeGraph });
});

/* ---------------------------------------------------------------- */
/* Routes: Drawio Export                                             */
/* ---------------------------------------------------------------- */

app.get('/api/drawio/:noteId', (req, res) => {
  const db = loadDB();
  const note = db.notes.find(n => n.id === req.params.noteId);
  if (!note) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '笔记不存在' } });
  if (!note.drawioXml) {
    return res.json({ xml: '' });
  }
  res.json({ xml: note.drawioXml, title: note.title });
});

// Download as file
app.get('/api/drawio/:noteId/download', (req, res) => {
  const db = loadDB();
  const note = db.notes.find(n => n.id === req.params.noteId);
  if (!note) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '笔记不存在' } });
  if (!note.drawioXml) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Drawio XML 不存在' } });
  }
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${note.title.slice(0, 20)}.drawio"`);
  res.send(note.drawioXml);
});

/* ---------------------------------------------------------------- */
/* Routes: Wikipedia Search                                          */
/* ---------------------------------------------------------------- */

app.get('/api/wiki-search', async (req, res) => {
  const query = (req.query.q as string) || '';
  if (!query) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '搜索关键词不能为空' } });
  }
  try {
    const results = await searchWikiSimple(query);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: { code: 'SEARCH_ERROR', message: String(err) } });
  }
});

/* ---------------------------------------------------------------- */
/* Routes: AI Q&A                                                    */
/* ---------------------------------------------------------------- */

app.post('/api/ask', async (req, res) => {
  const { noteId, question } = req.body;
  if (!noteId || !question) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'noteId 和 question 不能为空' } });
  }

  const db = loadDB();
  const note = db.notes.find(n => n.id === noteId);
  if (!note) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: '笔记不存在' } });
  }

  try {
    const answer = await askAI(note, question);
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: { code: 'ASK_ERROR', message: String(err) } });
  }
});

/* ---------------------------------------------------------------- */
/* Routes: Health check                                              */
/* ---------------------------------------------------------------- */

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), configured: isConfigured() });
});

/* ---------------------------------------------------------------- */
/* Static frontend (production build)                                */
/* ---------------------------------------------------------------- */

const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    if (!req.path.startsWith('/api/')) {
      const htmlPath = path.join(distPath, 'index.html');
      fs.readFile(htmlPath, 'utf-8', (err, data) => {
        if (err) { res.status(404).json({ error: 'Not Found' }); return; }
        res.type('html').send(data);
      });
    }
  });
  console.log('Serving frontend from dist/');
}

/* ---------------------------------------------------------------- */
/* Error handler                                                     */
/* ---------------------------------------------------------------- */

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
});

// Initialize vector store from persisted DB data
const initDB = loadDB();
for (const note of initDB.notes) {
  if (note.vectorChunks && note.vectorChunks.length > 0) {
    // Fix chunk IDs that may have temp prefixes
    const fixedChunks = note.vectorChunks.map(c => ({
      ...c,
      id: c.id.replace(/^chunk-[^-]+-/, `chunk-${note.id}-`),
    }));
    vectorStore.loadAll(note.id, fixedChunks);
  }
}
if (vectorStore.listNoteIds().length > 0) {
  console.log(`Vector store initialized with ${vectorStore.listNoteIds().length} notes`);
}

app.listen(PORT, () => {
  console.log(`CuteNote API server running at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`AI configured: ${isConfigured()}`);
  console.log(`Config:`, JSON.stringify(getConfig()));
});
