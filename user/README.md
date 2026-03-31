# Muse 学习路线 — Later 的 AI Agent 修炼手册

> **30 天** · 4 个 Unit · 32 个 OC 任务 · 11 个 Muse 里程碑
> **终极目标：** AI Agent 技术大佬 + Muse 做好 + 有能力改 OpenCode

---

## 🚀 核心准则：放大你的一分钟

> [!IMPORTANT]
> **你的每一分钟，必须产出 10 倍价值。所有 AI 协作必须遵循。**

| AI 做什么（重活） | 你做什么（高价值） |
|------------------|-------------------|
| 读源码 → 提取精华 | 看精华 → 理解 → 能复述 |
| 读论文 → 摘要 + 图表 | 看图 → 理解逻辑 → 能口述 |
| 搭框架 → 注释 + 走读指南 | 走读 → 改参数验证 → 面试能讲 |
| 实验 + 消险 → 代码 + 报告 | 看报告 → 知道坑在哪 |

**6 条准则：**
1. AI 精华总结，你来吸收（不是"你去看 xxx"）
   - ✅ `[AI✓]` 状态才算交付，`[占位]` 不算
   - ❌ 反例：甩一个链接说"你自己去看"
2. 每篇文档 = 第一性原理 + 大白话 + 示例
   - ✅ 四层深度：是什么 / 怎么做到的 / 为什么 / 例子
   - ❌ 反例：只有结论没有推导
3. 边做边回顾（理论立即压回 Muse/OpenCode）
   - ✅ 学了理论 → 找到 Muse/OC 对应代码(文件+行号) → 能改的立即改
   - ❌ 反例：写了"Muse 映射"但从没改过代码
4. 保证质量（面试能用、开发能指导）
   - ✅ 每篇文档写完过 governance 检查清单
   - ❌ 反例：批量占位但不填内容
5. **OpenCode 是贯穿线 — USOLB 实践模型**
   - **U(使用):** 启动 OC/Muse，发消息，观察行为
   - **S(源码):** 读 OC/Muse 源码，标注理论对应的文件+行号
   - **O(观察):** 写 plugin/hook 拦截事件，打印中间状态
   - **L(日志):** 用 trace-reader / muse 日志观察全链路
   - **B(编译):** 改 OC/Muse 代码，跑起来看行为变化
   - ✅ 每个 OC 任务必须标注 `[U]` `[S]` `[O]` `[L]` `[B]`
   - ❌ 反例：自己造 Agent Loop 玩具，和 OpenCode 无关
6. 双轨并行，AI 先踩坑
   - ✅ AI 踩坑 = 在 OpenCode/Muse 真实系统上实验
   - ❌ 反例：AI 造了一个和项目无关的 demo
7. **依据参考资源做决策（不靠感觉）**
   - ✅ 每个知识点标注 `[ref-XX]`，能追溯到课程/论文/项目
   - ✅ 设计路线、排序、取舍都要对照 `reference/INDEX.md` 和 `reference/SOURCE_MAP.md`
   - ✅ unit 排序依据: C8/U2/G7/G5/Weng 等权威课程的教学顺序
   - ❌ 反例：凭感觉安排学习顺序，不对照权威课程

---

## 📂 目录结构 — 三条线分离

```
user/
├── README.md              ← 你正在看（唯一入口 + 7 条准则）
├── SYLLABUS.md            ← 📋 30 天学习大纲
│
│  ──── 🔧 OC 小任务（纯学习，27 个任务） ────
│  = unit 理论 + reference 课程 → 用 OpenCode/Muse 走一遍
│
├── unit01-agent-core/     ← Agent 核心循环
│   ├── study/                📖 学习文档
│   ├── oc-tasks/
│   │   ├── L1-observe/       oc01-03 观察启动/trace/hook
│   │   ├── L2-understand/    oc04-05 走读源码
│   │   ├── L3-analyze/       oc06-07 审计/分析
│   │   └── L5-synthesize/    oc10-11 对比/面试
│   └── README.md             通关清单
├── unit02-prompt-eng/     ← Prompt 工程
│   ├── study/
│   ├── oc-tasks/             L1→L3→L5 (oc12-15,17)
│   └── README.md
├── unit03-multi-agent/    ← 多 Agent 协作
│   ├── study/
│   ├── oc-tasks/             L1→L3→L5 (oc18-23,25)
│   └── README.md
├── unit04-state-memory/   ← 状态 + 记忆
│   ├── study/
│   ├── oc-tasks/             L1→L3→L5 (oc26-30,32)
│   └── README.md
│
│  ──── 🏗️ 主线: Muse 项目（5 个改进任务） ────
│  = OC 学到 → 改进 Muse src/ 代码
│
├── projects/
│   ├── muse-milestones/
│   │   ├── README.md         M1-M11 里程碑跟踪
│   │   ├── unit01/           oc08 写MCP工具 + oc09 ACI修复
│   │   ├── unit02/           oc16 Persona Prompt 改进
│   │   ├── unit03/           oc24 Handoff 超时修复
│   │   └── unit04/           oc31 Memory 改进
│   │
│   │── 🌊 支线: 学习助手（V0→V3） ────
│   │
│   └── learning-assistant/
│       ├── web/              前端代码
│       ├── server/           后端代码
│       └── README.md         设计文档
│
│  ──── 📚 基础 + 复习 + 参考 ────
│
├── foundations/            ← 大模型基础 (F1-F15)
├── review/                ← 面试冲刺 (卡片+题库)
├── reference/             ← 知识源头 (INDEX+SOURCE_MAP+repos/)
├── teardowns/             ← 🔬 优秀项目拆解（独立模块）
│   ├── README.md              拆解索引 + 方法论
│   ├── learn-claude-code/     T1: 44k⭐ Harness 12步
│   ├── nanobot/               T2: 37k⭐ 超轻量 OpenClaw
│   ├── claw0/                 T3: Always-on Agent
│   └── openclaw/              T4: 产品级 Agent
├── track/                 ← 项目管理（归档参考）
└── archive/               ← 归档
```

### 三条线的关系

```
unit 理论 + reference 课程/作业 (foundations + study + repos/)
  │
  │  课程里教什么，我们就用 OpenCode/Muse 走一遍
  │  (不是自己造玩具，是在真实系统上实践课程内容)
  ↓
🔧 OC 小任务 (unit/oc-tasks/)
  = unit 理论的 OpenCode/Muse 实战版
  = reference 课程作业的落地版
  = 用 USOLB 方法在真实系统上观察、走读、分析、改代码
  │
  │  在 OC 任务中发现的改进点 / 学到的能力
  ↓
🏗️ 主线: Muse 项目 (projects/muse-milestones/)
  = OC 任务的项目实践（学到 → 改进 Muse）
  例: oc06 ACI 审计 → M2 落地修复 src/mcp/

🌊 支线: 学习助手 (projects/learning-assistant/)
  = OC 任务能力的应用实践（学到 → 做新产品）
  例: oc08 写 MCP 工具 → S3 学习助手 V0
```

---

## 🎯 北极星

> **短期 (30 天):** AI Agent 技术大佬，面试随便聊
> **中期:** Muse 核心功能做好（会话/协作/记忆/Prompt）
> **长期 (S2b):** Muse 能自己发现问题 → 立项 → 修改代码 → 审查 → 汇报

---

## 📋 30 天路线总览

> **详见 `SYLLABUS.md`**

| Week | 主题 | 对应 Unit | OC 任务 |
|------|------|----------|--------|
| **W1** | 大模型基础 (LLM/Transformer/训练) | foundations F1-F13 | — |
| **W2** | Agent 核心 + Prompt 工程 | unit01 + unit02 | oc01-17 |
| **W3** | 多 Agent + 状态记忆 | unit03 + unit04 | oc18-32 |
| **W4** | 综合实战 + 面试冲刺 | review + 创造类 OC | 落地改进 + 面试故事 |

### OC 任务设计原则 (Bloom 认知层次递进)

```
Level 1 观察: 我看到它在工作          → 启动/日志/trace
Level 2 理解: 我知道它怎么工作        → 读源码/画调用链
Level 3 分析: 我能评判它做得好不好    → ACI审计/Prompt分析
Level 4 创造: 我能在它上面建新东西    → 写工具/改代码/修bug
Level 5 综合: 我能讲清楚、能设计新的  → 对比分析/面试STAR
```

### 全景数字

| 类别 | 数量 |
|------|------|
| OC 实战任务 | 32 个 (全部 USOLB + Bloom 递进) |
| Muse 里程碑 | 11 个 (M1-M11，每个有代码/文档产出) |
| 学习助手里程碑 | 6 个 (S1-S6，V0→V3) |
| Study 文档 | 12 篇 |
| Foundation 文档 | 15 篇 |
| 面试准备 | 4 个 STAR 故事集 + 50+ 题库 |

---

## 🔄 协作模式

```
AI 轨道:   🔧 搭框架+注释 → 🧪 先踩坑 → 📝 整理精华
你的轨道:  📖 走读理解 → 🔨 改参数验证 → 💬 面试复述
```

### 状态标记

| 标记 | 含义 |
|------|------|
| `[ ]` | 未开始 |
| `[AI✓]` | AI 已交付，你未吸收 |
| `[/]` | 你正在吸收 |
| `[x]` | 你已完成 |

---

## 📏 编号体系

| 编号 | 含义 | 例子 |
|------|------|------|
| Unit 01-04 | 知识单元 | Unit 01 = Agent Core |
| oc01-oc32 | OC 实战任务 | oc01 = 启动 Muse + 看日志 |
| M1-M11 | Muse 里程碑 | M1 = 理解全调用链 |
| S1-S6 | 学习助手里程碑 | S1 = Agent Loop 设计 |
| exp/R | AI 实验/消险 | exp01 = 编排模式模拟 |
| F1-F15 | 基础文档 | F1 = LLM 全貌 |
| W1-W4 | 周 | W2 = Agent 核心 |

---

## 📋 格式标准（所有文档必须遵循）

| 文档类型 | 规范文件 | 核心要求 |
|---------|---------|---------|
| 📖 学习文档 | `.agents/workflows/research-note.md` | 速读版 + 三栏原理表 + 面试题 |
| 🤖 AI 实验 | `.agents/workflows/ai-parallel-task.md` | JSDoc + 设计注释 + Muse 映射 |
| 📘 Unit README | `.agents/workflows/unit-oc-task.md` | Bloom 递进 + USOLB + 通关清单 |
| 📚 学习文档治理 | `.agents/workflows/learning-doc-governance.md` | 最高约束 |

### 三栏原理表（强制）

| 概念 | 能力来源（怎么获得的） | 激活方式（怎么触发的） | 类比（仅类比） |
|------|---------------------|---------------------| --------------|
| XXX | 预训练/RLHF/... | Prompt/微调/... | 像人的XXX（**仅类比**） |

---

## ⚠️ 注意事项

- 不修改 `AGENTS.md`（引擎规范）
- 引用外部代码必须标注来源和位置
- 类比永远标注"仅类比"，不写成原理定义
- 允许延期，不允许偏离目标
