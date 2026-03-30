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

---

## 📂 目录结构

```
user/
├── README.md              ← 你正在看（唯一入口 + 准则）
│
├── SYLLABUS.md            ← 📋 30 天学习大纲（总日历 + 知识地图 + 全景汇总）
│
├── foundations/            ← Part 0: 大模型基础（按需查，不通读）
│   ├── INDEX.md               知识层级图 + Unit 速查表
│   ├── F1  ✅ LLM 全貌
│   ├── F2-F15 [占位]           Transformer / 训练 / Tokenization / ...
│
├── unit01-agent-core/     ← Part 1: Agent 核心循环
├── unit02-multi-agent/    ← Part 2: 多 Agent 协作
├── unit03-state-memory/   ← Part 3: 状态 + 记忆
├── unit04-prompt-eng/     ← Part 4: Prompt 工程
│   每个 unit 包含:
│     📖 study/          学习文档（AI 深加工的精读材料）
│     🤖 experiments/    AI 并行实验 + 消险报告
│     🔧 oc-tasks/       OC 实战任务（Bloom 递进 + USOLB）
│     🏗️ 里程碑          Muse + 学习助手的对应进度
│     ✅ 通关检查         理论 + OpenCode + 项目 + 面试
│
├── review/                ← 🎯 复习 + 面试冲刺
│   ├── week1-3-cards.md      每周面试卡片
│   ├── interview-master.md   全覆盖 50+ 题库
│   └── muse-mapping.md       Muse 全栈知识映射
│
├── reference/             ← 📚 知识源头
│   ├── INDEX.md              参考资料总索引 (书/课/论文/博客/项目)
│   ├── SOURCE_MAP.md         源材料分类映射
│   └── repos/                12 个参考项目 (gitignored)
│
├── projects/              ← 支线项目
│   └── learning-assistant/   语音学习助手
│
├── track/                 ← 项目管理（归档参考）
│   └── map.md                知识-功能全景图
│
└── archive/               ← 归档
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
| **W2** | Agent 核心 + Prompt 工程 | unit01 + unit04 | oc01-11 + oc27-32 |
| **W3** | 多 Agent + 状态记忆 | unit02 + unit03 | oc12-26 |
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
