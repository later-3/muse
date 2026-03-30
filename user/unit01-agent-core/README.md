# Unit 01: Agent 核心循环

> **终极目标关联：** AI Agent 技术大佬 + Muse 项目 + 有能力改 OpenCode
> **本单元终结目标 (TLO)：** 完成 unit01 后，Later 能——
> 1. 面试时 2 分钟讲清 Agent Loop + 5 种编排模式 + ACI 设计
> 2. 在 OpenCode 里找到 Agent Loop 的实现并看懂
> 3. 给 Muse 写新 MCP 工具并验证可用
> 4. 画出 Muse 从 Telegram 到 LLM 回复的完整调用链
>
> **底子来源：** [W5] Anthropic BEA + [W4] Weng Blog + [P6] ReAct 论文 + [U2] Berkeley CS294

---

### 📚 前置基础（碰到不懂来这里查）

| 看到什么不懂 | 去哪里 |
|------------|--------|
| LLM 怎么"规划"的 | `foundations/F1` §4 (CoT → R1 → o1) |
| 上下文窗口为什么有限 | `foundations/F2` §3 (Attention O(n²)) |
| Function Calling 怎么来的 | `foundations/F3` §2 (SFT 训练) |
| temperature=0.1 为什么 | `foundations/F6` §4 |
| XML 为什么比 JSON 可靠 | `foundations/F6` §2 |

---

## 学习目标（问句形式 — 学完能回答）

1. Agent 的核心循环是什么？（Reason → Action → Observe）
2. Agent 和 Workflow 本质区别是什么？（谁决定下一步：代码 vs LLM）
3. 5 种编排模式各自适合什么场景？
4. ACI 六原则是什么？和 HCI 有什么关系？
5. OpenCode 的 Agent Loop 具体在哪段代码？怎么跑的？
6. Muse 在 Weng 的三要素框架（Planning/Memory/Tools）里各处于什么位置？
7. 怎么给 Muse 加一个新工具？完整链路是什么？

---

## 📖 学习文档 → `study/`

> **推荐顺序：** 01a (BEA 核心) → 01e (Weng + ReAct) → 01b (项目分析) → 01c (代码精读)

| 文件 | 内容 | 底子来源 | 状态 |
|------|------|---------|------|
| `01a-study-anthropic-bea.md` | BEA 核心: Workflow vs Agent / 5 种模式 / ACI / Guardrails | [W5] BEA + `repos/anthropic-cookbook/` | [升级] ✅ |
| `01e-leaders-react-weng.md` | ReAct 循环 + Weng 三要素 + CoT进化链 | [W4] Weng + [P6] ReAct | [升级] ✅ |
| `01b-study-anthropic-bea-projects.md` | 开源项目分析 + 面试故事 | [G5] Cookbook + [G6] Swarm + [G13] Aider | [AI✓] |
| `01c-course-cookbook-workflows.md` | Cookbook 代码精读 + 课程对比 | `repos/anthropic-cookbook/patterns/agents/*` | [AI✓] |

---

## 🤖 AI 并行任务 → `experiments/`

> **AI 在真实系统上先踩坑，Later 吸收结论。**
> **代码规范：** 见 `.agents/workflows/ai-parallel-task.md`

### 已完成

| 类型 | 文件 | 结果 | 内容 |
|------|------|------|------|
| 🧪 | `exp01-chain-parallel-route.mjs` | 10/10 ✅ | 3 种编排模式 JS 模拟（理论理解辅助） |
| 🧪 | `exp01-chain-parallel-route.test.mjs` | 10/10 ✅ | Muse 场景测试 |
| 🔧 | `R1-notify-planner-reliability.md` | 5/10 | notify_planner 回调可靠性 |

### 待做

| # | 类型 | 验证什么 | 涉及源码 | 状态 |
|---|------|---------|---------|------|
| R2 | 🔧 | Muse handoff 超时场景分析 | `src/family/handoff.mjs` | [ ] |
| R3 | 🔧 | Muse 5 个 hook 覆盖率审计 | `src/plugin/hooks/*.mjs` | [ ] |

---

## 🔧 OC 实战任务 → `oc-tasks/`

> **原则：基于 OpenCode/Muse 实践理论，不造玩具。**
> **USOLB 模型：** `[U]`使用 `[S]`源码 `[O]`观察hook `[L]`日志trace `[B]`编译修改
> **协作模式：** AI 搭框架+注释 → Later 走读 → 改参数验证 → 面试能讲
>
> **设计原则 (Bloom 认知层次递进):**
> ```
> Level 1 观察: 我看到它在工作          → oc01 oc02 oc03
> Level 2 理解: 我知道它怎么工作        → oc04 oc05
> Level 3 分析: 我能评判它做得好不好    → oc06 oc07
> Level 4 创造: 我能在它上面建新东西    → oc08 oc09
> Level 5 综合: 我能讲清楚、能设计新的  → oc10 oc11
> ```

### Level 1: 观察 — "我看到 Agent 在工作"

> **目标：** 启动 OpenCode/Muse，亲眼看到 Agent Loop 在跑

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc01 | **启动 Muse + 发消息 + 看日志** — 启动一个 Muse member，给它发消息，观察 Muse 日志输出整个处理流程 | `[U][L]` | 01a §一 核心循环 | `src/index.mjs` → 日志 `data/logs/` | `oc01-muse-first-run.md` |
| oc02 | **trace-reader 全链路追踪** — 完成一次 Muse 交互后，用 trace-reader 看 events / tool-calls / traces 三种视图 | `[U][L]` | 01a §一 核心循环 + 01e §1 ReAct | `src/plugin/trace-reader.mjs` | `oc02-trace-analysis.md` |
| oc03 | **event hook 观察 Agent Loop 轮次** — 增强 event-logger，每轮打印: Turn N → LLM 想了什么 → 调了什么工具 → 结果是什么 | `[O][L]` | 01e §1.2 ReAct 循环 | `src/plugin/hooks/event-logger.mjs` | `oc03-loop-observer.mjs` |

### Level 2: 理解 — "我知道它怎么工作"

> **目标：** 读源码，理解 OpenCode session 循环 + Muse 的调用链

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc04 | **走读 OpenCode Session 源码** — 读 OC 的 session 创建 → 消息处理 → LLM 调用 → 工具执行 → 停止条件，每步标注对应 ReAct 的哪个阶段 | `[S]` | 01a §2.5 Agent 定义 + 01e §2 Weng 三要素 | KI: `opencode_core.md` | `oc04-session-walkthrough.md` |
| oc05 | **走读 Muse 调用链** — 从 Telegram 消息到达 → engine.mjs 路由 → OpenCode session 启动 → MCP 工具注册 → LLM 回复 → Telegram 返回，画完整时序图 | `[S]` | 全部 01a + 01e | `src/core/engine.mjs` → `src/adapters/telegram/` → `src/mcp/` | `oc05-muse-callchain.md` |

### Level 3: 分析 — "我能评判它做得好不好"

> **目标：** 用理论框架审计 Muse 现有实现

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc06 | **ACI 六原则审计 Muse MCP 工具** — 逐个审计 planner-tools.mjs + memory.mjs + callback-tools.mjs 的所有工具描述、参数定义、错误处理，给改进方案 | `[S][B]` | 01a §2.6 ACI + Poka-yoke | `src/mcp/planner-tools.mjs` `src/mcp/memory.mjs` `src/mcp/callback-tools.mjs` | `oc06-aci-audit.md` |
| oc07 | **Muse Prompt 注入链走读** — 完整追踪 prompt 组装路径: AGENTS.md → identity.mjs 读取 → system-prompt hook 注入 → OpenCode 拼接 → 发给 LLM | `[S][O]` | 01a §2.3 Augmented LLM | `src/core/identity.mjs` `src/plugin/hooks/system-prompt.mjs` | `oc07-prompt-chain.md` |

### Level 4: 创造 — "我能在它上面建新东西"

> **目标：** 实际修改/扩展 Muse 代码

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc08 | **写一个新 MCP 工具** — 给 Muse 加一个 `study_quiz` 工具（从 study docs 抽题考 Later），注册到 MCP，让 pua 能调 | `[B][U]` | 01a §2.3 Augmented LLM + §2.6 ACI | `src/mcp/dev-tools.mjs` (参照) → 新文件 | `oc08-new-mcp-tool.mjs` |
| oc09 | **改进 ACI — 落地审计结论** — 把 oc06 审计出的问题真正修复: 改工具描述、加参数 enum、改错误返回格式 | `[B]` | 01a §2.6 ACI (闭环!) | `src/mcp/planner-tools.mjs` (直接改) | `oc09-aci-fix.md` + 代码 PR |

### Level 5: 综合 — "我能讲清楚、能设计"

> **目标：** 把所有知识串起来，能面试讲 + 能指导设计

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc10 | **对比 Claude Code / Aider / OpenCode 的 Agent Loop** — 三个工业级 Agent 的循环实现对比: 停止条件 / 工具选择 / 错误重试 / 上下文管理 | `[S]` | 01a §2.5 + 01b 项目分析 | KI: OpenCode 架构 + `repos/aider/` + 在线 | `oc10-loop-comparison.md` |
| oc11 | **unit01 面试模拟 + STAR 故事** — 整理 unit01 的所有面试题 + 用 Muse 项目写 3 个 STAR 故事 (Agent Loop / ACI / 编排) | — | 01a-01e 全部 | — | `oc11-interview-stories.md` |

---

## 🏗️ 主线项目: Muse 里程碑

> **目标：unit01 结束后，Muse 有实际改进，不只是"理解了"**

| # | 里程碑 | 关联 OC | 状态 |
|---|--------|--------|------|
| M1 | **理解 Muse 全调用链** — 能画出 Telegram → engine → OC session → MCP → LLM 的完整时序图 | oc05 | [ ] |
| M2 | **ACI 审计 → 落地修复** — planner-tools.mjs 的工具描述实际改好 | oc06 → oc09 | [ ] |
| M3 | **新增 MCP 工具** — study_quiz 工具可用，pua 能调 | oc08 | [ ] |
| M4 | **可观测性增强** — event-logger 能打印每轮 Agent Loop 的 Reason/Action/Observe | oc03 | [ ] |

**验收标准：** M1-M4 全完成 = unit01 通关。每个 M 都有代码产出或文档产出。

---

## 🌊 支线项目: 学习助手 里程碑

> **目标：用 unit01 学到的理论设计学习助手的 Agent 架构**

| # | 里程碑 | 关联知识 | 状态 |
|---|--------|---------|------|
| S1 | **设计学习助手的 Agent Loop** — 确定: 用什么 LLM / 循环怎么跑 / 停止条件 | 01a §一 + 01e §1 ReAct | [ ] |
| S2 | **定义学习助手的工具清单** — 需要哪些 tools (查知识库/出题/评分/TTS)，按 ACI 设计 | 01a §2.6 ACI | [ ] |
| S3 | **V0 可跑 demo** — Web Speech → LLM → 回答 的最短路径 | 全部 unit01 | [/] |

---

## ✅ 通关检查 — unit01 做完对照

**理论掌握：**
- [ ] 能 2 分钟口述 Agent vs Workflow 的本质区别
- [ ] 能画出 5 种编排模式的示意图并说出各自适用场景
- [ ] 能解释 ReAct 为什么比纯 CoT 好（幻觉 vs Ground Truth）
- [ ] 能说出 ACI 六原则并举 Muse 的例子

**OpenCode 掌握 (USOLB)：**
- [ ] `[U]` 能启动 Muse 并用 trace-reader 看完整链路
- [ ] `[S]` 能说出 OpenCode session 循环的关键步骤对应 ReAct 哪个阶段
- [ ] `[O]` 能用 hook 观察到 Agent Loop 的每一轮
- [ ] `[L]` 能用日志定位一次交互走了几轮、调了什么工具
- [ ] `[B]` 能给 Muse 加一个新 MCP 工具并验证可用

**项目掌握：**
- [ ] Muse: 能画出完整调用链 (M1)
- [ ] Muse: planner-tools 的 ACI 已改好 (M2)
- [ ] Muse: 新 MCP 工具已可用 (M3)
- [ ] 学习助手: Agent Loop 设计已确定 (S1)

**面试掌握：**
- [ ] 准备了 3 个 Muse 相关的 STAR 故事 (oc11)
- [ ] 能对比 Claude Code / Aider / OpenCode 的 Agent Loop (oc10)
