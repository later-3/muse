# Mastra PDF 专题 (1/4) — Principles 上篇：Agent 基础与工具

> **日期：** 2026-05-04（Mon）
> **路线图位置：** 专题加餐 · Mastra Agent PDF 课（第 1 天，共 4 天）
> **定位：** 🟥 精通级（今天 1.5h = 45min 理论 + 35min 走读 + 10min 自检）
> **PDF 来源：**
> - `user/reference/principles_2nd_edition_updated.pdf`
> - `user/reference/Patterns for Building AI Agents_1.pdf`

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **Mastra 视角下的 Agent 到底是什么？** 和普通的一次性 LLM 调用差在哪里？
2. **为什么 Tool 设计是 Agent 工程里最重要的一步？** 工具数量、命名、描述、Schema 会怎么影响效果？
3. **Memory / Dynamic Agent / Middleware 这三层分别解决什么问题？** 它们为什么是生产级 Agent 的基础件？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（Principles Ch4-Ch9） | 45min | [ ] |
| 2 | 📖 复习 → `unit01-agent-core/study/01e-leaders-react-weng.md` | 10min | [ ] |
| 3 | 📂 走读 → `unit01-agent-core/oc-tasks/L2-understand/oc05-muse-callchain.md` | 25min | [ ] |
| 4 | 📂 走读 → `unit01-agent-core/oc-tasks/L3-analyze/oc06-aci-audit.md` | 10min | [ ] |
| 5 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 🗺️ 本专题 4 天课程地图

| 天数 | 主题 | 对应 PDF 重心 | 对应主线节点 |
|---|---|---|---|
| Day 1 | Agent 基础与工具 | `Principles` Ch4-Ch9 | N10 Agent 核心 |
| Day 2 | MCP / Workflow / RAG / Multi-Agent | `Principles` Ch10-Ch29 | N11 + N12 |
| Day 3 | 架构演化与 Context Engineering | `Patterns` Part I-II | N10 + N11 |
| Day 4 | Evals / Security / Production | `Patterns` Part III-IV | N12 + 生产化 |

> 这套专题课是 **补全 Mastra 体系**，不是替代你原来的 42 天主线。
> 已有 `study/` 和 `oc-tasks/` 的内容不重写，今天只补这两本 PDF 里的增量洞察。

---

## 📖 知识精华（AI 为你提炼）

> 今日主读：`Principles of Building AI Agents` 第 4-9 章。  
> 核心特点：这本书讲的是 **Mastra 眼中的 Agent 工程“基础件”**，不是抽象概念，而是从框架作者视角告诉你哪些积木最先搭。

### 📚 参考锚点

- `[ref-pri-04]` Principles Ch4 `Agents 101`
- `[ref-pri-05]` Principles Ch5 `Model Routing and Structured Output`
- `[ref-pri-06]` Principles Ch6 `Tool Calling`
- `[ref-pri-07]` Principles Ch7 `Agent Memory`
- `[ref-pri-08]` Principles Ch8 `Dynamic Agents`
- `[ref-pri-09]` Principles Ch9 `Agent Middleware`

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **Agent** | 有角色、有上下文、能调工具的 LLM 系统 | 不是“一次调用”，而是“持续做事的 AI 员工” | 高自治 Agent 细节 |
| **Tool Schema** | 给模型看的工具说明书 | 名称、描述、参数决定它会不会用对 | 各家 API 细节 |
| **Structured Output** | 让模型按 Schema 返回 JSON | 让 LLM 进入“系统接口模式” | Pydantic/Zod 差异 |
| **Working Memory** | 当前用户/任务相关的持久特征 | 像 ChatGPT 记住“你是谁” | 存储后端实现 |
| **Dynamic Agent** | 运行时可变配置的 Agent | 根据用户、场景、权限切 Prompt / Tool / Model | 多租户策略 |
| **Middleware** | Agent 外围的运行时拦截层 | 做鉴权、护栏、输入输出清洗 | 中间件框架差异 |

### 第一性原理：Agent 不是“更长的 Prompt”

[ref-pri-04] 这本书把 Agent 讲得很直白：

- **普通 LLM 调用** 更像一次性外包：
  - `输入 → 模型 → 输出 → 结束`
- **Agent** 更像一个 AI 员工：
  - 有固定角色
  - 维护上下文
  - 可以使用工具
  - 能持续处理多步任务

Mastra 这里强调 **自治水平是连续谱**，不是二元开关：

| 自治层级 | 表现 | 适用场景 |
|---|---|---|
| 低自治 | 在决策树里做少量二元选择 | 表单分类、简单路由 |
| 中自治 | 有记忆、会调工具、会重试 | 大多数生产 Agent |
| 高自治 | 会规划、拆子任务、管理任务队列 | 复杂编程 Agent / 研究 Agent |

**今天的关键判断：** 你现在在 Muse 里最该精通的是 **中自治 Agent**，因为它最贴近真实生产系统。

### Model Routing + Structured Output：从“聊天”进入“系统”

[ref-pri-05] 的价值不是“会切模型”，而是两件事：

1. **模型路由** 让你可以低成本实验
   - 同一套 Agent 逻辑可以换 provider/model
   - 避免 SDK 锁死
   - 更容易做 A/B 和成本优化
2. **结构化输出** 让 LLM 产出可编排的中间状态
   - 文本回答适合给人看
   - JSON / Schema 适合给程序继续处理

**一句话理解：**

- `natural language` 是给用户看的接口
- `structured output` 是给工作流和工具层看的接口

这也是为什么 Workflow、Tool Calling、Evaluator 都强依赖结构化输出。

### Tool Calling：这本书最重要的一章之一

[ref-pri-06] 明确说了一个很硬的判断：

> **Tool design is the most important step.**

这句话和 Anthropic 的 ACI 思路是同一条线，但 `Principles` 更偏工程拆解：

1. 先列出你真正需要的操作
2. 再把这些操作变成工具
3. 最后才开始写 Agent

#### 为什么工具设计比 Prompt 更关键？

因为 Prompt 决定“怎么想”，Tool 决定“能做什么”。

| 维度 | Prompt 设计差 | Tool 设计差 |
|---|---|---|
| 后果 | 回答风格差、推理绕 | 根本做不成事、乱调用、失败链变长 |
| 修复方式 | 调词、加例子 | 重构接口、改参数、改描述 |
| 对生产影响 | 中 | 高 |

#### PDF 给出的 3 个直接建议

- **名称语义化**：`multiplyNumbers` 比 `doStuff` 好
- **描述具体**：不仅告诉模型“这工具做什么”，还要告诉它“什么时候该用”
- **输入输出 Schema 明确**：越像稳定 API，模型越不容易误用

#### Alana 的例子很值得记

她一开始把整批书都塞进上下文里，效果差。后来把任务拆成多个清晰工具：

- 查询投资人书单
- 按流派取书
- 按推荐人类型筛选

结果是：

- 任务从“模糊聊天”变成“可分析操作”
- Agent 像分析师，而不是像背书机

**工程含义：**
如果一个人类分析师会先做 5 步查询，那你的 Agent 也应该有 5 个清晰操作，而不是 1 个“万能工具”。

### Agent Memory：不是把聊天记录全塞回去

[ref-pri-07] 对 Memory 的重点是 **选择性上下文**。

#### 这本书里的 3 个关键点

1. **Working Memory**
   - 保存用户长期特征、偏好、背景
   - 类似“我知道你是谁”
2. **Hierarchical Memory**
   - 最近消息 + 相关长期记忆一起取
   - 不是全量回放，而是按当前问题检索
3. **Memory Processors**
   - 在进入模型前先压缩和过滤
   - 这是把 Memory 真正工程化的关键

#### Mastra 书里特别点名的两个处理器

- `TokenLimiter`
  - 超 token 时删最旧消息
- `ToolCallFilter`
  - 不把冗长的工具调用历史直接送回模型

这 2 个点非常重要，因为它们和你前面学的 N11 Context Engineering 直接接轨：

- Memory 不是“存储问题”
- Memory 本质上是“上下文预算分配问题”

### Dynamic Agent：让同一个 Agent 在运行时变形

[ref-pri-08] 讲的是一个很实用的生产问题：

- 你不想为每个用户等级、语言、权限都复制一份 Agent
- 但你又希望 Agent 能根据场景改变行为

于是 Dynamic Agent 出现了。

它可以在运行时动态决定：

- `instructions`
- `model`
- `tools`
- 甚至一些权限边界

#### 最适合你的理解方式

Dynamic Agent 不是 Multi-Agent。

| 概念 | 本质 |
|---|---|
| **Dynamic Agent** | 同一个 Agent 在运行时切配置 |
| **Multi-Agent** | 多个独立 Agent 分工协作 |

如果只是“同一角色，不同用户等级差异”，优先 Dynamic Agent。  
如果是“客服 / 研究 / 代码审查是不同工种”，再考虑 Multi-Agent。

### Middleware：把运行时安全和规则放在 Agent 外围

[ref-pri-09] 说得很对：

- 真正的鉴权、授权、护栏
- 最好放在 Agent 的 **外围**
- 不要完全依赖 Agent 自己“记住不要乱来”

#### Middleware 最适合承载的 2 类事情

1. **Guardrails**
   - 防 prompt injection
   - 防越权请求
   - 防 PII 泄露
   - 防跑题烧 token
2. **Authentication / Authorization**
   - 哪些用户能访问这个 Agent
   - 这个 Agent 又能访问哪些资源

**一句话记忆：**
Prompt 是软约束，Middleware 是硬边界。

### 今天最该吸收的 5 个工程结论

1. **Agent = 持续做事的系统，不是一次性问答。**
2. **工具设计优先级高于 Prompt 微调。**
3. **Memory 的本质是“按需取回”，不是“全量回放”。**
4. **Dynamic Agent 解决配置分叉，不等于多 Agent。**
5. **安全、鉴权、护栏要放在外围中间层。**

### 这几个概念不要混

- **Structured Output ≠ Tool Calling**：前者是结构化回答，后者是调用外部能力
- **Memory ≠ 聊天历史**：聊天历史只是候选数据，Memory 是检索和压缩后的上下文
- **Dynamic Agent ≠ Multi-Agent**：一个是运行时变参，一个是多角色协作
- **Guardrail ≠ System Prompt**：Guardrail 是拦截机制，Prompt 只是指导语

---

## 🔧 实践任务

### 任务 1：Muse 调用链里找 Tool 设计痕迹

> 📂 去看 → `unit01-agent-core/oc-tasks/L2-understand/oc05-muse-callchain.md`

**USOLB 标注：** `[S]` `[O]` `[L]`

做完要回答：

1. Muse 当前的工具注册点在哪里？
2. 工具描述里哪些信息在影响模型选工具？
3. 如果某个工具总被误调，是 Prompt 问题还是 ACI 问题？

### 任务 2：用 ACI 视角复查 Muse 工具

> 📂 去看 → `unit01-agent-core/oc-tasks/L3-analyze/oc06-aci-audit.md`

做完要回答：

1. 哪个工具名最容易让模型误解？
2. 哪个参数是“内部实现细节”，不该暴露给模型？
3. 哪个错误信息不利于模型自修复？

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 路径 | 作用 |
|---|---|---|
| ReAct + Weng | `unit01-agent-core/study/01e-leaders-react-weng.md` | 复习 Agent 循环和三大组件 |
| BEA | `unit01-agent-core/study/01a-study-anthropic-bea.md` | 和今天的 Tool / 架构设计互相印证 |
| ACI 审计 | `unit01-agent-core/study/01-muse-aci-audit.md` | 把 PDF 里的工具原则压回 Muse |

---

## 🧠 与 Muse/项目 的映射

- **本地代码实际做的事：**
  - `src/core/engine.mjs`：把一次次模型调用串成 Agent 行为
  - `src/core/identity.mjs`：System Prompt / persona / 运行指导
  - `src/core/memory.mjs`：Memory 读取、筛选、注入
  - `src/mcp/`：外部工具能力面
- **今天学完后你该多一层判断：**
  - 工具调不对，先查 ACI，不要先怪模型
  - Context 太长，先查 Memory Processor / 注入链，不要先加大模型
  - 同一 Agent 要服务不同用户，先想 Dynamic Agent，不要先复制 4 份配置
  - 敏感能力放 Middleware / 权限层，不要只靠 Prompt 写“禁止”

---

## ✅ 自检清单

- [ ] **能解释 Agent 和普通 LLM 调用的区别**
- [ ] **能说出中自治 Agent 的 3 个常见能力：记忆 / 工具 / 重试**
- [ ] **能解释为什么 Tool 设计优先于 Prompt 微调**
- [ ] **能说出 Structured Output 的作用**
- [ ] **能解释 Working Memory 和 Hierarchical Memory**
- [ ] **知道 `TokenLimiter` 和 `ToolCallFilter` 解决什么问题**
- [ ] **能区分 Dynamic Agent 和 Multi-Agent**
- [ ] **知道 Middleware 最适合放什么：鉴权 / guardrails / 权限**
- [ ] **完成 oc05 + oc06 走读**

### 面试题积累（2 题）

**Q1：如果你要提高一个 Agent 的稳定性，你会优先改 Prompt、改 Tool，还是改模型？为什么？**

> 你的回答：___
>
> 参考：优先看 Tool 设计。因为 Tool 决定 Agent 能做什么、怎么做、何时做。名称、描述、参数、错误输出都会直接影响成功率。Prompt 是第二层优化，模型切换通常更晚。

**Q2：Dynamic Agent 适合什么场景？和 Multi-Agent 的边界在哪里？**

> 你的回答：___
>
> 参考：同一个任务角色，但用户等级、语言、权限、地区不同，优先 Dynamic Agent。只有当任务本身已经分裂成不同角色和不同工具链，才升级到 Multi-Agent。

---

## 📝 学习笔记

✅ 理论：
✅ 关键洞察：
❓ 问题：
💡 映射：
