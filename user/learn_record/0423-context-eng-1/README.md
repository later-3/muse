# D16 — N11 Context 工程 (1/3)

> **日期：** 2026-04-23（Wed）
> **路线图位置：** Week 3 · Day 16 · N11 Context 工程（第 1 天，共 3 天）
> **定位：** 🟥 精通级（今天 1.5h = 45min 理论 + 45min 实践）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **Context Engineering 到底是什么？** 和 Prompt Engineering 有什么区别和联系？
2. **Context Window 的信息是怎么组装的？** 一个完整的 LLM 请求包含哪些层次的 Context？
3. **Context 太长怎么办？** Compaction（压缩）的主要策略有哪些？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（CE 原理 + Context 组装） | 40min | [ ] |
| 2 | 📂 oc12 参数实验（见下方） | 45min | [ ] |
| 3 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 李宏毅 [Context Engineering](https://youtu.be/urwDLyNa9FU) + [CE 讲](https://youtu.be/lVdajtNpaGI) + Anthropic / OpenAI 的 CE 最佳实践中提炼。
> 今天是 Context 工程三天的第一天：**CE 定义 + Context 组装 + Compaction 策略**。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **Context Engineering (CE)** | 管理 LLM 输入信息的完整工程学科 | Prompt Engineering 的升级版 — 不只是"怎么问"，而是"给模型看什么" | CE 和 RAG 的交叉 |
| **Context Window** | LLM 一次能处理的最大 token 数 | 模型的"工作台大小"：128K token ≈ 一本书 | 位置编码的影响 |
| **System Prompt** | 定义模型角色和行为的隐藏指令 | Agent 的"灵魂设定" | 不同模型的 System Prompt 处理差异 |
| **Compaction（压缩）** | 把过长的 Context 压缩到 Window 内 | 把一本书压成摘要再给模型看 | 具体的摘要算法 |
| **Grounding** | 用外部事实约束 LLM 的输出 | "根据以下文档回答"而非"你知道什么就说什么" | RAG vs Fine-tuning |

### 🌍 背景：为什么要学这个？

**承接 D10-D12 Agent 核心 + D13-D15 Reasoning：** 你已经理解了 Agent 的循环和 LLM 的推理能力。但 Agent 的每一轮对话，**LLM 到底看到了什么？** 这就是 Context Engineering 要解决的问题。

[Fact] 李宏毅在 LH26_02 中定义：

> "Context Engineering 就是在有限的 Context Window 中，放入正確的資訊，讓模型能夠做出正確的判斷。"

> "所謂的 Prompt Engineering 只是 Context Engineering 的一小部分。Context Engineering 還包括 Memory、Tool Results、RAG 結果等所有被放進 Context 的東西。"

**技术栈位置：**
```
D10-12 Agent 核心        D13-15 Reasoning        D16 CE ← 你在这里
─────────────           ─────────────           ──────────
Agent = LLM+工具+循环    推理 = 大脑质量          Context = 大脑看到的信息
                                                 "给对了信息" = 能力的关键
```

### 🧑‍🔬 关键人物与事件

| 时间 | 人物/团队 | 做了什么 | 为什么重要 |
|------|----------|---------|-----------|
| 2022 | OpenAI | ChatGPT + System Prompt | 让"角色设定"成为标准实践 |
| 2023 | 多家 | 128K+ Context Window | 从 4K 扩展到 128K，Context 工程变得可行 |
| 2024 | Anthropic | Claude 200K Context | 最长的商用 Context Window |
| 2025.6 | Tobi Lütke (Shopify CEO) | 提出 "Context Engineering" 一词 | 把 CE 从 Prompt Engineering 中独立出来 |
| 2025 | 李宏毅 | LH26_02 CE 系统讲座 | 学术界的系统化 CE 框架 |

### 第一性原理：Context Engineering 到底是什么？

> ⚠️ 第一性原理 ≠ 一句话定义。

**Layer 0 — LLM 只能看到 Context**

[Fact] LLM 没有持久记忆、没有实时知识、没有自我意识。它能做什么，**100% 取决于 Context Window 里放了什么**。

```
LLM 的世界 = Context Window
不在 Context 里的信息 = 不存在
```

**Layer 1 — Context 里有什么？**

[Fact] 一个完整的 LLM 请求中，Context 通常包含（从高到低优先级）：

```
┌─────────────────────────────────────────┐
│ 1. System Prompt（身份设定 + 行为规则）    │ ← 开发者写
│    "你是 Muse，一个社交 Agent..."         │
├─────────────────────────────────────────┤
│ 2. 工具定义（Tool Schema）                │ ← 自动注入
│    [{name: "search", params: {...}}]     │
├─────────────────────────────────────────┤
│ 3. 检索结果 / RAG 文档                    │ ← RAG 系统注入
│    "根据以下文档回答: ..."               │
├─────────────────────────────────────────┤
│ 4. 对话历史                              │ ← 自动累积
│    User: "..." Assistant: "..." ...     │
├─────────────────────────────────────────┤
│ 5. 当前用户消息                           │ ← 用户输入
│    "帮我分析这份报告"                     │
└─────────────────────────────────────────┘
    ↑ 总共不能超过 Context Window 限制
```

**Layer 2 — CE 的核心问题**

[Fact] Context Window 是有限的（即使 128K 也有上限）。CE 要解决三个核心问题：

| 问题 | 说明 | 策略 |
|------|------|------|
| **放什么？** | 哪些信息对当前任务有用？ | 检索、过滤、优先级排序 |
| **怎么放？** | 信息的格式和位置怎么影响效果？ | 结构化、位置优化 |
| **放不下怎么办？** | Context 超过 Window 限制？ | 压缩、摘要、分页 |

**Layer 3 — 完整定义**

Context Engineering = 在 LLM 有限的 Context Window 中，**选择、组织、压缩和投递正确的信息**，使模型能够做出当前任务所需的最佳决策的工程学科。

### CE 的形式化框架

[Fact] 李宏毅在 LH26_02 中提出的形式化：

```
Context = f(Task, Memory, Tools, Knowledge)

其中:
  Task     = 用户的当前请求
  Memory   = 历史交互记忆（短期 + 长期）
  Tools    = 可用工具的定义
  Knowledge = 外部知识（RAG 检索结果）

CE 的目标: max Quality(LLM(Context))
CE 的约束: len(Context) ≤ Context_Window_Size
```

### Context 组装的实际流程

[Fact] 以 Muse 为例，一次请求的 Context 组装：

```python
# 伪代码：engine.mjs 的 Context 组装流程
def build_context(user_message):
    context = []
    
    # 1. System Prompt（固定，~2K tokens）
    context.append(load_identity())  # SOUL.md + IDENTITY.md
    
    # 2. 工具定义（每个工具 ~200 tokens，10个 = ~2K）
    context.append(format_tools(mcp_tools))
    
    # 3. 长期记忆（~1K tokens）
    context.append(load_memory())  # 用户偏好/历史摘要
    
    # 4. 对话历史（可变，可能 0-50K tokens）
    history = get_conversation_history()
    context.append(history)
    
    # 5. 当前消息（~100 tokens）
    context.append(user_message)
    
    # 检查总 token 数，超出则压缩
    if count_tokens(context) > MAX_CONTEXT:
        context = compact(context)  # ← Compaction!
    
    return context
```

### Compaction — Context 压缩策略

[Fact] 当 Context 超过 Window 限制时的处理策略：

#### 策略 1：截断（Truncation）
```
保留最新的 N 条消息，丢弃最旧的
优点: 简单、快速
缺点: 丢失重要的早期信息（如用户的初始需求）
```

#### 策略 2：摘要压缩（Summarization）
```
用 LLM 把旧对话压缩成摘要
"之前的对话摘要: 用户在讨论 Transformer 架构，已经理解了 QKV 机制..."
优点: 保留关键信息
缺点: 需要额外的 LLM 调用（成本 + 延迟）
```

#### 策略 3：滑动窗口 + 锚点（Sliding Window + Anchors）
```
固定保留: System Prompt + 第一条消息 + 最近 N 条
中间的旧消息被压缩或丢弃
优点: 兼顾"初始目标"和"当前上下文"
这是很多 Agent 框架的默认策略
```

#### 策略 4：语义检索（Semantic Retrieval）
```
不按时间保留，按相关性检索
用 embedding 找到和当前问题最相关的历史消息
优点: 保留最相关的信息
缺点: embedding 质量影响效果
```

### CE vs Prompt Engineering — 范围的区别

| 维度 | Prompt Engineering | Context Engineering |
|------|-------------------|-------------------|
| 范围 | 只关注"怎么写 prompt" | 管理所有进入 Context 的信息 |
| 对象 | System Prompt + User Message | 还包括 Tool Schema、RAG、Memory、历史 |
| 时机 | 请求前（静态设计） | 请求时 + 运行时（动态组装） |
| 技术 | 文字技巧（CoT、Few-shot） | 工程系统（检索、压缩、路由） |
| 类比 | 写考题 | 给考生准备整个考场（桌椅、白板、参考书...） |

### 举例 + 发散

**数值例子：Context 预算分配**

假设 Context Window = 128K tokens，一个复杂 Agent 任务的分配：

```
System Prompt:         3,000 tokens  (2.3%)  ← 固定开销
Tool Definitions:      2,500 tokens  (2.0%)  ← 10个工具
RAG Documents:        20,000 tokens  (15.6%) ← 检索到的文档
Conversation History: 80,000 tokens  (62.5%) ← 对话历史（主要开销！）
Current Message:         500 tokens  (0.4%)
Safety Buffer:        22,000 tokens  (17.2%) ← 留给模型输出
─────────────────────────────────────
Total:               128,000 tokens  (100%)
```

**对话历史占 62.5%** — 这就是为什么 Compaction 如此重要。多轮对话后，历史消息会迅速耗尽 Context Window。

> **类比（仅类比）：** Context Window 就像工作台。桌子就这么大 — 摆太多参考书就没地方写答案了。CE = 决定桌上放什么书、怎么摆、旧的怎么收起来。

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "Context Engineering 就是在有限的 Context Window 中放入正確的資訊。" — 李宏毅 LH26_02 | 有限的桌面上摆对的书 |
| "Prompt Engineering 只是 CE 的一小部分。" — 李宏毅 LH26_02 | "怎么写问题"只是 CE 的冰山一角 |
| "The model doesn't know what it doesn't see." — Anthropic 工程实践 | 不在 Context 里 = 不存在 |

### 🎤 面试追问链

```
Q1: Context Engineering 和 Prompt Engineering 有什么区别？
→ 你答: PE 只关注怎么写 prompt。CE 管理所有进入 Context 的信息：System Prompt + Tool Schema + RAG + Memory + History。CE 是 PE 的超集。
  Q1.1: Context 太长怎么办？
  → 你答: 4种策略：截断/摘要压缩/滑动窗口+锚点/语义检索。实践中常用"保留首尾+摘要中间"。
    Q1.1.1: 摘要压缩的成本怎么样？
    → 你答: 需要额外一次 LLM 调用来做摘要。可以用小模型做（便宜但质量稍差），或在后台异步做。

Q2: 一个 Agent 的 Context Window 里有哪些内容？
→ 你答: 5层：System Prompt / Tool Definitions / RAG Documents / Conversation History / Current Message。历史消息通常占60%+。
```

### 这几个概念不要混

- **Context Engineering ≠ Prompt Engineering**：PE 是写好 prompt 的技巧，CE 是管理所有 Context 的工程学科
- **Context Window ≠ Memory**：Context Window 是一次请求的上限（临时），Memory 是跨会话的持久化存储
- **Compaction ≠ Tokenization**：Compaction 是压缩信息内容（语义层面），Tokenization 是文字→数字编码（格式层面）
- **RAG ≠ Fine-tuning**：RAG 在 Context 中注入外部知识（运行时），Fine-tuning 把知识写入模型参数（训练时）

### 关键概念清单

- [ ] **CE 的定义**：管理所有进入 Context 的信息的工程学科
- [ ] **Context 5 层结构**：System / Tools / RAG / History / Message
- [ ] **CE 三个核心问题**：放什么 / 怎么放 / 放不下怎么办
- [ ] **4 种 Compaction 策略**：截断 / 摘要 / 滑动窗口+锚点 / 语义检索
- [ ] **CE vs PE**：超集关系
- [ ] **Context 预算分配**：历史消息占 60%+，Compaction 至关重要

---

## 🔧 实践任务：oc12 参数实验

> 📂 已有文件，去看 → `unit02-prompt-eng/oc-tasks/L1-observe/oc12-param-experiment.md`

**USOLB 标注：** `[U] 使用` `[O] 观察` `[B] 编译`

**任务说明：**
1. 实验不同 temperature / max_tokens 参数对 LLM 输出的影响
2. 观察 Context 长度变化对回答质量的影响
3. 和今天的理论关联：参数是 CE 的一部分 — 它们影响"模型怎么处理 Context"

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| 李宏毅 CE | https://youtu.be/urwDLyNa9FU | 全程 — CE 的定义和框架 |
| 李宏毅 CE 讲 [LH25F] | https://youtu.be/lVdajtNpaGI | CE + Agent + Reasoning 关系 |

> 📖 **已有 study 文档：**
> - `unit02-prompt-eng/study/04a-prompt-architecture.md` — 七层 Prompt ✅

---

### 补充资源 — 李宏毅知识包

- [LH26_02_context_engineering — Context Engineering 完整框架](../../reference/courses/lee-hongyi/knowledge/LH26_02_context_engineering.md)
  - 核心价值：CE 形式化定义 + Context 组装算法 + 信息选择策略
- [LH25F_02_context_agent — CE + Agent + Reasoning](../../reference/courses/lee-hongyi/knowledge/LH25F_02_context_agent.md)
  - 核心价值：三个概念如何交织

---

## 🧠 与 Muse/项目 的映射

- **本地代码实际做的事：**
  - `src/core/engine.mjs` — Context 组装的核心逻辑：加载 Identity + 注入工具列表 + 拼接历史
  - `src/core/identity.mjs` — System Prompt 的来源（SOUL.md / IDENTITY.md）
  - `src/core/memory.mjs` — 长期记忆注入 Context 的实现
- **远端模型/外部系统做的事：**
  - LLM API 接收完整 Context（messages 数组）→ 在内部做 tokenization 和处理
  - 如果超过模型的 Context Window → 返回错误
- **为什么 Agent 开发者需要知道这个：**
  - **Context 质量决定 Agent 质量** — 给对信息 > 给多信息
  - Muse 的 engine.mjs 就是今天学的 Context 组装管线的实现
- **和后续的关系：** D17 MCP（工具注入 Context）→ D18 Memory（记忆注入 Context）→ D19 RAG（知识注入 Context）

---

## ✅ 自检清单

- [ ] **能定义 CE**：管理所有进入 Context 的信息的工程学科
- [ ] **能画出 Context 5 层结构**
- [ ] **能列出 4 种 Compaction 策略**：各自的优缺点
- [ ] **能区分 CE 和 PE**：超集关系
- [ ] **能估算 Context 预算分配**：历史消息通常占 60%+
- [ ] **完成 oc12 参数实验**

### 面试题积累（2 题）

**Q1: 一个 Agent 的对话越来越长，Context Window 快满了，你怎么处理？**

> 你的回答：___
>
> 参考：4种策略选组合：1)保留首尾消息（锚点）2)中间消息用LLM做摘要 3)按语义相关性检索保留最相关的 4)工具返回值做截断。实践中常用"锚点+摘要"。

**Q2: Context Engineering 和 Prompt Engineering 有什么区别？为什么要区分？**

> 你的回答：___
>
> 参考：PE只关注"怎么写prompt"（静态设计），CE管理所有进入Context的信息（动态组装）。区分因为Agent系统中Context的大部分不是人写的prompt，而是自动注入的Tool/RAG/Memory/History。

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
