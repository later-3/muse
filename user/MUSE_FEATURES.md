# Muse 功能点亮路线图

> **定位：** 随着理论学习和 OC 任务推进，Muse 的功能逐步"点亮"
> **用法：** 每完成一个 OC 任务或理论节点，回来勾选对应的功能项
> **关系：** THEORY_ROADMAP.md 告诉你"学什么" → 本文告诉你"Muse 怎么变强"

---

## 一、Muse 现有模块全景

> 基于 `src/` 实际代码的模块盘点。🟢=已实现 🟡=基础可用 🔴=未启动

```
src/
├── core/                    ← 大脑核心
│   ├── engine.mjs           🟢 对话引擎（调 OpenCode 生成回复）
│   ├── identity.mjs         🟢 身份/人格系统
│   ├── memory.mjs           🟡 记忆读写（有基础，待优化）
│   ├── orchestrator.mjs     🟢 请求编排器
│   ├── threads.mjs          🟢 对话线程管理
│   └── goals.mjs            🟡 目标追踪（有框架，待完善）
│
├── mcp/                     ← MCP 工具服务器
│   ├── memory.mjs           🟡 记忆读写工具（有，需 ACI 优化）
│   ├── planner-tools.mjs    🟢 规划器工具（创建/管理工作流）
│   ├── coder-bridge.mjs     🟢 代码桥接（调 OpenCode 写代码）
│   ├── callback-tools.mjs   🟢 回调工具（Agent 间通信）
│   ├── session-context.mjs  🟢 会话上下文
│   └── dev-tools.mjs        🟢 开发辅助工具
│
├── adapters/                ← 感知通道
│   └── telegram.mjs         🟢 Telegram 适配器（文字+语音+群组）
│
├── workflow/                ← 工作流引擎
│   ├── definition.mjs       🟢 工作流定义
│   ├── state-machine.mjs    🟢 状态机
│   ├── bridge.mjs           🟢 执行桥接
│   ├── gate-enforcer.mjs    🟢 门控确认
│   ├── registry.mjs         🟢 工作流注册
│   ├── loader.mjs           🟢 工作流加载
│   └── notify.mjs           🟢 通知机制
│
├── daemon/                  ← 后台守护
│   ├── cerebellum.mjs       🟢 小脑（定时任务调度）
│   ├── pulse.mjs            🟢 脉搏（心跳 + 主动触达）
│   ├── pulse-actions.mjs    🟢 脉搏动作定义
│   ├── pulse-state.mjs      🟢 脉搏状态
│   ├── self-check.mjs       🟢 自检
│   ├── thread-weaver.mjs    🟢 线程编织（话题持续性）
│   ├── anti-spam.mjs        🟢 反垃圾
│   ├── health-history.mjs   🟢 健康历史
│   └── health-insight.mjs   🟢 健康洞察
│
├── voice/                   ← 语音
│   ├── stt.mjs              🟡 语音转文字（基础可用）
│   └── tts.mjs              🟡 文字转语音（基础可用）
│
├── web/                     ← Web Cockpit
│   ├── api.mjs              🟢 Web API
│   ├── standalone.mjs       🟢 独立 Web 服务
│   └── cockpit/             🟢 管理面板
│
├── capability/              ← 能力路由
│   ├── router.mjs           🟢 能力路由器
│   └── registry.mjs         🟢 能力注册表
│
└── plugin/                  ← OpenCode 插件
    └── trace-reader.mjs     🟢 全链路追踪
```

---

## 二、功能点亮路线图

> 每个功能模块的改进，都有对应的理论支撑和 OC 任务。
> "点亮" = 你理解了理论 → 在 Muse 上验证 → 做出了改进

### 🔥 Phase 1: 理解现有（W1-W2）— 知道引擎怎么转

> 学完 N02/N06/N10 后，你理解了"模型是什么"和"Agent 怎么循环"

| # | 功能 | src/ 模块 | 理论支撑 | 点亮方式 | 状态 |
|---|------|----------|---------|---------|------|
| F1 | 理解 Muse 全调用链 | `index.mjs` → `core/engine.mjs` → `mcp/` | N02 N06 N10 | oc01 启动看日志 + oc02 trace 全链路 + oc05 走读调用链 | [ ] |
| F2 | 理解 Token 消耗模式 | `core/engine.mjs` | N02 N03 | 观察一次对话的 token 用量，对比中英文 | [ ] |
| F3 | 理解 Agent 循环 | `core/orchestrator.mjs` | N10 | oc03 event hook 观察 + oc04 走读 OC Session | [ ] |
| F4 | 理解 Prompt 注入链 | `core/identity.mjs` → engine | N09 N10 | oc07 注入链走读（系统 prompt 怎么拼接） | [ ] |
| F5 | 理解可观测性 | `plugin/trace-reader.mjs` | N10 N12 | oc02 跑 trace-reader，看懂输出 | [ ] |

**Phase 1 毕业标准：** 能画出 Muse 从接收消息到返回回复的完整流程图

---

### ⚡ Phase 2: 工具与 Prompt（W2-W3）— 让 Muse 更好用

> 学完 N10(Tools/MCP) + N09(Reasoning) + N11(Context) 后，你能改进具体功能

| # | 功能 | src/ 模块 | 理论支撑 | 点亮方式 | 状态 |
|---|------|----------|---------|---------|------|
| F6 | ACI 质量审计 | `mcp/*.mjs` 全部工具 | N10 (ACI) | oc06 审计 → 发现哪些工具描述不好 | [ ] |
| F7 | ACI 落地修复 | `mcp/*.mjs` | N10 (ACI) | **oc09** 修改工具定义 + 测试 | [ ] |
| F8 | 新增 MCP 工具 | `mcp/` 新文件 | N10 (Tool Use) | **oc08** 写一个新的 MCP 工具 | [ ] |
| F9 | Persona Prompt 优化 | `core/identity.mjs` | N09 (CoT) N11 | **oc16** 改进 Muse 的人格 prompt | [ ] |
| F10 | 参数实验 | `core/engine.mjs` | N09 | oc12 调 temperature/top-p 看效果变化 | [ ] |
| F11 | Prompt 组装链理解 | `core/identity.mjs` → `engine.mjs` | N11 (Context) | oc14 走读 prompt 怎么拼接的 | [ ] |

**Phase 2 毕业标准：** Muse 的工具描述通过 ACI 审计 + Persona 有明显改进

---

### 🧠 Phase 3: 多 Agent 协作（W4）— 让 Muse 能分工

> 学完 N10(Multi-Agent) + N12(评估) 后，你理解 Harness 编排

| # | 功能 | src/ 模块 | 理论支撑 | 点亮方式 | 状态 |
|---|------|----------|---------|---------|------|
| F12 | Harness 工作流理解 | `workflow/definition.mjs` + `state-machine.mjs` | N10 (Multi-Agent) | oc18 触发 Harness + oc20 走读三件套 | [ ] |
| F13 | Gate Enforcer 理解 | `workflow/gate-enforcer.mjs` | N10 (HITL) | 走读门控逻辑 — 为什么用户要确认 | [ ] |
| F14 | Planner 编排优化 | `mcp/planner-tools.mjs` | N10 (Orchestrator) | oc22 Harness vs BEA 审计 | [ ] |
| F15 | Handoff 改进 | `mcp/callback-tools.mjs` + `workflow/notify.mjs` | N10 (Handoff) | **oc24** 修复 Handoff 超时 | [ ] |
| F16 | 评估框架设计 | 新文件 | N12 | oc23 设计 Muse 评估指标 | [ ] |

**Phase 3 毕业标准：** 能设计一个多 Agent 工作流并解释编排策略

---

### 💾 Phase 4: 记忆系统（W5-W6）— 让 Muse 能记住

> 学完 N11(Context/Memory) + N05(推理优化) 后，你理解记忆架构

| # | 功能 | src/ 模块 | 理论支撑 | 点亮方式 | 状态 |
|---|------|----------|---------|---------|------|
| F17 | Memory 读写理解 | `core/memory.mjs` + `mcp/memory.mjs` | N11 (Memory) | oc26 观察读写 + oc28 走读源码 | [ ] |
| F18 | Compaction 理解 | `core/memory.mjs` compaction 部分 | N11 (Compaction) | oc27 触发 + oc29 走读 OC Compaction | [ ] |
| F19 | Memory 审计 | `core/memory.mjs` + `mcp/memory.mjs` | N11 N12 | oc30 审计记忆质量 | [ ] |
| F20 | Memory 改进 | `core/memory.mjs` | N11 N05 | **oc31** 改进记忆读写逻辑 | [ ] |
| F21 | 长对话性能理解 | `core/engine.mjs` + `core/threads.mjs` | N05 (KV Cache) | 理解为什么对话越长越慢 | [ ] |

**Phase 4 毕业标准：** Muse 的记忆系统有明确改进 + 能解释 Compaction 策略

---

### 🌟 Phase 5: 高级功能（W6+）— 让 Muse 进化

> 全部理论学完后的综合改进，长线持续迭代

| # | 功能 | src/ 模块 | 理论支撑 | 点亮方式 | 状态 |
|---|------|----------|---------|---------|------|
| F22 | Pulse 主动触达优化 | `daemon/pulse.mjs` + `pulse-actions.mjs` | N09 (Reasoning) | 让 Muse 的主动消息更"智能" | [ ] |
| F23 | Thread Weaver 改进 | `daemon/thread-weaver.mjs` | N11 (Context) | 优化话题持续性追踪 | [ ] |
| F24 | 自检系统增强 | `daemon/self-check.mjs` | N12 (Eval) | 增加自检维度 | [ ] |
| F25 | 语音交互升级 | `voice/stt.mjs` + `voice/tts.mjs` | — | 提升语音识别 + 生成质量 | [ ] |
| F26 | Goals 系统完善 | `core/goals.mjs` | N09 (Planning) | 目标分解 + 追踪 + 完成度 | [ ] |
| F27 | 能力路由智能化 | `capability/router.mjs` | N10 (Orchestrator) | 根据意图自动路由到正确能力 | [ ] |
| F28 | Web Cockpit 增强 | `web/` | — | 管理面板增加更多监控 | [ ] |

**Phase 5 无固定毕业标准** — 这是长期迭代，每次改进都是 Muse 的进化

---

## 三、功能点亮进度看板

> 用这个看板跟踪你的 Muse 功能点亮进度

```
Phase 1: 理解现有 ──────────── [ ][ ][ ][ ][ ]  0/5
Phase 2: 工具与Prompt ──────── [ ][ ][ ][ ][ ][ ]  0/6
Phase 3: 多Agent协作 ──────── [ ][ ][ ][ ][ ]  0/5
Phase 4: 记忆系统 ─────────── [ ][ ][ ][ ][ ]  0/5
Phase 5: 高级功能 ─────────── [ ][ ][ ][ ][ ][ ][ ]  0/7
                              ──────────────────────
                              总计: 0/28 功能点亮
```

### 与 6 周路线的对照

```
W1 ─── Phase 1 (F1-F5)     理解引擎
W2 ─── Phase 1 + Phase 2    理解 + 开始改进
W3 ─── Phase 2 (F6-F11)    工具和 Prompt 改进
W4 ─── Phase 3 (F12-F16)   多 Agent 协作
W5 ─── Phase 4 (F17-F21)   记忆系统
W6 ─── Phase 4 + Phase 5   记忆改进 + 高级功能启动
W6+ ── Phase 5 (F22-F28)   持续进化
```

---

## 四、功能点亮与 OC 任务/里程碑的完整映射

| 功能 | OC 任务 | Muse 里程碑 | 理论节点 | Week |
|------|---------|------------|---------|------|
| F1 全调用链 | oc01+02+05 | M1 | N02 N06 N10 | W1 |
| F2 Token消耗 | — | — | N02 N03 | W1 |
| F3 Agent循环 | oc03+04 | — | N10 | W1-2 |
| F4 Prompt注入链 | oc07 | M5 | N09 N10 | W2 |
| F5 可观测性 | oc02 | M4 | N10 N12 | W1 |
| F6 ACI审计 | oc06 | M2 (审计) | N10 | W2 |
| F7 ACI修复 | **oc09** | M2 (修复) | N10 | W5 |
| F8 新MCP工具 | **oc08** | M3 | N10 | W5 |
| F9 Persona优化 | **oc16** | M6 | N09 N11 | W5 |
| F10 参数实验 | oc12 | — | N09 | W3 |
| F11 Prompt组装链 | oc14 | M5 | N11 | W3 |
| F12 Harness理解 | oc18+20 | M7 | N10 | W4 |
| F13 Gate理解 | — | — | N10 | W4 |
| F14 Planner优化 | oc22 | M8 | N10 | W4 |
| F15 Handoff改进 | **oc24** | M8 M9 | N10 | W6 |
| F16 评估框架 | oc23 | — | N12 | W5 |
| F17 Memory理解 | oc26+28 | M10 | N11 | W5-6 |
| F18 Compaction | oc27+29 | — | N11 | W5-6 |
| F19 Memory审计 | oc30 | M11 (审计) | N11 N12 | W6 |
| F20 Memory改进 | **oc31** | M11 (改进) | N11 N05 | W6 |
| F21 长对话性能 | — | — | N05 | W4 |
| F22-F28 | — | — | 各 | W6+ |

> [!TIP]
> **加粗的 OC 任务 = 需要改 Muse 代码的任务**（非走读/观察类）。
> 共 5 个代码改动任务：oc08(新工具) · oc09(ACI修复) · oc16(Persona) · oc24(Handoff) · oc31(Memory)。
> 这 5 个改动完成后，Muse 会有本质性的提升。

---

## 五、里程碑验收标准

| 里程碑 | 验收方式 | 来源 |
|--------|---------|------|
| M1 理解全调用链 | 能画出完整流程图 | Phase 1 |
| M2 ACI 修复 | 工具描述通过审计清单 | Phase 2 |
| M3 新 MCP 工具 | 工具可被 Agent 正确调用 | Phase 2 |
| M4 可观测性 | trace-reader 能展示关键事件 | Phase 1 |
| M5 Prompt 注入链 | 能讲清 prompt 从哪来、怎么拼 | Phase 2 |
| M6 Persona 改进 | 对话风格有明显变化 + A/B 对比 | Phase 2 |
| M7 Harness 流程图 | 能画出多 Agent 协作流程 | Phase 3 |
| M8 Harness 审计 | 架构符合 BEA 设计原则 | Phase 3 |
| M9 Handoff 修复 | 多 Agent 任务不再超时 | Phase 3 |
| M10 Memory 理解 | 能讲清 Muse 怎么读写记忆 | Phase 4 |
| M11 Memory 改进 | 长对话记忆保持质量提升 | Phase 4 |
