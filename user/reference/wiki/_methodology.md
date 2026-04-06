# Karpathy LLM 知识库方法论

> **来源**: [Andrej Karpathy (@karpathy) — LLM Knowledge Bases](https://x.com/karpathy/status/2039805659525644595)
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

Karpathy 的洞察："我最近的大部分 token 使用量，已经不再主要用于操作代码，而是更多用于**操作知识**（以 markdown 和图片形式存储）。"

### 1.2 核心架构

```
原始数据 (raw/)                   编译产物 (wiki/)                   消费方式
┌──────────────┐                ┌──────────────────┐              ┌──────────────┐
│ 文章 (md)     │                │ _index.md        │              │ Obsidian 浏览 │
│ 论文 (pdf)    │    LLM 编译    │ _source-registry │   LLM 查询    │ 幻灯片 (Marp) │
│ 代码仓库      │ ──────────→    │ skills/*.md      │ ──────────→  │ 可视化图表    │
│ 数据集        │                │ foundations/*.md  │              │ CLI 搜索引擎  │
│ 图片          │                │ production/*.md   │              │ Q&A 对话      │
└──────────────┘                └──────────────────┘              └──────────────┘
       ↑                               ↑  ↓                            ↓
       │                          LLM 维护                         回填 wiki
       └─────── 新资料加入 ─────── 增量编译 ──── 探索结果归档 ────────┘
```

### 1.3 关键原则

**原则 1: 编译，不是复制**

LLM 不是简单地总结或复制原始资料。它执行的是"编译"：
- 提取概念
- 建立交叉链接
- 分类归档
- 生成文章
- 发现隐含关联

就像编译器将源码变成可执行程序，LLM 将散乱资料变成可查询的知识库。

**原则 2: 人不写 Wiki，LLM 写**

> "You rarely ever write or edit the wiki manually, it's the domain of the LLM."

人的角色：
- 选择原始资料（策展人）
- 提出问题（探索者）
- 审核质量（质量把关）
- 将探索结果回填 wiki（知识增长）

不做的事：
- 不手动写文章
- 不手动整理目录
- 不手动建立链接

**原则 3: Wiki 是活的**

Wiki 不是一次性产物。它通过以下方式持续生长：
- **增量编译**: 新资料进入 raw/ → LLM 更新相关文章
- **探索回填**: 问了一个好问题 → 答案"归档"回 wiki
- **健康检查**: LLM 定期 lint → 发现不一致 → 修复 → 发现新关联 → 扩展

**原则 4: 不需要 RAG（在一定规模内）**

> "I thought I had to reach for fancy RAG, but the LLM has been pretty good about auto-maintaining index files."

在小规模（~100 篇文章，~400K 词）下：
- LLM 自己维护索引文件 + 简短摘要
- 直接读取相关文件回答问题
- 不需要向量数据库或嵌入检索

当规模增长超过上下文窗口时，才需要考虑 RAG 或微调。

### 1.4 与传统知识管理的对比

| 维度 | Obsidian/Notion (人写) | RAG 系统 | Karpathy 方法 |
|------|----------------------|---------|--------------|
| **写作者** | 人 | N/A (检索) | LLM |
| **结构化** | 人手动组织 | 自动检索，无结构 | LLM 自动组织 |
| **链接** | 人手动建 | 无 | LLM 自动互链 |
| **更新** | 人手动更新 | 数据入库后自动 | 增量编译 |
| **查询** | 搜索 | 语义检索 | LLM 读 wiki 回答 |
| **适用规模** | 个人笔记 | 大规模 | 中等（~100 篇） |
| **成本** | 人力时间 | infra 成本 | token 成本 |

---

## 第二部分：实施手册（给 LLM 看）

> **以下是 LLM 执行知识库编译的完整 SOP。**
> 当你被要求"用 Karpathy 方法编译知识库"时，按以下步骤执行。

### 2.1 目录结构

```
{project}/
├── reference/
│   ├── repos/          ← 原始来源仓库（git clone 或下载）
│   │   ├── repo-A/
│   │   ├── repo-B/
│   │   └── ...
│   └── wiki/           ← 编译产物（你维护这里）
│       ├── _index.md           ← 全局索引（必须）
│       ├── _source-registry.md ← 来源注册表（必须）
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

#### Phase 3: 维护索引

每次编译新文章后，更新以下文件：

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

#### Phase 4: 健康检查（Linting）

定期执行以下检查：

```
□ 链接完整性: 所有 [[wiki-link]] 都指向真实存在的文章
□ 来源覆盖: 每个仓库至少被一篇文章引用
□ 概念一致性: 同一概念在不同文章中的定义一致
□ 缺失检测: 是否有来源中的重要内容未被任何文章覆盖
□ 关联发现: 是否有应该被链接但还没链接的概念对
```

### 2.3 批次编译策略

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
2. git commit 并 push
3. 等待人类审核后再继续下一批

### 2.4 增量编译

当新的原始来源加入时：

```
输入: 新加入 reference/repos/ 的仓库
操作:
  1. 执行 Phase 0 扫描新仓库
  2. 判断新仓库覆盖哪些已有概念 / 需要新建哪些概念
  3. 更新已有文章的来源覆盖表
  4. 如果需要，编译新文章
  5. 更新 _index.md 和 _source-registry.md
注意: 不要重写已有文章！只追加新来源的内容
```

### 2.5 Q&A 模式

当人类提问时，利用 wiki 回答：

```
输入: 用户问题
流程:
  1. 读取 _index.md 确定相关文章
  2. 读取相关文章获取详细内容
  3. 如需要，读取 reference/repos/ 中的原始代码
  4. 综合回答
  5. 如果回答产生了新知识，建议回填到 wiki
```

---

## 第三部分：实战案例

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

## 参考 & 引用

**原帖全文** (Andrej Karpathy, 2025):

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
