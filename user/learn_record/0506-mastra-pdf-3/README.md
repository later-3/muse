# Mastra PDF 专题 (3/4) — Patterns 上篇：架构演化与 Context Engineering

> **日期：** 2026-05-06（Wed）
> **路线图位置：** 专题加餐 · Mastra Agent PDF 课（第 3 天，共 4 天）
> **定位：** 🟥 精通级（今天 1.5h = 50min 理论 + 25min 走读 + 10min 自检）
> **PDF 来源：** `user/reference/Patterns for Building AI Agents_1.pdf`

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **为什么 `Patterns` 说“原则是概念，模式是手感”？** 它补了 `Principles` 没讲透的哪一层？
2. **Agent 架构应该怎么从白板演化到生产？** 什么时候拆 Agent，什么时候加 Router，什么时候做 HITL？
3. **2025 年之后的 Context Engineering 最重要的 5 个失败模式是什么？** 它们为什么比“token 不够”更本质？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（Patterns Part I-II） | 50min | [ ] |
| 2 | 📖 复习 → `unit01-agent-core/study/01a-study-anthropic-bea.md` | 10min | [ ] |
| 3 | 📂 走读 → `unit02-prompt-eng/oc-tasks/L2-understand/oc14-prompt-assembly.md` | 15min | [ ] |
| 4 | 📂 走读 → `unit04-state-memory/oc-tasks/L2-understand/oc29-compaction-walkthrough.md` | 10min | [ ] |
| 5 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 今日主读：`Patterns for Building AI Agents` Part I-II。  
> 如果说 `Principles` 是“积木说明书”，那 `Patterns` 就是“实际项目里哪些坑会先踩到”。

### 📚 参考锚点

- `[ref-pat-01]` Patterns Ch1 `Whiteboard Agent Capabilities`
- `[ref-pat-02]` Patterns Ch2 `Evolve Your Agent Architecture`
- `[ref-pat-03]` Patterns Ch3 `Dynamic Agents`
- `[ref-pat-04]` Patterns Ch4 `Human-in-the-Loop`
- `[ref-pat-05]` Patterns Ch5 `Parallelize Carefully`
- `[ref-pat-06]` Patterns Ch6 `Share Context Between Subagents`
- `[ref-pat-07]` Patterns Ch7 `Avoid Context Failure Modes`
- `[ref-pat-08]` Patterns Ch8 `Compress Context`
- `[ref-pat-09]` Patterns Ch9 `Feed Errors Into Context`

### 为什么你必须读 `Patterns`

这本书开篇有一句很关键：

> **Principles are conceptual, patterns are pragmatic.**

翻成工程话：

- `Principles` 讲“应该有哪些模块”
- `Patterns` 讲“这些模块上线后最常见的坏姿势是什么”

所以这本书更像：

- 架构演化备忘录
- Context Engineering 事故手册
- 生产经验的压缩包

### Pattern 1：先白板列能力，再分组，不要直接写 Mega-Agent

[ref-pat-01] 给了一个很强的实践顺序：

1. 把你想让 Agent 做的事全写出来
2. 按相似能力分组
3. 看自然边界在哪

作者给出的分组依据非常实用：

- 来自同一数据源
- 近似同一岗位职责
- 可能共用同一 API
- 属于同一业务阶段

#### 这一步为什么关键？

因为很多团队失败，不是模型不够强，而是 **问题切分错了**。

一个 Mega-Agent 常见症状：

- 工具越来越多
- Prompt 越来越长
- 成功标准越来越模糊
- 出错后不知道算哪个模块的锅

### Pattern 2：Agent 架构是“长出来”的，不是一次设计完的

[ref-pat-02] 给了一个 8 步演化流程，我建议你背下来：

1. 列出任务
2. 先抓最痛的问题
3. 把这一个 Agent 做好
4. 看用户接下来还问什么
5. 如果是独立需求，就新建 Agent
6. 如果原 Agent 太臃肿，就拆
7. 有多个 Agent 之后，再加 routing
8. 继续循环

这 8 步的核心哲学是：

- **先有单点价值**
- **再有结构演化**
- **最后才有系统架构**

#### 这和 BEA 的一致点

你会发现它和 Anthropic 的 “Start Simple” 完全一致：

- 不是一开始就上多 Agent
- 而是单 Agent 不够用之后再拆

### Pattern 3：Dynamic Agent 解决个性化，不解决组织分工

[ref-pat-03] 和 `Principles` 的 Dynamic Agent 章节相互印证，但这本书更强调现实：

- 用户真的千差万别
- 同一个 Agent 在不同用户面前，不该完全一样

可动态变化的内容包括：

- Prompt
- Tool 集合
- Memory 策略
- 模型选择

**适用信号：**

- 会员等级不同
- 地区/语言不同
- 用户意图明显不同
- 审批阈值不同

**不适用信号：**

- 已经是不同工种
- 已经需要不同成功标准
- 已经需要独立 traces / evals

这时就该拆 Agent，而不是继续“动态化”。

### Pattern 4：Human-in-the-Loop 不是妥协，是风险控制

[ref-pat-04] 的隐含意思很重要：

- 自治越强，风险越高
- 不是所有动作都该全自动

HITL 最适合放在这 3 类节点：

1. **高代价动作前**
   - 发邮件
   - 提交 PR
   - 改数据库
2. **高不确定判断处**
   - 法务判断
   - 复杂医疗建议
3. **关键方向切换时**
   - 计划确认
   - 大规模执行前

这和你后面要学的 suspend/resume、planning mode、guardrail 会自然连起来。

### Pattern 5-6：并行不是越多越好，共享上下文才是关键

[ref-pat-05] 和 `[ref-pat-06]` 纠正了一个很常见误区：

> **并行化不等于变强。**

#### 这本书强调的风险

多个 subagent 并行工作时，最容易出现：

- 各做各的
- 输出互相矛盾
- 最后很难拼起来

书里举的例子很形象：

- A 代理做了一个红按钮
- B 代理如果只知道“做了红按钮”
- 它不知道为什么是红色，就可能把别的元素做歪

如果 B 能看到：

- 原始用户请求
- 品牌色研究
- 用户批准记录

它就知道“为什么这个按钮必须是红的”。

**结论：**

- 并行前先问：任务真的可独立吗？
- 并行后再问：共享上下文了吗？

### Pattern 7：Context Engineering 的 5 大失败模式

[ref-pat-07] 是这本书最值钱的章节之一。

作者说，到了 2025 年，大家逐渐意识到：

- 上下文越大，不代表效果越好
- context 不是免费午餐

#### 5 个最关键的失败模式

| 失败模式 | 含义 | 典型后果 |
|---|---|---|
| **Context poisoning** | 错误或幻觉被反复带入上下文 | 错误越滚越大 |
| **Context distraction** | 上下文太长，模型被信息淹没 | 忽视真正重点 |
| **Context confusion** | 混入无关上下文 | 输出发散、答非所问 |
| **Context clash** | 新旧上下文相互冲突 | 行为前后不一致 |
| **Context rot** | 长上下文下注意力退化 | 100k+ 后关键信息找不到 |

#### 书里给的真实数据很重要

Gemini 团队在 Pokemon Agent 上发现：

- 约 `125K tokens` 开始明显退化
- 虽然模型 nominal context window 更大

修复方式是：

- RAG 过滤 top-K
- 上下文裁剪工具
- 用结构化中间状态组装 prompt

准确率从 `34%` 提升到 `90%+`

**这说明：**
大窗口不是免设计许可证。

### Pattern 8：Compress Context 是必须做的系统能力

[ref-pat-08] 把压缩策略讲得非常系统。

#### 常见压缩策略

- 每一步都压缩
- 到窗口容量 `x%` 再压缩
- 删最旧上下文
- 递归摘要
- 在 token-heavy 工具之后压缩
- Agent 交接边界做 handoff summary

#### 书里给的两个工程例子

1. **Claude Code**
   - 到 `95%` 容量时自动 compact
2. **Mastra**
   - 用 `TokenLimiter`
   - 用 `ToolCallFilter`
   - 或自定义 `MemoryProcessor`

这和你现有主线 N11 完全接上：

- Compaction 不是“锦上添花”
- 它是长任务 Agent 的基本生命维持系统

### Pattern 9：错误要回灌进上下文，Agent 才会自修复

[ref-pat-09] 给了编程 Agent 一个非常重要的模式：

- 执行失败
- 不要只记录日志然后崩
- 要把错误消息、相关代码、上下文一起回喂模型
- 让下一轮决策利用这些错误

书里列举的几个 coding agent 都在做这件事：

- Cursor
- Windsurf
- Replit Agent
- Lovable

**一句话理解：**

错误不是终点，错误是下一轮推理的素材。

这对 Muse 也非常有启发：

- 工具报错不能只是 stderr
- 要变成 Agent 看得懂的结构化反馈

### 今天最该吸收的 6 个工程结论

1. **先白板能力，再决定 Agent 边界。**
2. **系统架构靠迭代长出来，不靠一开始画巨图。**
3. **并行要谨慎，subagent 之间上下文共享比并行本身更重要。**
4. **Context 的敌人不是“不够大”，而是“混乱和退化”。**
5. **Compaction 是生产级 Agent 的基础设施。**
6. **错误回灌是 Agent 自修复闭环的起点。**

### 这几个概念不要混

- **Dynamic Agent ≠ Router**：一个是变配置，一个是分流请求
- **Parallelization ≠ Multi-Agent**：并行只是执行方式，不代表角色真的分工清楚
- **Long Context ≠ Good Context**：大窗口不等于高质量上下文
- **Summary ≠ Compression Quality**：摘要能变短，不等于保住了关键决策信息
- **Error Logging ≠ Error Feedback**：记日志给人看，回灌上下文给 Agent 看

---

## 🔧 实践任务

### 任务 1：Prompt 组装链里找“Context clash / confusion”

> 📂 去看 → `unit02-prompt-eng/oc-tasks/L2-understand/oc14-prompt-assembly.md`

做完要回答：

1. Muse 的 Prompt 组装链上，哪些信息来源可能互相冲突？
2. 哪些上下文是“应该放”，哪些是“其实只是噪音”？
3. 如果 Prompt 越来越长，最先该压缩哪一层？

### 任务 2：从 Compaction 角度看状态维护

> 📂 去看 → `unit04-state-memory/oc-tasks/L2-understand/oc29-compaction-walkthrough.md`

做完要回答：

1. 当前的 compact 触发点是什么？
2. 是按 token 阈值触发，还是按阶段边界触发？
3. compact 后最怕丢掉哪类信息？

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 路径 | 作用 |
|---|---|---|
| BEA 5 种编排 | `unit01-agent-core/study/01a-study-anthropic-bea.md` | 和今天的架构演化互证 |
| Prompt Architecture | `unit02-prompt-eng/study/04a-prompt-architecture.md` | 补 Prompt 结构层 |
| Memory & Vectors | `unit04-state-memory/study/03a-memory-and-vectors.md` | 补 Compaction / Recall |

---

## 🧠 与 Muse/项目 的映射

- **白板能力分组**
  - 可用于重新审视 Muse 未来的角色边界：聊天、记忆、执行、观察、审批
- **架构演化**
  - Muse 不该一开始就追多 Agent 宏图，而应从单 Agent 强化到 planner/executor
- **Context failure modes**
  - Muse 的 persona、memory、tool result、system rules 都可能产生 clash/confusion
- **Compression**
  - 现有 memory / compaction 逻辑决定长对话质量上限
- **Feed errors**
  - Muse 的工具错误和插件错误应该进入结构化反馈，而不是只留在日志里

---

## ✅ 自检清单

- [ ] **能说出白板分组的 4 个依据**
- [ ] **能背出架构演化的 8 步流程**
- [ ] **知道什么时候该拆 Agent、什么时候只做 Dynamic 配置**
- [ ] **知道 HITL 最适合插在哪 3 类节点**
- [ ] **能说出并行化的主要风险：上下文不共享导致输出冲突**
- [ ] **能列出 5 个 Context failure modes**
- [ ] **知道 Pokemon Agent 的退化点大约在 125K tokens**
- [ ] **能说出至少 3 种 Context Compression 策略**
- [ ] **知道为什么错误回灌是自修复起点**

### 面试题积累（2 题）

**Q1：你怎么看“上下文越多越好”这句话？**

> 你的回答：___
>
> 参考：错。长上下文会带来 poisoning、distraction、confusion、clash、rot。真正关键的是高质量上下文，而不是大体积上下文。大窗口只是预算更大，不代表设计可以偷懒。

**Q2：如果一个 Multi-Agent 系统经常产出彼此冲突的结果，你第一反应查什么？**

> 你的回答：___
>
> 参考：先查上下文共享机制，而不是先换更强模型。看 subagent 是否拿到了完整背景、前序决策、用户批准、关键约束，再看任务是否真的适合并行。

---

## 📝 学习笔记

✅ 理论：
✅ 关键洞察：
❓ 问题：
💡 映射：
