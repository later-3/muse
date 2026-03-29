# Unit 01: Agent 核心循环

> **对应 Sprint 1 Day 01-02** · BEA 精读 + Orchestrator + ReAct

### 📚 前置基础（碰到不懂来这里查）

| 看到什么不懂 | 去哪里 |
|------------|--------|
| LLM 怎么"规划"的 | `foundations/F1` §4 (CoT → R1 → o1) |
| 上下文窗口为什么有限 | `foundations/F2` §3 (Attention O(n²)) |
| Function Calling 怎么来的 | `foundations/F3` §2 (SFT 训练) |
| temperature=0.1 为什么 | `foundations/F6` §4 |
| XML 为什么比 JSON 可靠 | `foundations/F6` §2 |

## 学习目标

读完本单元，你能回答：
1. Agent 的核心循环是什么？（Reason → Action → Observe）
2. 5 种编排模式各自适合什么场景？
3. Muse 在 Weng 的三要素框架里处于什么位置？

---

## 📖 学习文档（AI 为你准备）

| 文件 | 内容 | 状态 |
|------|------|------|
| `01a-study-anthropic-bea.md` | BEA 核心概念 + Muse 思考 | [AI✓] |
| `01b-study-anthropic-bea-projects.md` | 开源项目分析 + 面试准备 | [AI✓] |
| `01c-course-cookbook-workflows.md` | Cookbook 代码精读 + 多课程对比 | [AI✓] |
| `01e-leaders-react-weng.md` | ReAct + Weng 三要素 + DeepSeek/o1 | [AI✓] |

## 🎯 你的任务

- [ ] `01-muse-aci-audit.md` — ACI 六原则审计
- [ ] 沉淀：Agent vs Workflow / 5 种编排模式复述

## 🤖 AI 并行任务

| 类型 | 文件 | 结果 |
|------|------|------|
| 🧪 实验 | `exp01-chain-parallel-route.mjs` | 10/10 ✅ |
| 🔧 消险 | `R1-notify-planner-reliability.md` | 评估 5/10 |

## 🔧 OC 基础小任务（学了就练）

> 基于本 unit 学的编排模式，在 OpenCode 里实际操作。

| # | 任务 | 练什么 | 状态 |
|---|------|--------|------|
| oc01 | 用 OC 的 prompt_async 发一条消息并读 session 结果 | OC REST API 基础 | [ ] |
| oc02 | 写一个 chain 模式：OC 翻译 → 摘要 → 关键词提取 | 链式编排 | [ ] |
| oc03 | 写一个 route 模式：根据输入类型路由到不同 prompt | 路由编排 | [ ] |

## 🏗️ 并行项目里程碑

| 项目 | 本 unit 对应的里程碑 | 状态 |
|------|---------------------|------|
| **Muse** | 理解 Muse 当前的 Agent 循环（OODA → Telegram → OpenCode） | [ ] |
| **学习助手** | V0 原型跑通（Web Speech → LLM → TTS 基础流程） | [/] 见 `projects/learning-assistant/` |
