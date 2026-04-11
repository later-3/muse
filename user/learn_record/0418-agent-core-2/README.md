# D11 — N10 Agent 核心 (2/3)

> **日期：** 2026-04-18（Fri）
> **路线图位置：** Week 2 · Day 11 · N10 Agent 核心（第 2 天，共 3 天）
> **定位：** 🟥 精通级（今天 1.5h = 45min 理论 + 45min 实践）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **Tool Use 在工程上是怎么实现的？** LLM 怎么"知道"要调用哪个工具？参数怎么传？
2. **Weng 博客的 Agent 架构和实际代码是怎么对应的？** Planning/Memory/Action 分别落在代码的哪里？
3. **Agent 的失败模式有哪些？** 工具调用失败、无限循环、幻觉 — 怎么防御？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（Tool Use 的工程实现） | 30min | [ ] |
| 2 | 📖 复习 → `unit01-agent-core/study/01e-leaders-react-weng.md` | 10min | [ ] |
| 3 | 📂 oc05 Muse 调用链走读（见下方） | 45min | [ ] |
| 4 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 吴恩达 Agentic AI Module 2 (Tool Use) + Weng 博客深读 + 李宏毅 Agent 互动/OpenClaw 中提炼的核心知识。
> 今天聚焦：**Tool Use 的工程细节 + Agent 的失败模式 + 调用链走读**。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **Function Calling** | LLM 生成结构化的工具调用指令 | LLM 说"我要调用 search(query='天气')"，系统去执行 | 各家 API 的格式差异 |
| **Tool Schema** | 工具的定义描述（名称、参数、说明） | 相当于工具的"说明书"，LLM 看着说明书决定用哪个 | JSON Schema 细节 |
| **ACI (Agent-Computer Interface)** | Agent 和工具之间的接口设计 | 像 UI/UX 是给人看的，ACI 是给 LLM 看的 | MCP 协议规范 |
| **Guardrails** | 防止 Agent 做出危险行为的护栏 | 限制 Agent 能调用哪些工具、确认敏感操作 | 具体的限制策略 |
| **Error Recovery** | Agent 工具调用失败后的恢复策略 | 工具报错了怎么办？重试？换个方法？ | 重试策略的算法 |

### Tool Use 的完整工程实现

[Fact] 当你调用支持 Function Calling 的 LLM API 时，工作流程是这样的：

**Step 1：定义工具（开发者写）**
```json
{
  "type": "function",
  "function": {
    "name": "search_web",
    "description": "搜索互联网获取最新信息。当用户问的问题需要实时数据时使用。",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "搜索关键词"
        }
      },
      "required": ["query"]
    }
  }
}
```

**Step 2：LLM 决策（模型做）**

LLM 收到用户问题 + 工具列表 → 输出格式化的工具调用：

```json
{
  "tool_calls": [{
    "id": "call_abc123",
    "type": "function",
    "function": {
      "name": "search_web",
      "arguments": "{\"query\": \"北京今天天气\"}"
    }
  }]
}
```

**Step 3：执行工具（系统做）**
```
系统解析 tool_calls → 调用真实函数 → 拿到结果
search_web("北京今天天气") → "北京今天晴，25度，AQI 42"
```

**Step 4：结果回填（继续对话）**
```json
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "北京今天晴，25度，AQI 42"
}
```

LLM 看到工具结果后，生成最终回答。

**关键洞察：**
- LLM 不执行工具 — 它只**生成调用指令**（JSON 格式）
- 系统负责**解析和执行** — Agent 框架的核心工作
- 工具结果作为新消息**回填到对话历史** — LLM 在下一轮"看到"结果

### ACI — "给 LLM 用的 UX"

[Fact] Anthropic 在 BEA 中提出了 ACI（Agent-Computer Interface）的概念：

> "Think about how you'd design the UI for a human user, then apply those same principles to your tool definitions."

好的 ACI 设计：

| 原则 | 做法 | 反例 |
|------|------|------|
| **名称清晰** | `search_web`、`read_file` | `func1`、`do_thing` |
| **描述精准** | "搜索互联网获取实时信息" | "搜索" |
| **参数最少** | 只暴露必要参数 | 暴露所有内部配置 |
| **错误信息有用** | "文件不存在: /path/to/file" | "Error code 404" |
| **幂等安全** | 多次调用结果一样 | 每次调用有副作用 |

> 📖 详细的 ACI 审计方法已在 → `unit01-agent-core/study/01-muse-aci-audit.md`

### Agent 的失败模式与防御

[Fact] Agent 在实际运行中的常见失败：

**1. 工具调用失败**
```
问题：API 超时、参数错误、权限不足
防御：
  - 每个工具调用加超时限制
  - 返回结构化错误信息（让 LLM 能理解错误并换方案）
  - 最大重试次数（通常 2-3 次）
```

**2. 无限循环 (Infinite Loop)**
```
问题：Agent 反复做同一件事，不收敛
防御：
  - 最大循环次数限制（如 20 轮）
  - 循环检测：连续 N 次同一工具调用 → 强制中断
  - Token 消耗限制
```

**3. 幻觉工具调用 (Hallucinated Tool)**
```
问题：LLM 调用了不存在的工具，或编造了工具参数
防御：
  - 严格校验 tool_calls 中的函数名是否在工具列表中
  - 用 JSON Schema 校验参数格式
  - 返回明确错误："工具 'xxx' 不存在，可用工具有：..."
```

**4. 连锁失败 (Cascading Failure)**
```
问题：步骤 A 的错误结果输入给步骤 B → 错误放大
防御：
  - 每步结果的合理性检查
  - 失败时回滚到上一个已知状态
```

[Fact] 李宏毅在 LH26_01（OpenClaw）中展示了真实的失败处理：

> "如果語音辨識結果跟文字不一樣，就重新生成語音。這種 TTS_check 就是 Agent 的自我修正機制。"

### Weng 架构的代码映射

[Fact] 把 Weng 的三大组件映射到真实代码：

**Planning（规划）**
```
理论：分解任务、制定步骤
代码：System Prompt 中的指令 + LLM 的输出
Muse：src/core/identity.mjs 中加载的 SOUL.md/IDENTITY.md
      → 定义了 Agent 的行为规范和任务模板
```

**Memory（记忆）**
```
理论：短期记忆 + 长期记忆 + 工作记忆
代码：
  短期 = 对话历史（messages 数组）
  长期 = src/core/memory.mjs（跨会话持久化）
  工作 = 当前 prompt 中的中间结果
```

**Action/Tool（行动/工具）**
```
理论：调用外部功能
代码：
  工具注册 = src/mcp/（MCP 工具服务器）
  工具调用 = LLM API 返回 tool_calls → 解析执行
  结果回填 = 工具结果作为 tool message 加入对话历史
```

### 吴恩达 M2 — 工具使用的实战要点

[Fact] 吴恩达在 Module 2 中强调：

**工具数量的 tradeoff：**
- 工具太少 → Agent 能力不足
- 工具太多 → LLM 选择困难，容易选错
- 实践建议：**5-15 个工具**是常见区间。超过 20 个需要工具分组或二级路由

**工具描述是最重要的 Prompt Engineering：**
- 工具的 `description` 实际上是给 LLM 的 prompt
- 好的描述让 LLM 知道**什么时候**用这个工具
- 差的描述 → LLM 乱调用

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "External tools can be seen as extending the capabilities of LLMs." — Weng | 工具 = LLM 的"手和脚"。LLM 自己只有"大脑"。 |
| "Think about how you'd design the UI for a human user." — Anthropic BEA | 给 LLM 设计工具接口，和给人设计 UI 是一样的道理。 |
| "TTS_check — 如果語音辨識結果不對，就重新生成。" — 李宏毅 LH26_01 | Agent 的自我修正能力：做完 → 检查 → 不对就重来。 |

### 🎤 面试追问链

```
Q1: Tool Use 在技术上是怎么实现的？
→ 你答: 开发者定义 tool schema → LLM 输出 JSON 格式的调用指令 → 系统执行 → 结果回填到对话历史
  Q1.1: LLM 怎么知道该用哪个工具？
  → 你答: 工具的 name + description 放在 System Prompt 中。LLM 根据语义匹配选择最合适的工具。
    Q1.1.1: 工具太多怎么办？
    → 你答: 工具分组或二级路由。先让 LLM 判断类别（如"搜索类"/"代码类"），再展示该类下的具体工具。

Q2: Agent 有哪些常见的失败模式？
→ 你答: 四种：工具调用失败、无限循环、幻觉工具调用、连锁失败
  Q2.1: 怎么防止无限循环？
  → 你答: 最大轮次限制 + 重复检测 + Token 预算限制
```

### 这几个概念不要混

- **Function Calling ≠ Agent 自主决策**：Function Calling 是 API 层面的格式支持；Agent 是用这个能力构建的完整系统
- **Tool Schema ≠ API 文档**：Tool Schema 是给 LLM 看的精简描述；API 文档是给人看的详细说明
- **ACI ≠ API**：ACI 是针对 LLM 优化的接口设计哲学；API 是具体的技术实现
- **重试 ≠ 错误恢复**：重试是同样的方法再做一次；错误恢复可能换一种方法

### 关键概念清单

- [ ] **Function Calling 流程**：定义工具 → LLM 输出调用指令 → 系统执行 → 结果回填
- [ ] **Tool Schema 设计**：名称清晰、描述精准、参数最少
- [ ] **ACI 原则**：给 LLM 用的 "UX" 设计
- [ ] **4 种失败模式**：工具失败 / 无限循环 / 幻觉工具 / 连锁失败
- [ ] **Weng → 代码映射**：Planning=Identity / Memory=memory.mjs / Action=MCP
- [ ] **工具数量 tradeoff**：5-15 个区间，过多需要分组

---

## 🔧 实践任务：oc05 Muse 调用链走读

> 📂 已有文件，去看 → `unit01-agent-core/oc-tasks/L2-understand/oc05-muse-callchain.md`

**USOLB 标注：** `[S] 源码` `[O] 观察` `[L] 日志`

**任务说明：**
1. 阅读 oc05 文档，跟踪一次完整的 Muse 消息处理流程
2. 标注出 Agentic Loop 的每个阶段在代码中的位置
3. 找到工具调用（MCP）发生的位置 — 和今天学的 Function Calling 对应

**和今天理论的联系：**
- oc05 中你看到的"消息进入 → LLM 调用 → 工具执行 → 回填 → 再次 LLM 调用"就是今天学的 Tool Use 完整流程
- 找到 `tool_calls` 的解析代码 = 理解 Step 2 在 Muse 中怎么实现

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| 吴恩达 Agentic AI M2 | https://www.deeplearning.ai/courses/agentic-ai/ | Module 2: Tool Use |
| Weng Blog | https://lilianweng.github.io/posts/2023-06-23-agent/ | Action/Tool 部分 |
| OpenAI Function Calling 文档 | https://platform.openai.com/docs/guides/function-calling | API 格式参考 |

> 📖 **已有 study 文档，优先读：**
> - `unit01-agent-core/study/01e-leaders-react-weng.md` — ReAct + Weng ✅
> - `unit01-agent-core/study/01-muse-aci-audit.md` — Muse ACI 审计 ✅

---

### 补充资源 — 李宏毅知识包

- [LH26_01_openclaw_agent — 解剖 OpenClaw](../../reference/courses/lee-hongyi/knowledge/LH26_01_openclaw_agent.md)
  - 核心价值：真实 Agent 的工具链拆解 + 失败处理（TTS_check）
- [LH26_02b_agent_interaction — Agent 互动](../../reference/courses/lee-hongyi/knowledge/LH26_02b_agent_interaction.md)
  - 核心价值：多 Agent 协作模式、Agent 间通信

---

## 🧠 与 Muse/项目 的映射

- **本地代码实际做的事：**
  - `src/mcp/` — MCP 工具服务器 = 今天学的 Tool Schema + 执行层
  - `src/core/engine.mjs` — 解析 LLM 返回的 `tool_calls` → 调度执行 → 回填结果
  - `src/core/orchestrator.mjs` — 管理 Agentic Loop 的循环次数和终止条件
- **远端模型/外部系统做的事：**
  - LLM API 的 `tools` 参数 = 传入工具定义列表
  - LLM 在响应中包含 `tool_calls` = Agent 的 Action 决策
- **和明天的关系：** D12 聚焦 BEA 编排模式的深入 + oc06 ACI 审计，把今天学的 Tool Use 应用到具体的 Muse 工具审计中

---

## ✅ 自检清单

- [ ] **能完整描述 Function Calling 流程**：4 步（定义→决策→执行→回填）
- [ ] **能解释 ACI 的设计原则**：名称清晰、描述精准、参数最少
- [ ] **能列出 4 种失败模式**：及对应防御措施
- [ ] **能把 Weng 架构映射到 Muse 代码**：哪个文件对应哪个组件
- [ ] **完成 oc05 走读**：标注出工具调用在代码中的位置

### 面试题积累（2 题）

**Q1: 请描述 LLM Function Calling 的完整流程。LLM 真的在"执行"工具吗？**

> 你的回答：___
>
> 参考：不是。LLM 只生成 JSON 格式的调用指令（工具名+参数）。系统解析指令并执行，结果回填到对话历史，LLM 在下一轮看到结果后继续。

**Q2: 如果一个 Agent 反复调用同一个工具但结果不变，你怎么处理？**

> 你的回答：___
>
> 参考：这是无限循环的信号。防御：1) 连续重复检测（N次同一调用→中断） 2) 最大轮次限制 3) 返回明确提示让 LLM 知道"再试也没用，换个方法"

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
