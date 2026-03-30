# Unit 02: Prompt 工程

> **终极目标关联：** 写出面试级 System Prompt + 优化 Muse Persona
> **本单元终结目标 (TLO)：** 完成 unit02 后，Later 能——
> 1. 面试时讲清 7 层 Prompt 架构 + 关键参数的原理
> 2. 走读 Muse 的 prompt 注入链并改进 Persona 效果
> 3. 理解 Prompt Injection 防御策略
> 4. 对比 Claude Code / OpenCode / Muse 的 System Prompt 设计
>
> **上游：** unit01 Agent Core + F6 Prompt Eng
> **下游：** unit03 多 Agent（写好 Prompt 才能让多角色各司其职）
> **来源底子：** [G16] DAIR.AI Prompt Guide + [W10] Anthropic + [W11] OpenAI + [C6] Andrew Ng
> **课程证据：** hello-agents ch5-6 排在 Multi-Agent ch7-8 前面; Weng 把 Planning(含Prompt) 作为三要素第一个

---

### 📚 前置基础

| 看到什么不懂 | 去哪里 |
|------------|--------|
| temperature 参数 | `foundations/F6` §4 |
| XML vs JSON 输出 | `unit01/study/01c` §一 |
| ACI 设计原则 | `unit01/study/01a` §2.6 |
| Muse identity.mjs | unit01 oc07 |

---

## 学习目标（问句形式）

1. 7 层 Prompt 架构是什么？每层解决什么问题？
2. temperature / top-p / max-tokens 各自影响什么？
3. System Prompt 怎么设计才有效？（结构化 vs 自由文本）
4. Prompt Injection 怎么防？（Anthropic 的 Guardrails 方法）
5. Muse 的 AGENTS.md → system-prompt hook → LLM 这条链路怎么走的？

---

## 📖 学习文档 → `study/`

| 文件 | 内容 | 底子来源 | 状态 |
|------|------|---------|------|
| `04a-prompt-architecture.md` | 7 层 Prompt + 参数调优 + CoT/ToT/SC | `repos/Prompt-Engineering-Guide/` [G16] + [C6] Andrew Ng | [占位] |
| `04b-system-prompt-design.md` | System Prompt 设计最佳实践 + 防注入 | [W10] Anthropic Library + [W11] OpenAI Guide | [占位] |

---

## 🤖 AI 并行任务 → `experiments/`

| # | 类型 | 验证什么 | 涉及源码 | 状态 |
|---|------|---------|---------|------|
| R6 | 🔧 | Muse 各 member 的 AGENTS.md 效果对比分析 | `families/*/AGENTS.md` | [ ] |

---

## 🔧 OC 实战任务 → `oc-tasks/`

> **USOLB 模型 + Bloom 递进**

### Level 1: 观察 — "看 Prompt 怎么影响行为"

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc12 | **参数实验** — 同一 prompt，改 temperature (0/0.3/0.7/1.5)，对比回答差异 | `[U][B]` | 04a §参数 | OpenCode 配置 | `oc12-param-experiment.md` |
| oc13 | **观察 Prompt 注入链** — 用 message hook 截获 Muse 发给 LLM 的完整 system prompt | `[O]` | 04a §7层 | `src/plugin/hooks/message-hook.mjs` | `oc13-prompt-capture.md` |

### Level 2: 理解 — "我知道 Prompt 怎么组装的"

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc14 | **走读 Muse Prompt 组装链** — AGENTS.md → identity.mjs → system-prompt hook → LLM，每步标注 7 层 | `[S]` | 04a §7层 + unit01 oc07 | `src/core/identity.mjs` `src/plugin/hooks/system-prompt.mjs` | `oc14-prompt-assembly.md` |

### Level 3: 分析 + 创造

| # | 任务 | USOLB | 对应理论 | 涉及源码 | 产出 |
|---|------|-------|---------|---------|------|
| oc15 | **对比 Claude Code / OpenCode / Muse 的 System Prompt** — 三者结构 + 设计差异 | `[S]` | 04a + 04b | 在线 + KI + `src/core/identity.mjs` | `oc15-prompt-comparison.md` |
| oc16 | **优化 Muse Persona Prompt** — 改进 AGENTS.md 模板 + system-prompt hook 拼接逻辑 | `[B][U]` | 04b §System Prompt | `families/*/AGENTS.md` + hook | `oc16-persona-improve.md` + 代码 |

### Level 5: 综合

| # | 任务 | USOLB | 产出 |
|---|------|-------|------|
| oc17 | **unit02 面试模拟** — 7 层 Prompt + 参数调优 + Muse Persona 的 STAR 故事 | — | `oc17-interview-stories.md` |

---

## 🏗️ 主线项目: Muse 里程碑

| # | 里程碑 | 关联 OC | 状态 |
|---|--------|--------|------|
| M5 | **理解 Muse 完整 Prompt 注入链** — 能画出 AGENTS.md → identity → hook → LLM 的流程 | oc14 | [ ] |
| M6 | **Persona Prompt 实际改好** — AGENTS.md 模板 + hook 拼接优化 | oc16 | [ ] |

## 🌊 支线项目: 学习助手 里程碑

| # | 里程碑 | 关联知识 | 状态 |
|---|--------|---------|------|
| S4 | **V1 高质量 Prompt 驱动** — 学习助手的 System Prompt 按 7 层设计 | 04a + 04b | [ ] |

---

## ✅ 通关检查

- [ ] 能讲清 7 层 Prompt 架构 + 每层的作用
- [ ] 能解释 temperature / top-p 的数学原理（概率采样）
- [ ] 能说出 3 种 Prompt Injection 防御方法
- [ ] `[S]` 能画出 Muse prompt 组装链
- [ ] `[B]` Persona prompt 已改好
- [ ] `[O]` 能截获并分析 Muse 发给 LLM 的完整 system prompt
- [ ] 准备了 Muse Prompt 设计的 STAR 故事
