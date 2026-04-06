# Karpathy LLM 知识库方法论

> **来源**:
> - [Andrej Karpathy (@karpathy) — LLM Knowledge Bases 推文](https://x.com/karpathy/status/2039805659525644595)（2025 年首次提出）
> - [llm-wiki.md Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)（2026-04-04 正式规范，⭐ 4,991 / Fork 1,013）
>
> **核心理念**: 用 LLM 作为"编译器"，将散乱的原始研究资料编译为结构化、互链的 Markdown Wiki。人不直接写 Wiki — Wiki 是 LLM 的领地。

---

## 第一部分：原理（给人看）

### 1.1 为什么要这样做

传统知识管理的痛点：

| 方式 | 问题 |
|------|------|
| 收藏夹/书签 | 收藏了就忘了，从不回看 |
| 手动笔记 | 写得慢，覆盖率低，容易过时 |
| 复制粘贴 | 碎片化，没有结构，无法交叉引用 |
| 直接问 LLM | 没有持久化，下次还得重新问 |
| **RAG** | **每次从零检索，知识不累积** |

Karpathy 的洞察：

> "Most people's experience with LLMs and documents looks like RAG: you upload a collection of files, the LLM retrieves relevant chunks at query time, and generates an answer. This works, but **the LLM is rediscovering knowledge from scratch on every question**. There's no accumulation."

Wiki 与 RAG 的本质差异：**RAG 是每次查询时重新推导；Wiki 是编译一次、持续维护、越用越厚。**

### 1.2 三层架构（Gist 正式版）

Karpathy 在 Gist 中定义了明确的三层架构：

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Schema (CLAUDE.md / AGENTS.md / GEMINI.md)        │
│  告诉 LLM wiki 的结构规范、约定和工作流程                      │
│  人和 LLM 共同演进，是关键配置文件                              │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Wiki (LLM-generated .md files)                    │
│  摘要、实体页、概念页、比较、综合、索引                          │
│  LLM 完全拥有这一层 — 你只读，LLM 写                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Raw Sources (immutable)                           │
│  文章、论文、图片、数据文件                                     │
│  LLM 只读不改 — 这是你的 source of truth                     │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 三大操作

| 操作 | 描述 | 触发时机 |
|------|------|---------|
| **Ingest** | 读取新来源 → 写摘要 → 更新索引 → 更新相关实体/概念页 → 追加日志。一个来源可能触及 10-15 个 wiki 页面 | 新资料加入 raw/ |
| **Query** | 搜索相关页 → 读取 → 综合回答（可以是 md / 表格 / 幻灯片 / 图表）→ **好答案回填 wiki** | 用户提问 |
| **Lint** | 检查矛盾、陈旧声明、孤立页面、缺失交叉引用、可以补充的概念 | 定期/手动 |

> **关键洞察：好答案应该回填 wiki**。"A comparison you asked for, an analysis, a connection you discovered — these are valuable and shouldn't disappear into chat history."

### 1.4 索引与日志（双文件导航）

| 文件 | 方向 | 用途 |
|------|------|------|
| **index.md** | 内容导向 | Wiki 目录 — 每页一行链接 + 摘要 + 元数据，按分类组织。LLM 回答问题时先读 index 定位相关页 |
| **log.md** | 时间导向 | 追加写入 — 记录 ingest/query/lint 事件。可用 `grep "^## \[" log.md \| tail -5` 查看最近 5 条 |

```
## [2026-04-02] ingest | Article Title
## [2026-04-03] query | "How does X compare to Y?"
## [2026-04-04] lint   | Fixed 3 broken backlinks
```

### 1.5 关键原则

**原则 1: 编译，不是检索**

> "The knowledge is compiled once and then kept current, not re-derived on every query."

Wiki 是**持久化、复利化的知识产物**。交叉引用已经建好，矛盾已经标注，综合已经做完。

**原则 2: 人不写 Wiki，LLM 写**

> "You're in charge of sourcing, exploration, and asking the right questions. The LLM does all the grunt work."

类比：**Obsidian 是 IDE；LLM 是程序员；Wiki 是代码库。**

**原则 3: 不需要 RAG（中等规模内）**

> "The LLM reads the index first to find relevant pages, then drills into them. This works surprisingly well at moderate scale (~100 sources, ~hundreds of pages) and avoids the need for embedding-based RAG infrastructure."

当规模增长超过 index 能覆盖的范围，可引入 [qmd](https://github.com/tobi/qmd)（BM25 + 向量混合搜索）。

**原则 4: Wiki 是 git 仓库**

> "The wiki is just a git repo of markdown files. You get version history, branching, and collaboration for free."

### 1.6 为什么能 work

> "Humans abandon wikis because the maintenance burden grows faster than the value. LLMs don't get bored, don't forget to update a cross-reference, and can touch 15 files in one pass."

**人类负责**：策展来源、引导分析、提好问题、思考意义。
**LLM 负责**：其他一切 — 总结、交叉引用、归档、簿记。

### 1.7 与传统方法的对比

| 维度 | Obsidian (人写) | RAG 系统 | Karpathy LLM Wiki |
|------|----------------|---------|-------------------|
| **写作者** | 人 | N/A（检索） | LLM |
| **知识累积** | 靠人力 | 不累积 | 自动复利 |
| **结构化** | 人手动组织 | 无结构 | LLM 自动组织 |
| **链接** | 人手动建 | 无 | LLM 自动互链 |
| **更新** | 人手动 | 入库自动 | 增量编译 |
| **查询** | 搜索 | 语义检索 | LLM 读 index → 钻取 |
| **维护成本** | 人放弃 | infra | 近零（token） |

### 1.8 适用场景

Karpathy 列举的应用方向：

| 场景 | 说明 |
|------|------|
| **个人发展** | 目标追踪、健康、心理、自我提升 — 日记/文章/播客笔记归档 |
| **深度研究** | 数周/月跟踪主题 — 论文/报告增量编译 |
| **阅读** | 逐章归档 → 角色/主题/情节线页面 → 读完后拥有一个"粉丝 Wiki" |
| **团队/企业** | Slack 线程、会议纪要、项目文档 → LLM 维护内部 Wiki |
| **竞品分析/尽调** | 持续积累竞争信息 |

---

## 第二部分：实施手册（给 LLM 看）

> **以下是 LLM 执行知识库编译的完整 SOP。**
> 当你被要求"用 Karpathy 方法编译知识库"时，按以下步骤执行。

### 2.1 三层目录结构

```
{project}/
├── AGENTS.md / CLAUDE.md   ← Layer 3: Schema（编译指令和约定）
├── reference/
│   ├── repos/              ← Layer 1: Raw Sources（不可变）
│   │   ├── repo-A/
│   │   ├── repo-B/
│   │   └── ...
│   └── wiki/               ← Layer 2: Wiki（你维护这里）
│       ├── _index.md           ← 全局索引（必须）
│       ├── _source-registry.md ← 来源注册表（必须）
│       ├── _log.md             ← 操作日志（推荐）
│       ├── {category-A}/       ← 概念分类目录
│       │   ├── article-1.md
│       │   └── article-2.md
│       └── {category-B}/
│           └── article-3.md
```

### 2.2 编译流程

#### Phase 0: 扫描原始来源

```
输入: reference/repos/ 下的所有仓库
操作:
  1. 列出所有仓库目录
  2. 读取每个仓库的 README.md
  3. 统计文件数、核心文件列表
  4. 识别主题和覆盖范围
输出: 每个仓库一行的来源清单
```

#### Phase 1: 规划概念分类

```
输入: Phase 0 的来源清单
操作:
  1. 从所有来源中提取核心概念
  2. 将概念按主题分类（如 skills/ foundations/ production/）
  3. 为每个概念确定一篇文章
  4. 建立概念间的依赖关系
输出: 文章列表 + 分类 + 依赖图
```

#### Phase 2: 逐篇编译

对每篇文章执行以下编译 SOP：

```
输入: 来源仓库中与本概念相关的文件
操作:
  1. 读取所有相关源文件
  2. 按以下模板生成文章

输出模板:
---
# {概念名称}

> **一句话定义**: {用一句话解释这个概念}

## 核心原理

### {子主题 1}
{讲解 + 代码示例（直接从源码提取）}

### {子主题 2}
{讲解 + 表格/图示}

## 来源覆盖

| 来源 | 章节 | 覆盖深度 | 关键贡献 |
|------|------|---------|---------|
| [repo-name](相对路径) | 具体位置 | ⭐⭐⭐/⭐⭐/⭐ | 该来源贡献了什么 |

## 概念间关系

- **前置概念**: [[链接]] (为什么需要先理解它)
- **后续概念**: [[链接]] (学完这个可以继续学什么)
- **相关概念**: [[链接]] (横向关联)

## 开放问题

1. {这个领域还有什么未解决的问题？}
---
```

**编译规则**：
- 代码示例**必须**从源码中提取，不要凭空编写
- 来源覆盖表**必须**包含实际文件路径
- 概念间关系**必须**使用 `[[wiki-link]]` 格式
- 覆盖深度使用 ⭐ 评级：⭐⭐⭐ = 定义级（核心来源），⭐⭐ = 实现级（重要参考），⭐ = 补充级
- 每篇文章末尾**必须**有"开放问题"，引导读者思考

**双输出规则**（社区最佳实践）：
> "Every task produces two outputs." 无论执行什么任务（分析、比较、提问），输出 1 = 直接回答，输出 2 = 更新相关 wiki 文章。不这样做 = 知识蒸发到聊天记录。

#### Phase 3: 维护索引与日志

每次编译/回答后，更新以下文件：

**_index.md 更新规则**：
```
1. 在对应 Phase 表格中添加/更新文章行
2. 将状态标记为 ✅
3. 在交叉引用速查表中添加新条目
4. 在 Mermaid 概念图中添加新节点和边
```

**_source-registry.md 更新规则**：
```
1. 更新仓库的 Wiki 覆盖列
2. 更新覆盖率矩阵
```

**_log.md 更新规则**：
```
每次操作追加一条记录:
## [YYYY-MM-DD] {ingest|query|lint} | {标题/摘要}
- 涉及 {N} 个 wiki 页面
- 关键变更: ...
```

#### Phase 4: 健康检查（Linting）

定期执行以下检查：

```
□ 矛盾检测: 不同页面对同一事实的描述是否矛盾
□ 陈旧声明: 新来源是否已经取代旧页面中的观点
□ 孤立页面: 有没有页面没有任何入站链接
□ 缺失页面: 有没有概念被提到但没有自己的页面
□ 缺失引用: 应该互相链接的页面是否已连接
□ 数据空白: 能否通过搜索补充缺失信息
□ 来源覆盖: 每个仓库至少被一篇文章引用
```

### 2.3 渐进式上下文披露（Token 预算）

社区实践中总结的四层 token 分配策略：

| 级别 | Token 预算 | 内容 | 使用时机 |
|------|-----------|------|---------|
| **L0** | ~200 | 项目上下文 | 每次会话 |
| **L1** | ~1-2K | index.md | 会话开始 |
| **L2** | ~2-5K | 搜索结果 | 定位相关页 |
| **L3** | 5-20K | 完整文章 | 深入阅读 |

**关键纪律**：不先读 index 就不读全文。否则 agent 要么读太少，要么烧掉上下文读所有内容。

### 2.4 批次编译策略

不要试图一次编译所有文章。按批次进行：

```
Batch 1: 核心概念 (最独立、依赖最少的)
  → 编译 → 提交 → 审核

Batch 2: 中间层 (依赖 Batch 1 的概念)
  → 编译 → 更新索引 → 提交 → 审核

Batch 3: 高级概念 (依赖前两批的)
  → 编译 → 更新索引 → 最终健康检查 → 提交
```

每批次控制在 4-6 篇文章。每批次完成后：
1. 更新 _index.md 和 _source-registry.md
2. 追加 _log.md
3. git commit 并 push
4. 等待人类审核后再继续下一批

### 2.5 增量编译

当新的原始来源加入时：

```
输入: 新加入 reference/repos/ 的仓库
操作:
  1. 执行 Phase 0 扫描新仓库
  2. 判断新仓库覆盖哪些已有概念 / 需要新建哪些概念
  3. 更新已有文章的来源覆盖表
  4. 如果需要，编译新文章
  5. 更新 _index.md 和 _source-registry.md
  6. 追加 _log.md
注意: 不要重写已有文章！只追加新来源的内容
```

### 2.6 Q&A 模式

当人类提问时，利用 wiki 回答：

```
输入: 用户问题
流程:
  1. 读取 _index.md 确定相关文章 (L1)
  2. 读取相关文章获取详细内容 (L2 → L3)
  3. 如需要，读取 reference/repos/ 中的原始代码
  4. 综合回答 (Output 1: 直接回答)
  5. 更新相关 wiki 文章 (Output 2: 知识回填)
  6. 追加 _log.md
```

---

## 第三部分：社区最佳实践

> 来源：Gist 评论区生产经验摘录（[gist comments](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)）

### 3.1 高价值经验（已验证）

| # | 实践 | 原理 | 来源 |
|---|------|------|------|
| 1 | **先分类再提取** | 50 页报告和 2 页信件需要不同的处理流程。classify → narrow → extract → deepen 节省 token 且结果更好 | @hejiajiudeeyu |
| 2 | **每种实体类型一个模板** | Person 页和 Event 页需要不同的 section。7 种类型是甜蜜点 | @hejiajiudeeyu |
| 3 | **每个任务产生两个输出** | Output 1 = 直接回答，Output 2 = wiki 更新。不这样做 = 知识蒸发 | @hejiajiudeeyu |
| 4 | **从第一天就设计跨域** | 在 frontmatter 加 domain 标签。共享实体（跨项目出现的人/组织/概念）是图中最有价值的节点 | @hejiajiudeeyu |
| 5 | **人类拥有验证权** | LLM 可以不引用就综合。在 schema 中强制要求来源引用，并抽查 wiki 内容 | @hejiajiudeeyu |
| 6 | **增加 reflect 步骤** | 不只是 ingest→compile→query→lint，而是 ingest→compile→**reflect**→query→lint。记录决策理由、替代方案、推理过程 | @bendetro |

### 3.2 扩展方向

| 方向 | 描述 | 项目 |
|------|------|------|
| **Provenance 追踪** | 每个命题记录来源文件和内容哈希，查询时校验是否过期 | [freelance](https://github.com/duct-tape-and-markdown/freelance) |
| **Git Blame 溯源** | 确定性执行层 — LLM 提议 JSON 操作（KEEP/UPDATE/MERGE/SUPERSEDE/ARCHIVE），系统验证后 git commit | [palinode](https://github.com/Paul-Kyle/palinode) |
| **双层检索** | Wiki 层（人读）+ Memvid 层（机器检索，<5ms），原子同步 + 漂移检测。50 篇以下 wiki 够用，500+ 需要 Memvid | [knowledge-engine](https://github.com/tashisleepy/knowledge-engine) |
| **编译管线化** | 5 个 focused pass（diff→summarize→extract concepts→write articles→images），类似 `make` 增量模型 | [sage-wiki](https://github.com/xoai/sage-wiki) |
| **认知图谱** | 不存知识，存思维方式 — 决策规则、框架、张力、偏好。typed edges + 节点衰减 | [thinking-mcp](https://github.com/multimail-dev/thinking-mcp) |
| **SQLite 后端** | 文件系统用 6-12 月后发现 SQLite 是更好的 agent 抽象，尤其多 agent 协作时 | [ra-h_os](https://github.com/bradwmorris/ra-h_os) |
| **Schema 标准化** | IDEA.md — 供应商中立的 idea intent 文件（thesis/problem/how/not/start） | [IDEA.md](https://github.com/pithpusher/IDEA.md) |

### 3.3 工具推荐

| 工具 | 作用 | 说明 |
|------|------|------|
| **Obsidian** | Wiki IDE | 图视图看连接、Marp 做幻灯片、Dataview 做动态表格 |
| **Obsidian Web Clipper** | 网页 → md | 浏览器扩展，一键将网页转 markdown |
| **qmd** | Wiki 搜索引擎 | BM25 + 向量混合搜索，CLI + MCP server |
| **Marp** | 幻灯片 | Markdown → 幻灯片，Obsidian 有插件 |
| **Dataview** | 动态查询 | 查询 YAML frontmatter 生成表格和列表 |
| **git** | 版本控制 | 免费获得历史、分支、协作 |

---

## 第四部分：实战案例

本 Wiki 就是用此方法构建的实例：

| 维度 | 数据 |
|------|------|
| **原始来源** | 13 个 Git 仓库 (reference/repos/) |
| **Wiki 产出** | 15 篇文章，3 个分类目录 |
| **基础设施** | _index.md + _source-registry.md |
| **编译批次** | 3 批 (6 + 4 + 5 篇) |
| **概念图** | 15 个节点，3 个子图 (Foundations / Skills / Production) |

**实际目录结构**：

```
wiki/
├── _methodology.md          ← 本文档（方法论指南）
├── _index.md               ← 全局索引 + Mermaid 概念图 + 阅读路径
├── _source-registry.md      ← 13 个仓库的覆盖矩阵
├── skills/                  ← Batch 1: Agent 技能 (6 篇)
│   ├── agent-definition.md
│   ├── tool-use-mcp.md
│   ├── prompt-engineering.md
│   ├── multi-agent.md
│   ├── context-engineering.md
│   └── memory.md
├── foundations/             ← Batch 2: LLM 基座 (4 篇)
│   ├── transformer.md
│   ├── tokenization.md
│   ├── training-pipeline.md
│   └── reasoning.md
└── production/              ← Batch 3: 生产工程 (5 篇)
    ├── harness-architecture.md
    ├── observability.md
    ├── identity-persona.md
    ├── agentic-protocols.md
    └── failure-recovery.md
```

---

## 附录：原始来源全文

### A. Gist 正式文档 (llm-wiki.md, 2026-04-04)

> [完整原文](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
>
> **Why this works**: "The tedious part of maintaining a knowledge base is not the reading or the thinking — it's the bookkeeping. Updating cross-references, keeping summaries current, noting when new data contradicts old claims, maintaining consistency across dozens of pages. Humans abandon wikis because the maintenance burden grows faster than the value. LLMs don't get bored, don't forget to update a cross-reference, and can touch 15 files in one pass."
>
> **Historical context**: "The idea is related in spirit to Vannevar Bush's Memex (1945) — a personal, curated knowledge store with associative trails between documents. The part he couldn't solve was who does the maintenance. The LLM handles that."
>
> **Note on abstraction**: "This document is intentionally abstract. It describes the idea, not a specific implementation. The right way to use this is to share it with your LLM agent and work together to instantiate a version that fits your needs."

### B. 推文原文 (2025)

> **LLM Knowledge Bases**
>
> Something I'm finding very useful recently: using LLMs to build personal knowledge bases for various topics of research interest. A large fraction of my recent token throughput is going less into manipulating code, and more into manipulating knowledge (stored as markdown and images).
>
> **Data ingest:** I index source documents (articles, papers, repos, datasets, images, etc.) into a raw/ directory, then I use an LLM to incrementally "compile" a wiki, which is just a collection of .md files in a directory structure. The wiki includes summaries of all the data in raw/, backlinks, categorizes data into concepts, writes articles for them, and links them all.
>
> **IDE:** I use Obsidian as the IDE "frontend" where I can view the raw data, the compiled wiki, and the derived visualizations. Important to note that the LLM writes and maintains all of the data of the wiki, I rarely touch it directly.
>
> **Q&A:** Once your wiki is big enough (e.g. ~100 articles and ~400K words), you can ask your LLM agent all kinds of complex questions against the wiki. I thought I had to reach for fancy RAG, but the LLM has been pretty good about auto-maintaining index files and brief summaries.
>
> **Output:** Instead of getting answers in text/terminal, I like to have it render markdown files, slide shows (Marp format), or matplotlib images, all viewed in Obsidian. Often, I end up "filing" the outputs back into the wiki to enhance it for further queries. So my own explorations always "add up" in the knowledge base.
>
> **Linting:** I've run LLM "health checks" over the wiki to find inconsistent data, impute missing data, find interesting connections for new article candidates, etc.
>
> **TLDR:** raw data from sources is collected, compiled by an LLM into a .md wiki, operated on by various CLIs by the LLM to do Q&A and incrementally enhance the wiki, all viewable in Obsidian. You rarely ever write or edit the wiki manually, it's the domain of the LLM.
