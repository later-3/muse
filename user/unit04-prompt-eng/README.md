# Unit 04: Prompt 工程

> **来源底子：** [G16] DAIR.AI Prompt Guide + [W10] Anthropic + [W11] OpenAI + [C6] Andrew Ng
> **上游：** unit01 Agent Core + F6 Prompt Eng
> **下游：** Week 4 面试冲刺

### 📚 前置基础

| 看到什么不懂 | 去哪里 |
|------------|--------|
| temperature 参数 | `foundations/F6-prompt-eng.md` §4 |
| XML vs JSON 输出 | `unit01/study/01c` §一 |

## 学习目标

1. 7 层 Prompt 架构是什么？每层解决什么问题？
2. 怎么写一个面试级别的 System Prompt？
3. Prompt Injection 怎么防？

---

## 📖 学习文档 → `study/`

| 文件 | 内容 | 底子来源 | 状态 |
|------|------|---------|------|
| `study/04a-prompt-architecture.md` | 7 层 Prompt + 参数调优 | `repos/Prompt-Engineering-Guide/` [G16] + [C6] Andrew Ng | [占位] |
| `study/04b-system-prompt-design.md` | System Prompt 设计最佳实践 | [W10] Anthropic Library + [W11] OpenAI Guide | [占位] |

---

## 🔧 OC 实战任务

### A. 理论实操

| # | 任务 | 产出 |
|---|------|------|
| oc22 | **Prompt 参数实验** — temperature/top-p/max-tokens 效果对比 | `oc22-param-experiment.mjs` |
| oc23 | **System Prompt Builder** — 模块化 prompt 构建器 | `oc23-prompt-builder.mjs` |

### B. 课程练习

| # | 来源 | repos/ 路径 | 产出 |
|---|------|-----------|------|
| oc24 | **DAIR.AI** CoT/ToT 章节 | `repos/Prompt-Engineering-Guide/` | `oc24-cot-practice.md` |
| oc25 | **Anthropic Cookbook** Extended Thinking | `repos/anthropic-cookbook/extended_thinking/` | `oc25-thinking.md` |

### C. 项目拆解

| # | 项目 | 拆什么 | 产出 |
|---|------|--------|------|
| oc26 | **Claude Code Prompt** | System Prompt 设计分析 | `oc26-claude-prompt.md` |
| oc27 | **Muse Persona** | 我们的身份 prompt 审计 | `oc27-muse-persona-audit.md` |

---

## 🏗️ 并行项目里程碑

| 项目 | 里程碑 | 状态 |
|------|--------|------|
| **Muse** | Persona prompt 优化 (基于 BEA ACI 原则) | [ ] |
| **学习助手** | V3 优质 prompt 驱动的学习体验 | [ ] |
