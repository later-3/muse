# D18 — N11 Context 工程 (3/3)

> **日期：** 2026-04-25（Fri）
> **路线图位置：** Week 3 · Day 18 · N11 Context 工程（第 3 天，共 3 天）
> **定位：** 🟥 精通级（今天 1.5h = 45min 理论 + 45min 实践）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **Agent Memory 有哪些类型？** 短期/长期/工作记忆在工程上分别怎么实现？
2. **Memory 怎么注入 Context？** 什么时候写入、什么时候检索、怎么决定放多少？
3. **D16-D18 三天的 Context 工程怎么串起来？** CE 定义 → MCP/工具 → Memory，完整的信息管线

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（Agent Memory） | 35min | [ ] |
| 2 | 📖 读 → `unit04-state-memory/study/03a-memory-and-vectors.md` | 10min | [ ] |
| 3 | 📂 oc14 Prompt 组装链（见下方） | 40min | [ ] |
| 4 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 吴恩达 [Memory 短课](https://www.deeplearning.ai/short-courses/agent-memory-building-memory-aware-agents/) + MemGPT 论文 + Muse 实际代码提炼。
> 今天是 CE 第三天：**Agent Memory 的工程实现 + 和 Context 的关系**。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **Episodic Memory** | 记录具体事件的记忆 | "上周二用户说他喜欢古典音乐" | Memory Schema 设计 |
| **Semantic Memory** | 提炼出的通用知识/偏好 | "用户偏好：简洁回答、古典音乐" | 提炼算法 |
| **Procedural Memory** | 执行任务的方法记忆 | "处理退款时先查订单再确认金额" | 和 System Prompt 的关系 |
| **Vector Database** | 用向量存储和检索文本的数据库 | 把文本变成数字，用距离算相似度 | 索引算法（HNSW/IVF） |
| **Embedding** | 把文本转成高维向量的技术 | "猫" → [0.2, 0.8, ...] 一串数字 | 不同模型的 embedding 差异 |

### Agent Memory 的三种类型

[Fact] 吴恩达在 Memory 短课中系统整理了三种 Memory：

#### 1. 短期记忆 (Short-term / Working Memory)

```
实现: 对话历史（messages 数组）
存储: 在内存中，会话结束即消失
注入方式: 直接作为 Context 的一部分

Agent 消息列表:
[
  {role: "system", content: "你是 Muse..."},
  {role: "user", content: "你好"},
  {role: "assistant", content: "嗨！有什么..."},
  {role: "user", content: "帮我查天气"},     ← 短期记忆
  {role: "assistant", content: "tool_call..."},
  {role: "tool", content: "北京晴 25度"},
  ...
]
```

**关键问题：** 短期记忆 = Context History → D16 学的 Compaction 问题就在这里。

#### 2. 长期记忆 (Long-term Memory)

```
实现: 持久化存储（数据库/文件/向量库）
存储: 跨会话保留，直到主动删除
注入方式: 在构建 Context 时检索并注入

两种子类型:
├── Episodic Memory:  具体事件
│   "2025-04-10: 用户问了 Transformer 的问题"
│   "2025-04-11: 用户提到他在准备面试"
│
└── Semantic Memory:  提炼的知识/偏好
    "用户名字: Later"
    "用户偏好: 简洁、中文、有代码示例"
    "用户背景: 正在学 Agent 开发"
```

#### 3. 程序记忆 (Procedural Memory)

```
实现: System Prompt 中的行为规则 + 工具定义
存储: 代码/配置文件中
注入方式: 固定注入 System Prompt

例:
"当用户说'帮我记住'时，调用 save_memory 工具"
"回答技术问题时，先给定义再举例"
```

### Memory 的读写流程

[Fact] Agent Memory 的完整生命周期：

```
             写入 (Write)                          读取 (Read)
           ──────────                            ──────────
对话结束后:                          构建 Context 时:
1. 提取重要信息                     1. 根据用户消息检索相关记忆
   "用户今天学了 RLHF"               query = "RLHF 的三步法"
2. 分类存储                         2. 向量相似度搜索
   Episodic → 事件记录                 embedding(query) → 近似搜索
   Semantic → 更新用户画像           3. 取 top-K 结果注入 Context
3. 持久化到数据库                      "相关记忆: 用户在 D06 学过 RLHF..."
```

### Muse 的 Memory 实现

[Fact] Muse 的 `src/mcp/memory.mjs` 暴露了以下 Memory 工具：

| 工具名 | 类型 | 说明 |
|--------|------|------|
| `search_memory` | 读取 | 语义搜索长期记忆 |
| `set_memory` | 写入 | 保存/更新记忆 |
| `get_user_profile` | 读取 | 获取用户画像（Semantic Memory） |
| `get_recent_episodes` | 读取 | 获取最近事件（Episodic Memory） |
| `add_episode` | 写入 | 添加事件记录 |
| `create_goal` / `list_goals` / `update_goal` | 读写 | 用户目标管理 |

**Memory 怎么注入 Context：**

```
用户说: "我们上次聊了什么？"

1. engine.mjs 检测到需要记忆 → 调用 get_recent_episodes
2. 返回: "上次聊了 Transformer 架构的 Self-Attention"
3. 这个返回值作为 tool result 注入 Context
4. LLM 看到记忆 → "我们上次聊了 Self-Attention 的 QKV 机制"
```

### 向量数据库 — Memory 检索的核心

[Fact] 长期记忆的检索依赖向量相似度：

**Step 1：存储时**
```
记忆文本: "用户在 2025-04-10 学习了 RLHF"
   ↓ Embedding Model (如 OpenAI text-embedding-3)
向量: [0.12, -0.34, 0.56, ...] (1536维)
   ↓ 存入向量数据库
```

**Step 2：检索时**
```
用户问题: "RLHF 的三步法是什么？"
   ↓ 同一个 Embedding Model
查询向量: [0.15, -0.30, 0.52, ...]
   ↓ 余弦相似度搜索
最相似的记忆: "用户在 D06 学过 RLHF: SFT→RM→PPO"  (相似度 0.92)
```

**关键参数：**
- **top-K**: 返回最相似的 K 条记忆（通常 3-10 条）
- **相似度阈值**: 低于阈值的不返回（避免不相关内容）
- **Token 预算**: 检索出的记忆不能超过 Context 中分配的份额

### Memory 的设计权衡

| 决策点 | 选项 A | 选项 B | Agent 实践 |
|--------|--------|--------|-----------|
| **何时写入？** | 每轮都写 | 会话结束时批量写 | 重要信息即时写，其余批量 |
| **写什么？** | 所有对话 | 只提取关键信息 | 提取关键信息（LLM 做摘要） |
| **检索多少？** | 所有记忆 | top-K 相关 | top-5 + 相似度阈值 |
| **隐私问题？** | 全部存储 | 用户可控制 | 用户可查看/删除自己的记忆 |

### D16-D18 Context 工程三天串联

```
D16: Context 是什么？怎么组装？
├── CE 定义: 管理所有进入 Context 的信息
├── 5层结构: System / Tools / RAG / History / Message
├── Compaction: 截断 / 摘要 / 滑动窗口 / 语义检索
└── Context 预算分配

D17: 工具和安全
├── MCP: Agent-工具的 USB 标准
├── 工具结果的 Context 成本
├── Prompt 组装链（三明治架构）
└── Prompt Injection 防御

D18: Memory ← 今天
├── 三种记忆: 短期 / 长期(Episodic+Semantic) / 程序
├── 读写流程: 提取→存储→检索→注入
├── 向量数据库: Embedding→余弦相似度→top-K
└── Memory 设计权衡

═══════════════════════════════════════
CE 完整信息管线:
User Message → [Memory 检索] → [Tool 定义注入] →
[Identity 注入] → [History 压缩] → [Context 组装] → LLM
```

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "Memory allows agents to maintain context and learn from past interactions." — 吴恩达 | 记忆让 Agent 不会"金鱼记忆" — 能记住之前聊过什么 |
| "The key challenge is deciding *what* to remember, not *how* to store it." — MemGPT 论文 | 关键不是技术（向量库很成熟），而是设计（什么值得记？） |
| "三種記憶對應人類認知: 情節 / 語意 / 程序。" — 李宏毅 LH25_01 | Agent 的记忆架构模仿了人类大脑的分工 |

### 🎤 面试追问链

```
Q1: 你的 Agent 怎么实现跨会话记忆？
→ 你答: 三层记忆：短期=对话历史(内存)、长期=向量数据库(持久化)、程序=System Prompt(代码)。跨会话靠长期记忆。
  Q1.1: 长期记忆的检索怎么做？
  → 你答: Embedding + 向量相似度搜索。用户问题→embedding→在向量库中找最相似的记忆→top-K注入Context。
    Q1.1.1: 检索出不相关的记忆怎么办？
    → 你答: 设相似度阈值（如0.75以下不返回）+ 限制token预算 + 最终让LLM决定是否使用。

Q2: Episodic 和 Semantic Memory 有什么区别？
→ 你答: Episodic=具体事件("昨天用户学了RLHF")，Semantic=提炼的知识("用户正在学Agent开发")。Episodic是原始材料，Semantic是归纳总结。
```

### 这几个概念不要混

- **Memory ≠ Context**：Memory 是持久化存储（跨会话），Context 是一次请求的输入（临时）。Memory 需要被"检索并注入" Context 才能被 LLM 看到
- **Episodic ≠ Semantic**：Episodic 是具体事件（时间+地点+事件），Semantic 是提炼的通用知识
- **Embedding ≠ Tokenization**：Embedding 把文本变成语义向量（用于检索），Tokenization 把文本切成 token（用于 LLM 处理）
- **向量数据库 ≠ 关系数据库**：向量库用相似度检索（模糊匹配），关系库用精确查询（SQL）

### 关键概念清单

- [ ] **三种 Memory**：短期/长期(Episodic+Semantic)/程序
- [ ] **Memory 读写流程**：提取→分类→存储→检索→注入
- [ ] **向量检索原理**：Embedding→余弦相似度→top-K
- [ ] **Memory 注入 Context 的方式**：作为 tool result 或固定注入
- [ ] **Muse 的 Memory 工具**：search_memory / set_memory / episodes / goals
- [ ] **D16-D18 串联**：CE定义→MCP/工具→Memory = 完整信息管线
- [ ] **Memory 设计权衡**：写什么 / 检索多少 / 隐私控制

---

## 🔧 实践任务：oc14 Prompt 组装链

> 📂 已有文件，去看 → `unit02-prompt-eng/oc-tasks/L2-understand/oc14-prompt-assembly.md`

**USOLB 标注：** `[S] 源码` `[O] 观察` `[L] 日志`

**任务说明：**
1. 跟踪 Muse 的 engine.mjs → 理解 Context 是怎么一层一层组装的
2. 找到 Memory 注入的位置 — 在 Context 中占了多少 token？
3. 画出 D16-D18 学到的完整组装流程图

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| 吴恩达 Memory 短课 | https://www.deeplearning.ai/short-courses/agent-memory-building-memory-aware-agents/ | 全程 — Memory 架构 |
| MemGPT 论文 | https://arxiv.org/abs/2310.08560 | Memory 自管理的 Agent |

> 📖 **已有 study 文档：**
> - `unit04-state-memory/study/03a-memory-and-vectors.md` — 记忆与向量 🟡

---

## 🧠 与 Muse/项目 的映射

- **本地代码实际做的事：**
  - `src/mcp/memory.mjs` — Memory MCP Server（search/set/episodes/goals）
  - `src/core/memory.mjs` — Memory 核心逻辑（读写持久化存储）
  - `families/{family}/{member}/data/` — 实际的记忆存储位置
- **远端模型/外部系统做的事：**
  - Embedding API（OpenAI text-embedding-3）把文本转向量
  - LLM 决定何时调用 memory 工具（search/save）
- **和明天的关系：** D19 RAG — 另一种把外部知识注入 Context 的方式。Memory 是"记住用户的事"，RAG 是"查找世界的知识"

---

## ✅ 自检清单

- [ ] **能列出三种 Memory**：各自的实现方式和存储位置
- [ ] **能描述 Memory 读写流程**
- [ ] **能解释向量检索原理**：Embedding + 余弦相似度 + top-K
- [ ] **能画出 D16-D18 完整信息管线**
- [ ] **知道 Muse 的 Memory 工具列表**
- [ ] **完成 oc14 Prompt 组装链走读**

### 面试题积累（2 题）

**Q1: Agent 的记忆系统怎么设计？存什么？怎么检索？**

> 你的回答：___
>
> 参考：三层：短期=对话历史(内存)、长期=Episodic(事件)+Semantic(偏好)(向量库)、程序=System Prompt(代码)。检索：用户消息→embedding→向量相似度→top-K→注入Context。

**Q2: Muse 现在的 Memory 有什么可以改进的？**

> 你的回答：___
>
> 参考：可以加自动摘要（对话结束自动提取关键信息存入Semantic Memory），加记忆衰减（旧记忆权重降低），加用户可控性（用户能查看/删除记忆）。

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
