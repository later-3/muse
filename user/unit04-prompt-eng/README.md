# Unit 04: Prompt 工程

> **对应 Sprint 1 Day 07** · 7 层 Prompt 结构 + pua 骨架

### 📚 前置基础（碰到不懂来这里查）

| 看到什么不懂 | 去哪里 |
|------------|--------|
| Prompt 基本原则 | `foundations/F6` §1-2 |
| Temperature / Top-p | `foundations/F6` §4 |
| SFT 怎么教模型遵循指令 | `foundations/F3` §2 |
| Tokenization 和成本 | `foundations/F11` §3 |

## 学习目标

1. 系统 Prompt 的 7 层结构是什么？
2. 怎么设计一个有层次的 Prompt？
3. Muse 的 pua prompt 应该怎么组装？

---

## 📖 学习文档 → `study/`

| 文件 | 内容 | 状态 |
|------|------|------|
| `study/07-study-prompt-engineering.md` | 7 层结构 + pua 骨架 | [AI✓] |

## 🎯 你的任务

- [ ] pua Prompt 结构草案

## 🤖 AI 并行任务 → `experiments/`

| 类型 | 文件 | 结果 |
|------|------|------|
| 🧪 exp07 | `experiments/exp07-prompt-layers.mjs` | 5/5 ✅ |

---

## 🔧 OC 实战任务 → `oc-tasks/`

### A. 理论实操

| # | 任务 | 对应理论 | 产出 |
|---|------|---------|------|
| oc22 | **7 层 Prompt Builder** — 构建可复用的 prompt 组装器，接真实 LLM 验证效果 | 7 层结构 | `oc22-prompt-builder-real.mjs` |
| oc23 | **Temperature 对比实验** — 同一 prompt，t=0/0.3/0.7/1.0 各跑 5 次，统计输出差异 | F6 参数选择 | `oc23-temperature-experiment.mjs` |
| oc24 | **结构化输出对比** — XML vs JSON vs Markdown，哪种格式 LLM 遵循率最高？ | F6 结构化输出 | `oc24-output-format-compare.mjs` |

### B. 课程练习

| # | 来源 | 练什么 | 产出 |
|---|------|--------|------|
| oc25 | **吴恩达 Prompt Engineering** | 6 大技巧全部实操：分隔符/Few-shot/CoT/角色 | `oc25-andrew-ng-prompts.md` |
| oc26 | **Anthropic Prompt Library** | 官方 prompt 库精选 10 个最佳实践分析 | `oc26-anthropic-prompt-lib.md` |
| oc27 | **Hello-Agents** Ch7+ Prompt | Datawhale 的 Prompt 工程实战 | `oc27-hello-prompt.mjs` |

### C. 项目拆解

| # | 项目 | 拆什么 | 产出 |
|---|------|--------|------|
| oc28 | **Claude Code System Prompt** | Anthropic 怎么写 system prompt：身份/能力/约束/工具描述 格式 | `oc28-claude-code-prompt.md` |
| oc29 | **Cursor Rules** | Cursor 的 .cursorrules 怎么设计：项目级 + 全局级 prompt 注入 | `oc29-cursor-rules.md` |
| oc30 | **OpenCode pua prompt** (我们的底座) | system prompt 模板走读：针对不同模型怎么拼 prompt | `oc30-opencode-pua.md` |

---

## 🏗️ 并行项目里程碑

| 项目 | 本 unit 对应的里程碑 | 状态 |
|------|---------------------|------|
| **Muse** | 设计小缪的 pua prompt（性格+能力+边界） | [ ] |
| **学习助手** | V3 优化 system prompt（加索引+互动引导+笔记指令） | [ ] |
