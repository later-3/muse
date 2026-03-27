# Muse 学习与开发指南

> **这个文件是任何 AI 接手时必读的上下文文件。**
> Later 正在通过「研究驱动开发 (RDD)」方法，同时推进 Muse 项目和 AI Agent 工程能力成长。

---

## 一、我是谁、我要干什么

- **我是** Later，Muse 项目的创建者和唯一开发者
- **Muse 是** 一个 AI 生命体引擎，基于 OpenCode 底座，代码在 `muse/src/`
- **我的双重目标：**
  - 目标 A：4 个月内完成 Muse 的 3 个锚点场景 MVP
  - 目标 B：形成可面试 AI Agent 开发岗位的项目证明包

## 二、user/ 目录下的文件说明

| 文件 | 作用 | 什么时候看 |
|------|------|----------|
| **README.md**（本文件） | 任何 AI 的入口上下文 | **每次新对话必读** |
| **Research-Driven Development.md** | L1 总路线：RDD 方法论、Phase 0-7、退出条件、资产四分法 | 需要了解大方向时 |
| **map.md** | 知识-功能全景图：Muse 15 个功能 → 10 个域 → 所需知识/来源/技能 | 需要知道「学什么对应做什么」时 |
| **sprint-1.md** | 当前 Sprint 的每日任务清单 | 每天开工时 |
| **research/** | 研究笔记存放目录 | 做研究时产出到这里 |
| **design-principles-draft.md** | Sprint 1 产出的原则草稿（Sprint 2 定稿为 v1） | 做设计决策时参考 |
| `.agents/workflows/research-note.md` | 研究笔记撰写标准（必须包含的章节、格式规范） | **写研究笔记时必读** |

### 文档边界规则（强制）

| 目录 | 只放 | 不放 |
|-----|------|------|
| **`user/`** | 学习计划、研究笔记、retro、portfolio、设计草案 | 正式架构文档、technical design |
| **`make-muse/`** | 正式 principles、architecture、technical design、ADR | 学习计划、日常笔记 |
| **`src/` + `test/`** | 实际实现代码和测试 | 文档、计划 |

## 三、Sprint 总览（粗粒度路线）

4 个月 ≈ 8 个双周 Sprint。当前在 **Sprint 1**。

| Sprint | 聚焦 | 主要交付物 | 对应 Phase |
|--------|------|----------|-----------|
| **→ Sprint 1** | 理论：Core Loop + Multi-Agent 编排 | 7 篇研究笔记 + Design Principles 草稿 | Phase 0（退出：能说清 10 个 Agent 核心概念） |
| Sprint 2 | 理论+经验：Memory + Prompt 深化 + 场景锚定 | Design Principles v1 + CrewAI demo + Memory 原型 demo | Phase 1（退出：research 覆盖 ≥6 案例）+ Phase 2.5（场景锚定） |
| Sprint 3 | 实践：Spike 1 (Core Loop) + Spike 3 (Handoff) | 2 个可运行原型 | Phase 3（退出：Spike 1 + Spike 3 跑通） |
| Sprint 4 | 实践：Spike 2 (Memory) + **Integration Slice** | Memory 原型 + 最小 S2/S1 接入真实 muse/src/ | Phase 3（退出：3 个 Spike 至少 2 个 pass + 1 条真实链路） |
| Sprint 5 | 设计：Architecture v2 + 资产矩阵 | `make-muse/` 下的 Blueprint v2 + 资产矩阵 | Phase 4 |
| Sprint 6 | 实现：S1 (pua 日常对话) + S2 (muse-harness) | S1+S2 端到端跑通 | Phase 5 |
| Sprint 7 | 实现：S3 (审批) + **S2b (自开发闭环)** + S4 (语音 Spike) | S3 + S2b 跑通 + 语音 Spike | Phase 5 |
| Sprint 8 | 收尾：Eval 固化 + **Capstone** + Portfolio | Eval 框架 + 非 Muse 小 Agent 应用 + 面试材料 | Phase 6→7 |

> 注：Sprint 划分是粗粒度指引，不是硬 deadline。每个 Sprint 结束看退出条件，达标才往下走。

## 四、方法论：理论→经验→实践→反思

**任何 AI 和 Later 协作时，请遵循这个方法：**

### 每个知识域的学习路径

```
1. 理论 📖 — 精读官方指南/论文
   AI 的角色：提取关键概念、对比不同方案、用中文解释
   Later 的角色：验证理解、用自己的话复述
   产出：研究笔记 → user/research/

2. 经验 🔍 — 走读开源项目源码
   AI 的角色：逐段解释代码、标注设计模式、标注 Muse 可借鉴的点
   Later 的角色：亲手跑 demo、验证理解
   产出：代码走读笔记 → user/research/

3. 实践 🔨 — 做 Spike / Exercise
   AI 的角色：写初版代码、解释设计选择
   Later 的角色：审查修改、跑通、记录结果
   产出：Spike 代码 + 验证报告

4. 反思 🔄 — 复盘沉淀
   AI 的角色：帮助整理发现、对比预期和实际
   Later 的角色：判断哪些原则成立、哪些假设被推翻
   产出：更新 Design Principles / KI / 面试故事
```

### 三类结果同时产出

每完成一个知识域，必须同时产出：
- 🏗️ **项目结果** — Muse 有什么推进
- 🎓 **学习结果** — 掌握了什么概念/技能
- 💼 **面试证据** — 能讲什么技术故事

### 关键规则

1. **一次只推进 1 个主阶段** — 不要一边研究一边重写代码
2. **没有退出条件的任务不做** — 每个任务必须有完成定义
3. **全景图驱动学习** — 学什么看 `map.md`，不是随机选题
4. **研究笔记高频，ADR 低频** — 只有重大架构决策才写 ADR
5. **不要在全景图里讨论 OpenCode 实现细节** — 那是 Spike / Technical Design 层的事
6. **研究笔记必须遵循标准** — 所有 `user/research/` 下的笔记必须按 `.agents/workflows/research-note.md` 格式撰写（英文对照、项目映射、面试准备、自检题等）
7. **Sprint 间逻辑一致** — 每个 Sprint 的退出条件必须对齐 RDD Phase 退出条件，不得冲突

## 五、锚点场景（MVP 范围）

| # | 场景 | 一句话描述 |
|---|------|----------|
| S1 | 单 Muse 日常对话 | Later 和 pua 聊天，有性格有记忆会主动关心 |
| S2 | muse-harness 工作流 | planner 建工作流，推动 arch/coder/reviewer 完成任务（**最高优先**）|
| S3 | 高风险动作审批 | arch 改核心文件需 planner 审批 |
| **S2b** | **Muse 自开发闭环** | **Muse 发现问题 → planner 立项 → worker 修改自己的 docs/code/test → reviewer 审查 → 汇报** |

**扩展场景（MVP 之后，非锚点）：**

| # | 场景 | 一句话描述 |
|---|------|---------| 
| S4 | 语音通话 | Later 和 pua 语音聊天（**第二优先，MVP 后做，Sprint 7 做 Spike**）|

### Muse Basic v1 硬验收标准

> [!IMPORTANT]
> **4 个月结束时，Muse 必须具备以下 5 项核心能力，否则不算「基本功能成型」。**

| # | 能力 | 验收标准 | 对应场景 |
|---|------|---------|--------|
| 1 | 会话与记忆 | 多轮对话上下文 + 记忆跨 session + 人格一致 | S1 |
| 2 | 任务协作 | Handoff 成功 + Worker 独立执行 + 结果回传 + 失败重试 | S2 |
| 3 | 审批治理 | 拦截触发 + 审批请求 + 批准/拒绝/超时 | S3 |
| 4 | **自开发闭环** | **Muse 围绕自身问题自发开发：发现→立项→修改→审查→汇报** | **S2b** |
| 5 | **最小可观测性** | **全链路 trace 可查 + 关键指标看板（成功率/延迟/错误）** | **贯穿** |


## 六、文档层级与编号体系

### 6.1 四层文档关系（从宏观到微观）

```
L1  RDD.md          ← 总路线：Phase 0-7、退出条件、方法论
     ↓ 驱动
L2  README.md §三    ← Sprint 总览：8 个 Sprint 的粗粒度计划 + 对齐的 Phase
     ↓ 展开为
L3  sprint-X.md      ← 当前 Sprint 的每日任务清单 + 交付物表
     ↓ 每天产出
L4  user/research/   ← 研究笔记、设计草案（按 research-note workflow 标准）
```

**唯一的 "当前在做什么" 入口是 `sprint-X.md`。** 所有其他文档提供上下文，不指挥日常工作。

### 6.2 编号体系

| 编号 | 含义 | 例子 |
|------|------|------|
| **S1 / S2 / S3 / S4** | 锚点场景 | S2 = muse-harness 工作流 |
| **Phase 0-7** | RDD Phase（退出条件驱动） | Phase 0 = 基础理论 |
| **Sprint 1-8** | 双周 Sprint（每个对齐 1-2 个 Phase） | Sprint 1 → Phase 0 |
| **Day 1-10** | Sprint 内的每日任务 | Day 1 = 精读 Anthropic BEA |
| **域 1-10** | map.md 全景图的功能域 | 域 3 = Multi-Agent & Harness |
| **Spike 1-3** | Phase 3 的最小验证原型 | Spike 3 = Handoff 验证 |

---

## 七、日常工作流 SOP（所有 AI 必须遵循）

### 7.1 每次对话开始

```
1. 读 user/README.md（本文件）→ 了解大背景和编号体系
2. 看 §三 Sprint 总览 → 确认当前活跃 Sprint（→ 箭头指向的那个）
3. 打开 sprint-X.md → 找到第一个未完成的 [ ] 任务
4. 告诉 Later："当前是 Sprint X Day N，今天的任务是 XXX，准备好了吗？"
```

### 7.2 每日工作流程（三步法）

每天有 3 个环节，按顺序完成：

```
┌─────────────────────────────────────────────────────┐
│  Step 1: 📖 学习                                     │
│  精读/走读/跑 demo → 产出研究笔记                      │
│  笔记格式遵循 .agents/workflows/research-note.md      │
│  ↓                                                   │
│  Step 2: 🎯 Muse 小任务                              │
│  基于当天学习，完成一个和 Muse 直接相关的设计/分析任务    │
│  产出设计草案 → 作为后续 Spike 的输入                    │
│  ↓                                                   │
│  Step 3: ✏️ 沉淀                                      │
│  用自己的话写出关键理解 / 做对比表 / 画流程图             │
│  这一步由 Later 完成，AI 辅助打磨                       │
└─────────────────────────────────────────────────────┘
```

### 7.3 每日收尾（AI 必须做的 4 件事）

```
1. 更新 sprint-X.md：完成的 [ ] → [x]
2. 检查：今天的研究笔记是否遵循了 research-note 标准？
3. 告诉 Later 今天的总结：
   - 🏗️ 项目推进了什么（Muse 有什么新的设计输入）
   - 🎓 学到了什么（掌握了哪个概念/模式）
   - 💼 面试能讲什么（积累了什么故事/案例）
4. 预告：明天的任务是什么，需要提前准备什么
```

### 7.4 Sprint 生命周期

```
Sprint 启动
  └─ 确认 sprint-X.md 的任务清单和退出条件
  
每日循环 × 10 天
  └─ Step 1 学习 → Step 2 Muse 小任务 → Step 3 沉淀

Sprint 收尾（Day 10）
  ├─ mini-eval 自检（对齐 RDD Phase 退出条件）
  ├─ 写复盘 → user/sprint-X-retro.md
  ├─ 更新 README §三 → 当前 Sprint 标 ✅，箭头 → 移到下一个
  ├─ 创建 sprint-(X+1).md（从 README §三 展开 + 参考 map.md）
  └─ 告诉 Later："Sprint X 完成，Sprint X+1 已创建，要调整吗？"
```

### 7.5 特殊情况处理

**Sprint 做不完：**
- 未完成任务保留在 sprint-X.md，不删
- 复盘中标注哪些没完成、为什么
- 可顺延到 sprint-(X+1).md
- **不要跳过 mini-eval**

**Later 想做计划外的事：**
- AI 提醒："这个不在当前 Sprint 范围内，要加入还是单独处理？"
- 加入 → 更新 sprint-X.md
- 临时探索 → 不更新 Sprint

**新 AI 接手：**
```
1. 读 user/README.md（本文件）
2. 读 sprint-X.md → 找到进度
3. 读 user/research/ 下最近的笔记（了解前次细节）
4. 不读 muse/src/ 代码（除非在实践阶段）
5. 继续推进下一个未完成任务
```

---

## 七、注意事项

- **user/ 目录是 Later 的个人学习和规划空间**，不是 Muse 引擎代码
- **不要修改 Muse 根目录的 AGENTS.md**，那是引擎开发规范
- **不要修改 src/ 下的代码**，除非在实践阶段且 Later 明确要求
- **当前处于研究阶段（Phase 0+1）**，不做 Spike 编码、不重构代码
- Muse 引擎代码在 `muse/src/`，架构文档在 `muse/make-muse/`
