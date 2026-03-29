---
description: AI 并行任务规范 — 实验代码和消险报告的标准格式，确保 Later 能复刻和吸收
---

# AI 并行任务规范

> **适用范围：** `user/unitXX-*/experiments/` 下的 AI 并行产出（🧪 实验 + 🔧 消险）
> **核心原则：** Later 看完能复刻、能用、能面试时讲。不是 AI 自嗨的代码或报告。

---

## 一、🧪 实验代码规范 (`expXX-*.mjs`)

### 1.1 文件头 JSDoc（必须）

```javascript
/**
 * expXX — [一句话说清楚这个实验验证什么]
 *
 * 📖 巩固 Day XX 学习: [对应的学习内容]
 * 🎯 验证目标: [具体要验证什么假设/模式]
 * 🏗️ Muse 场景: [这个模式在 Muse 里怎么用]
 *
 * 📌 核心概念:
 * - [概念1英文(中文)]: [一句话解释]
 * - [概念2英文(中文)]: [一句话解释]
 *
 * 🔧 运行方式:
 *   node --test user/unitXX-*/experiments/expXX-*.test.mjs
 *
 * 💡 设计选择:
 * - 不依赖 LLM API → 验证模式本身，不是验证 LLM
 * - 纯 JS ESM → Later 可以直接看、直接跑、直接改
 */
```

### 1.2 代码内注释要求

| 位置 | 必须写 | 示例 |
|------|--------|------|
| **每个函数上方** | JSDoc: 做什么 + 参数 + 返回值 + Muse 对应场景 | `@param {string} name 步骤名` |
| **关键设计决策** | 为什么这么写（不是写了什么） | `// 用 Map 而不是 Object → 保证插入顺序` |
| **Muse 映射** | 这段代码对应 Muse 的哪个组件 | `// 对应 Muse: planner → arch → coder` |
| **模式分界** | 用 `// ── Pattern N: XXX ──` 分隔 | `// ── Pattern 1: Chain (链式) ──` |

### 1.3 导出规范

```javascript
// ── 导出 ──
// 只导出核心函数，不导出内部辅助
export { createStep, chain, parallel, route }
```

### 1.4 测试文件规范 (`expXX-*.test.mjs`)

```javascript
/**
 * expXX 测试 — [一句话]
 *
 * 运行: node --test user/unitXX-*/experiments/expXX-*.test.mjs
 *
 * 测试策略:
 * - 基础功能: 验证模式本身正确
 * - Muse 场景: 用 Muse 真实场景命名测试 (面试能讲!)
 * - 边界情况: 空输入、错误处理、溢出
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
```

**测试命名规则：**

| 类型 | 命名模板 | 例子 |
|------|---------|------|
| 基础 | `should [动词] when [条件]` | `should route to coder when input contains "bug"` |
| Muse | `Muse analogy: [场景描述]` | `Muse analogy: planner → arch → coder → reviewer` |
| 边界 | `should handle [边界条件]` | `should handle empty chain` |

---

## 二、🔧 消险报告规范 (`RX-*.md`)

### 2.1 必须包含的章节

```markdown
# RX: [一句话标题]

> **消险任务**: [分析什么]
> **分析对象**: `src/xxx.mjs` (行数)
> **对应 Day**: Day XX
> **关联场景**: S1/S2/S3/S2b

---

## 1. 架构概述
[用 ASCII 流程图画出被分析模块的调用链]

## 2. 风险清单
[用表格列出，必须有：编号/风险/等级/位置/说明/建议]

## 3. 关键代码审查
[贴关键代码片段 + 注释问题在哪]

## 4. 亮点（做得好的地方）
[不是只找茬。好的设计也要标出来]

## 5. 整体评估
[用 X/10 打分 + 一句话结论]

## 6. Sprint X 接手须知
[必修/建议 分级，告诉 Later 到时候先修什么]
```

### 2.2 风险等级标准

| 图标 | 等级 | 定义 | 行动 |
|------|------|------|------|
| 🔴 | 高 | 会导致功能失败/数据丢失 | Sprint 进入实践阶段前必须修 |
| 🟡 | 中 | 降低可靠性，但不致命 | 实践阶段优先修 |
| 🟢 | 低 | 代码味道/不规范，不影响功能 | 有空再修 |

### 2.3 评分标准

| 分数 | 含义 |
|------|------|
| 8-10 | 🟢 可直接用于生产 |
| 6-7 | 🟢 基本可用，有改进空间 |
| 4-5 | 🟡 Happy Path 可用，缺容错 |
| 1-3 | 🔴 不可靠，需重写 |

---

## 三、📋 每日 INDEX.md 规范

### 3.1 模板

```markdown
# Day XX 产出索引：[当天主题]

> Sprint X | Phase X | 对应 overview.md Day XX 行

## 📖 AI 交付（你来吸收）
- [状态] `文件名` — 一句话说内容
- [状态] `文件名` — 一句话说内容

## 🎯 你的产出（Muse 小任务 + 沉淀）
- [状态] `文件名` — 具体任务描述
- [状态] Step 3 沉淀：[具体沉淀内容]

## 🤖 AI 并行产出
- [状态] 🧪 `expXX-*.mjs` — [实验内容] (X/X tests [结果])
- [状态] 🧪 `expXX-*.test.mjs` — 测试（`node --test` 直接跑）
- [状态] 🔧 `RX-*.md` — [消险内容] 评估 X/10

## 💡 今日关键收获（完成后填）
- 🏗️ 项目: [Muse 推进了什么]
- 🎓 学习: [掌握了什么]
- 💼 面试: [能讲什么故事]
```

### 3.2 状态标记

| 标记 | 含义 | 谁负责 |
|------|------|--------|
| `[ ]` | 未开始 | — |
| `[AI✓]` | AI 已交付，Later 未看 | AI |
| `[/]` | Later 正在吸收 | Later |
| `[x]` | Later 已吸收完成 | Later |

---

## 四、📊 ai-track-report.md 更新规范

每次 AI 完成新任务后，必须同时更新：

1. **对应 `dayXX/INDEX.md`** — 标记 `[x]` + 写结果
2. **`ai-track-report.md` 看板** — 更新状态 + 写一行结论
3. **同一个 git commit** — 代码 + 测试 + 报告 + INDEX 一起提交

### Commit 格式

```
feat(AI并行): DayXX — [做了什么]

🧪 expXX: [实验名] (X/X tests pass)
  - [关键验证点1]
  - [关键验证点2]

🔧 RX: [消险名] 评估 X/10
  - [关键发现]
```

---

## 五、Later 复刻指南

> **目标：Later 看完 AI 的实验代码，能自己写类似的。**

### 复刻三步法

```
1. 看 expXX-*.mjs 的文件头注释 → 理解验证什么
2. 看测试文件的 Muse 场景测试 → 理解怎么用
3. 改参数/加场景 → 验证自己理解对不对
```

### 快速验证

```bash
# 跑单个实验
node --test user/unit01-agent-core/experiments/exp01-chain-parallel-route.test.mjs

# 跑全部实验
node --test user/unit0{1,2,3,4}-*/experiments/*.test.mjs

# 只看结果，不看过程
node --test user/unit0{1,2,3,4}-*/experiments/*.test.mjs 2>&1 | grep -E '(✔|✖|tests|pass|fail)'
```
