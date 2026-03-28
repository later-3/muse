# Muse 学习与开发指南

> **任何 AI 接手时必读。** Later 正在通过 RDD 方法，同时推进 Muse 项目和 AI Agent 工程能力。

---

## 一、我是谁、我要干什么

- **我是** Later，Muse 项目的创建者
- **Muse 是** 一个 AI 生命体引擎，基于 OpenCode 底座，代码在 `muse/src/`
- **核心目标：** 做出一个能自开发自己的 Muse（S2b 自开发闭环）
- **副目标：** 形成可面试 AI Agent 开发岗位的项目证明包

## 二、文件导航

> **先看什么 → 后看什么 → 日常看什么，一目了然。**

```
user/
├── README.md             ← 你正在看。AI 入口，每次新对话必读
├── overview.md           ← 总览：目标+Sprint+北极星+每日计划
├── Research-Driven Development.md  ← RDD 方法论全文（Phase 定义+退出条件）
├── map.md                ← 知识-功能全景图（15个愿景×域×知识）
├── ai-track-report.md    ← AI 并行任务看板（你忙完看这里）
├── sprint-1.md ~ sprint-8.md  ← 各 Sprint 每日任务清单
└── research/
    ├── README.md          ← ⭐ 研究手册（方法论+参考仓库+核心准则）
    └── day01/ ~ day07/    ← 每日产出（你的+AI的都在同一个文件夹）
        └── INDEX.md       ← 当天三轨道索引
```

| 场景 | 看什么 |
|------|--------|
| 刚接手，要快速了解 | 本文件 → `overview.md` |
| 今天要干什么 | `sprint-X.md`（找第一个 `[ ]`） |
| AI 干了啥 | `ai-track-report.md` 或 `research/dayXX/INDEX.md` |
| 学什么对应做什么 | `map.md` |
| 大方向、Phase 退出条件 | `Research-Driven Development.md` |
| 怎么写研究笔记 | `.agents/workflows/research-note.md` |

### 文档边界规则

| 目录 | 只放 | 不放 |
|-----|------|------|
| `user/` | 学习计划、研究笔记、设计草案、AI 实验 | 正式架构文档 |
| `make-muse/` | 架构设计、ADR、技术 design | 学习计划 |
| `src/` + `test/` | 实现代码和测试 | 文档、计划 |

## 三、编号体系

| 编号 | 含义 | 例子 |
|------|------|------|
| **S1/S2/S3/S2b/S4** | 锚点场景 | S2b = 自开发闭环 |
| **Phase 0-7** | RDD Phase（退出条件驱动） | Phase 0 = 基础理论 |
| **Sprint 1-8** | 双周 Sprint | Sprint 1 → Phase 0 |
| **Day 1-10** | Sprint 内工作日 | Day 1 = 精读 BEA |
| **Spike 1-3** | Phase 3 最小验证原型 | Spike 3 = Handoff |

## 四、日常工作流 SOP

### 每次对话开始（AI 必做）

```
1. 读本文件 → 了解背景
2. 看 overview.md §Sprint映射 → 确认当前 Sprint
3. 打开 sprint-X.md → 找第一个未完成 [ ]
4. 告诉 Later："当前是 Sprint X Day N，今天的任务是 XXX"
```

### 每日双轨流程

> **核心准则详见 `research/README.md` §核心方法论。这是必须遵守的。**

| 步骤 | 谁做 | 内容 |
|------|------|------|
| Step 1: 📖 吸收 | Later | AI 已交付精华笔记，读+理解+能复述 |
| Step 2: 🎯 Muse 小任务 | Later | 把学到的压回 Muse 设计（不改代码） |
| Step 3: ✏️ 沉淀 | Later | 面试题回答、关键概念复述 |
| Step 4: 🤖 AI 并行 | AI | 🧪 实验（巩固学习）+ 🔧 消险（Muse 真用） |

### 进度状态

- `[ ]` = 未开始
- `[AI✓]` = AI 已交付，Later 未吸收
- `[/]` = Later 正在吸收
- `[x]` = Later 已吸收完成

### Sprint 收尾（Day 10）

```
1. mini-eval 自检（对齐 RDD Phase 退出条件）
2. 复盘 → sprint-X-retro.md
3. 更新本文件 §当前状态
4. 创建 sprint-(X+1).md
```

---

## 五、当前状态

**→ Sprint 1**（Phase 0: 理论基础）

> 详见 `sprint-1.md` 和 `overview.md`

---

## 六、注意事项

- `user/` 是 Later 的学习空间，不是引擎代码
- 不要修改 `AGENTS.md`（引擎开发规范）
- 不要修改 `src/` 代码，除非在实践阶段且 Later 明确要求
- 引擎代码在 `muse/src/`，架构文档在 `muse/make-muse/`
