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

读完本单元，你能回答：
1. Agent 的核心循环是什么？（Reason → Action → Observe）
2. 5 种编排模式各自适合什么场景？
3. Muse 在 Weng 的三要素框架里处于什么位置？

## 📖 学习材料

| 文件 | 内容 | 状态 |
|------|------|------|
| `01a-study-anthropic-bea.md` | BEA 核心概念 + Muse 思考 | [AI✓] |
| `01b-study-anthropic-bea-projects.md` | 开源项目分析 + 面试准备 | [AI✓] |
| `01c-course-cookbook-workflows.md` | Cookbook 代码精读 + 多课程对比 | [AI✓] |
| `01e-leaders-react-weng.md` | ReAct + Weng 三要素 + DeepSeek/o1 | [AI✓] |

## 🎯 你的任务

- [ ] `01-muse-aci-audit.md` — ACI 六原则审计
- [ ] 沉淀：Agent vs Workflow / 5 种编排模式复述

## 🤖 AI 并行产出

| 类型 | 文件 | 结果 |
|------|------|------|
| 🧪 实验 | `exp01-chain-parallel-route.mjs` | 10/10 ✅ |
| 🔧 消险 | `R1-notify-planner-reliability.md` | 评估 5/10 |
