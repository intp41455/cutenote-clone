# CLAUDE.md — CuteNote 项目文档

## 1. 项目目的

**CuteNote** 是一个基于 **React 19 + Express 5** 的全栈 AI 智能笔记应用。支持从多种来源（URL、纯文本、文件上传）解析内容，通过 AI 生成结构化笔记，并提供多种输出格式（长图、脑图、Markdown、知识图谱、Drawio 图表等）以及 RAG 语义检索和 AI 问答功能。无需登录，所有功能本地运行。

## 2. 技术栈

| 层级 | 技术 | 版本/说明 |
|------|------|-----------|
| **前端框架** | React | 19.2.8 |
| **构建工具** | Vite | 8.2.2 |
| **样式** | Tailwind CSS | 4.3.3 (PostCSS) |
| **路由** | Hash Router (自实现，无依赖) | `src/lib/router.ts` |
| **后端框架** | Express | 5.1.0 |
| **运行时** | Node.js + TypeScript | TS 6.0.2, tsx 4.19.2 |
| **AI SDK** | OpenAI 兼容客户端 | 7.10.0 (支持 OpenRouter/DeepSeek/智谱/Moonshot 等) |
| **HTML 解析** | Cheerio | 1.2.0 |
| **向量检索** | TF-IDF (纯算法) / Embeddings (可选) | `server/modules/vectorStore.ts` |
| **知识图谱** | 实体/关系提取 + D3 力导向图 | `server/modules/knowledgeGraph.ts` |
| **图表生成** | Drawio XML 生成 | `server/modules/drawioGenerator.ts` |
| **代码检查** | Oxlint | 1.79.0 |
| **数据存储** | 本地 JSON 文件 (`data/db.json`) | 无数据库依赖 |

## 3. 目录结构

```
cutenote-clone/
├── server/                     # Express 后端
│   ├── index.ts               # 入口：API 路由 + 静态文件服务 + DB 初始化
│   ├── types.ts               # 共享类型定义 (Note, Job, KnowledgeGraph 等)
│   └── modules/               # 核心业务模块
│       ├── aiClient.ts        # OpenAI 兼容客户端、模型故障转移
│       ├── contentExtractor.ts# URL/HTML/文件内容提取
│       ├── wikiSearch.ts      # Wikipedia API 检索
│       ├── vectorStore.ts     # TF-IDF 向量存储 (内存+持久化)
│       ├── knowledgeGraph.ts  # 实体/关系提取、SVG 渲染
│       ├── drawioGenerator.ts # Drawio XML 生成 (思维导图/流程图/知识图谱)
│       └── analysisEngine.ts  # 主流程编排：内容分析 → 笔记生成
├── src/                       # React 前端
│   ├── components/
│   │   ├── Hero.tsx           # 首页生成入口 (URL/文本/文件输入)
│   │   ├── NoteDetailPage.tsx # 笔记详情页 (8 个 Tab)
│   │   ├── NoteEditor.tsx     # 笔记编辑器
│   │   ├── MyNotes.tsx        # 我的笔记列表 (分页/搜索)
│   │   ├── ExplorePage.tsx    # 公开笔记探索
│   │   ├── Header.tsx / Footer.tsx / RecentNotes.tsx
│   │   ├── AISkillPage.tsx / PricingPage.tsx
│   │   └── views/             # 详情页各 Tab 组件
│   │       ├── KnowledgeGraphView.tsx
│   │       ├── RagSearchView.tsx
│   │       └── DrawioView.tsx
│   ├── lib/
│   │   ├── api.ts             # API 客户端封装
│   │   └── router.ts          # Hash 路由实现
│   ├── App.tsx                # 根组件、路由分发
│   ├── main.tsx               # 入口
│   └── index.css / App.css    # 样式
├── docs/                      # 架构文档
│   ├── architecture.html      # 可交互架构图
│   ├── architecture.json      # 架构数据
│   └── architecture.png       # 静态架构图
├── data/                      # 运行时数据 (gitignore)
│   └── db.json                # 笔记+任务持久化
├── dist/                      # 生产构建输出 (gitignore)
├── package.json
├── vite.config.ts             # Vite 配置 (dev proxy /api → 3001)
├── tsconfig.json              # 项目引用配置
├── tsconfig.app.json          # 前端 TS 配置
├── tsconfig.node.json         # 后端 TS 配置
├── .env.example               # 环境变量模板
├── .gitignore
├── .oxlintrc.json             # Oxlint 配置
└── README.md
```

## 4. 安装 / 构建 / 运行 / 测试

### 环境要求
- Node.js ≥ 18
- npm / pnpm / yarn

### 快速开始 (生产模式)
```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量 (复制模板并填入 API Key)
cp .env.example .env
# 编辑 .env: OPENAI_API_KEY=sk-xxx (OpenRouter 推荐)

# 3. 构建前端
npm run build

# 4. 启动服务 (API + 前端静态文件，端口 3001)
npm start
# 访问 http://localhost:3001
```

### 开发模式
```bash
# 前后端同时启动 (Vite 5175 + Express 3001，带热重载)
npm run dev:all

# 仅前端
npm run dev

# 仅后端
npm run dev:server
```

### 代码检查
```bash
npm run lint        # Oxlint 检查
```

### 测试
> 项目暂无自动化测试套件。手动验证通过 `npm run dev:all` 启动后访问前端页面进行。

## 5. 关键约定与坑点

### 5.1 环境变量与 AI 配置
- `.env` 不提交 git (`.gitignore` 已配置)
- **无 API Key 时自动降级为规则模式**：关键词提取、TF-IDF 向量、规则问答，所有功能仍可用
- `CHAT_MODEL` 支持 `|` 分隔多模型故障转移：`model-a|model-b|model-c`
- 预配置 OpenRouter 免费模型池，无需充值即可使用

### 5.2 数据持久化
- `data/db.json` 存储所有笔记 (`notes[]`) 和生成任务 (`jobs[]`)
- 向量数据在内存中 (`vectorStore.ts`)，启动时从 `db.json` 恢复
- 删除笔记时同步清理向量存储 (`vectorStore.clear(noteId)`)

### 5.3 路由模式
- **前端**：Hash Router (`#/path`)，无需服务端配置，刷新不 404
- **后端**：`/api/*` 为 REST API，`/` 托管 `dist/` 静态文件
- **开发代理**：Vite `proxy: { '/api': 'http://localhost:3001' }`

### 5.4 笔记生成流程 (异步任务)
```
POST /api/generation-jobs { input, format }
  → 返回 jobId (status: queued)
  → 后台 analyzeContent() 执行：
      1. 内容提取 (URL/文件/文本)
      2. AI 分析 (大纲/总结/关键词/实体/主题)
      3. Wikipedia 知识增强
      4. 向量分块存储
      5. 知识图谱提取
      6. Drawio XML 生成
      7. Markdown/长图/脑图渲染
  → 进度轮询 GET /api/generation-jobs/:id
  → 完成后创建 Note 入库
```

### 5.5 关键 API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 + AI 配置状态 |
| GET | `/api/config` | 详细配置 + 向量库大小 |
| GET | `/api/public-notes` | 公开笔记列表 |
| GET | `/api/notes` | 我的笔记 (分页/搜索) |
| POST | `/api/notes` | 手动创建笔记 |
| GET/PUT/DELETE | `/api/notes/:id` | 笔记 CRUD |
| POST | `/api/generation-jobs` | 创建 AI 生成任务 |
| GET | `/api/generation-jobs/:id` | 查询任务进度 |
| POST | `/api/search` | RAG 语义检索 (单篇/跨笔记) |
| GET | `/api/knowledge-graph/:id` | 知识图谱数据 |
| GET | `/api/drawio/:id` | Drawio XML 预览/下载 |
| GET | `/api/wiki-search?q=` | Wikipedia 搜索 |
| POST | `/api/ask` | 基于笔记的 AI 问答 |

### 5.6 笔记详情 8 个 Tab
1. **长图笔记** — 可视化卡片
2. **思维导图** — 结构化大纲
3. **Markdown** — 完整源文
4. **原文** — 原始输入
5. **知识图谱** — SVG 力导向图 (可拖拽/缩放)
6. **RAG 检索** — 语义搜索
7. **Drawio** — 4 种图表预览 + `.drawio` 下载
8. **AI 问答** — 上下文感知问答

### 5.7 常见问题
| 问题 | 解决 |
|------|------|
| 端口冲突 | 修改 `.env` 中 `PORT` 或 Vite `server.port` |
| AI 调用失败 | 检查 `.env` API Key / Base URL；查看控制台错误日志；模型故障转移会自动重试 |
| 向量搜索无结果 | 确认笔记有 `vectorChunks`；重新生成或手动触发向量化 |
| 前端刷新 404 | 生产模式需 `npm run build` 后 `npm start`；开发模式用 `dev:all` |
| TypeScript 报错 | 运行 `npm run build` 触发 `tsc -b` 类型检查 |

### 5.8 开发注意事项
- **后端模块使用 ESM** (`"type": "module"`)，导入需 `.ts` 后缀或 `import.meta.url`
- **前后端共享类型** 在 `server/types.ts`，前端通过相对路径或 API 返回推断
- **无数据库**，所有状态在 `data/db.json`，适合单机/轻量部署
- **Oxlint** 替代 ESLint，配置在 `.oxlintrc.json`，速度极快
- **Tailwind CSS v4** 使用 PostCSS 插件，无需 `tailwind.config.js`

---

> 生成时间：2026-10-02  
> 基于 commit `23a7f69` (feat: AI 智能笔记应用)