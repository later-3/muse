# Muse 学习路线 — Later 的 AI Agent 修炼手册

> **4 个月** · 8 个 Sprint · 北极星：Muse 自开发闭环 (S2b)

---

## 🚀 核心准则：放大你的一分钟

> [!IMPORTANT]
> **你的每一分钟，必须产出 10 倍价值。所有 AI 协作必须遵循。**

| AI 做什么（重活） | 你做什么（高价值） |
|------------------|-------------------|
| 读源码 → 提取精华 | 看精华 → 理解 → 能复述 |
| 读论文 → 摘要 + 图表 | 看图 → 理解逻辑 → 能口述 |
| 跨项目对比 → 对照表 | 看表 → 判断哪个更好 |
| 实验 + 消险 → 代码 + 报告 | 看报告 → 知道坑在哪 |

**6 条准则：**
1. AI 精华总结，你来吸收（不是"你去看 xxx"）
2. 每篇文档 = 第一性原理 + 大白话 + 示例
3. 边做边回顾（理论立即压回 Muse）
4. 保证质量（面试能用、开发能指导）
5. OpenCode 是贯穿线（每天至少 1 个 OC 关联）
6. 双轨并行，AI 先踩坑

---

## 📂 目录结构

```
user/
├── README.md              ← 你正在看（唯一入口）
│
├── foundations/            ← Part 0: 大模型基础（前置知识）
│   ├── F1-llm-intro.md       Karpathy: LLM 全貌
│   ├── F2-build-gpt.md       Karpathy: Transformer 从零
│   ├── F3-state-of-gpt.md    Karpathy: 训练管线
│   ├── F9-distill-finetune.md 蒸馏/LoRA/3090
│   └── F10-local-deploy.md   GGUF/量化/部署
│
├── unit01-agent-core/     ← Part 1: Agent 核心循环
├── unit02-multi-agent/    ← Part 2: 多 Agent 协作
├── unit03-state-memory/   ← Part 3: 状态 + 记忆
├── unit04-prompt-eng/     ← Part 4: Prompt 工程
│
├── track/                 ← 项目管理（进度/看板）
│   ├── sprint-1.md ~ sprint-8.md
│   ├── ai-report.md          AI 并行任务看板
│   └── map.md                知识-功能全景图
│
└── archive/               ← 归档（历史文档）
```

---

## 🎯 北极星：S2b 自开发闭环

> Muse 能自己发现问题 → 立项 → 修改代码 → 审查 → 汇报给 Later

S1(会话记忆) + S2(任务协作) + S3(审批治理) = S2b 的基础设施

| 场景 | 一句话 | Sprint |
|------|--------|--------|
| S1 | 有性格有记忆的日常对话 | 6 |
| S2 | planner→worker 工作流 | 6 |
| S3 | 高风险动作审批 | 7 |
| **S2b** | **Muse 自开发自己** | **7** |

---

## 📚 学习路线

### Sprint → Phase → Unit 映射

| Sprint | Phase | 做什么 | 对应 Unit |
|--------|-------|--------|----------|
| **→ S1** | 0 | 理论：Agent Core + Multi-Agent | foundations + unit01-04 |
| S2 | 1 | 深化：Memory + Prompt + 工具 | unit03-04 扩展 |
| S3 | 3 | 实践：Spike 1(Core) + Spike 3(Handoff) | 代码 |
| S4 | 3 | 实践：Spike 2(Memory) + 场景锚定 | 代码 |
| S5 | 4 | 设计：Architecture v2 | make-muse/ |
| S6 | 5 | 实现：S1 + S2 | src/ |
| S7 | 5 | 实现：S3 + S2b | src/ |
| S8 | 6-7 | 收尾：Eval + Portfolio | 面试 |

### Unit 内容总览

| Unit | 主题 | 学习内容 | 实验 | 消险 |
|------|------|---------|------|------|
| **foundations** | 大模型基础 | F1-F3 Karpathy + F9 蒸馏 + F10 部署 | — | — |
| **unit01** | Agent 核心循环 | BEA + Cookbook + ReAct + Weng | exp01 链式/并行/路由 | R1 notify |
| **unit02** | 多 Agent 协作 | Orchestrator + OpenAI/Google + Swarm | exp02-04 | R2-R4 |
| **unit03** | 状态 + 记忆 | LangGraph + CrewAI + 角色系统 | exp05-06 | R5-R6 |
| **unit04** | Prompt 工程 | 7 层结构 + pua 骨架 | exp07 | — |

---

## 🔄 双轨并行模式

```
你的轨道:  📖 吸收 → 🎯 Muse任务 → ✏️ 沉淀
AI 轨道:   🧪 实验（巩固学习）+ 🔧 消险（服务 Muse）
```

### 每次对话 SOP（AI 必做）

```
1. 读本文件 → 了解背景
2. 看 track/sprint-X.md → 确认当前 Sprint，找第一个 [ ]
3. 告诉 Later："当前 Sprint X，今天任务是 XXX"
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
| S1-S4, S2b | 锚点场景 | S2b = 自开发闭环 |
| Phase 0-7 | RDD 阶段 | Phase 0 = 理论基础 |
| Sprint 1-8 | 双周迭代 | Sprint 1 → Phase 0 |
| Unit 01-04 | 知识单元 | Unit 01 = Agent Core |
| Spike 1-3 | 最小验证原型 | Spike 3 = Handoff |
| exp/R | AI 实验/消险 | exp01/R1 |

---

## 📋 格式标准（所有文档必须遵循）

| 文档类型 | 规范文件 | 核心要求 |
|---------|---------|---------|
| 📖 研究笔记 | `.agents/workflows/research-note.md` | 速读版 + 上下文定位 + 三栏原理表 + 面试题 |
| 🤖 AI 实验/消险 | `.agents/workflows/ai-parallel-task.md` | 文件头 JSDoc + 设计注释 + Muse 映射 |

### 三栏原理表（强制）

| 概念 | 能力来源（怎么获得的） | 激活方式（怎么触发的） | 类比（仅类比） |
|------|---------------------|---------------------|--------------|
| XXX | 预训练/RLHF/... | Prompt/微调/... | 像人的XXX（**仅类比**） |

---

## 🗂️ 文档边界

| 目录 | 放什么 | 不放 |
|------|--------|------|
| `user/` | 学习、研究、设计草案、AI 实验 | 正式架构文档 |
| `make-muse/` | 架构设计、ADR | 学习笔记 |
| `src/` + `test/` | 实现代码 | 文档 |

---

## ⚠️ 注意事项

- 不修改 `AGENTS.md`（引擎规范）
- 研究阶段不改 `src/` 代码
- 类比永远标注"仅类比"，不写成原理定义
- 引用外部代码必须标注来源和位置
