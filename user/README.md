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

## 三、Sprint 总览（粗粒度路线）

4 个月 ≈ 8 个双周 Sprint。当前在 **Sprint 1**。

| Sprint | 聚焦 | 主要交付物 | 对应 Phase |
|--------|------|----------|-----------|
| **→ Sprint 1** | 理论：Core Loop + Multi-Agent 编排 | 7 篇研究笔记 + Design Principles 草稿 | Phase 0+1 |
| Sprint 2 | 理论+经验：Memory + 更多案例 + Prompt 深化 | research-map v2 + Design Principles v1 定稿 + 2 个 demo 跑通 | Phase 0+1 |
| Sprint 3 | 实践：Spike 1 (Core Loop) + Spike 3 (Handoff) | 2 个可运行原型 | Phase 2→3 |
| Sprint 4 | 实践：Spike 2 (Memory) + 场景锚定 | Memory 原型 + MVP Scenario Spec | Phase 2.5→3 |
| Sprint 5 | 设计：Architecture v2 + 资产矩阵 | Blueprint v2 + Retain/Refactor/Rewrite/Archive 矩阵 | Phase 4 |
| Sprint 6 | 实现：S1 (pua 日常对话) + S2 (muse-harness) | S1+S2 端到端跑通 | Phase 5 |
| Sprint 7 | 实现：S3 (审批) + S4 (语音通话) | S3 跑通 + 语音 Spike | Phase 5 |
| Sprint 8 | 收尾：Eval 固化 + Portfolio 整理 | Eval 框架 + demo + 博客 + 面试材料 | Phase 6→7 |

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

## 五、锚点场景（MVP 范围）

| # | 场景 | 一句话描述 |
|---|------|----------|
| S1 | 单 Muse 日常对话 | Later 和 pua 聊天，有性格有记忆会主动关心 |
| S2 | muse-harness 工作流 | planner 建工作流，推动 arch/coder/reviewer 完成任务（**最高优先**）|
| S3 | 高风险动作审批 | arch 改核心文件需 planner 审批 |

**扩展场景（MVP 之后）：**

| # | 场景 | 一句话描述 |
|---|------|---------|
| S4 | 语音通话 | Later 和 pua 语音聊天（**第二优先，MVP 后做**）|

## 六、日常工作流 SOP（所有 AI 必须遵循）

### 6.1 每次对话开始时

```
1. 读 user/README.md（本文件）→ 了解大背景
2. 看 §三 Sprint 总览 → 确认当前活跃 Sprint 是哪个
3. 打开当前 sprint-X.md → 找到第一个未完成的 [ ] 任务
4. 告诉 Later："当前是 Sprint X，今天的任务是 XXX，准备好了吗？"
```

### 6.2 工作期间（每个任务的输入/输出）

```
输入：Later 说"开始今天的任务"或指定某个任务
输出：
  1. 和 Later 一起完成任务内容（精读/走读/实验）
  2. 产出交付物到 user/research/ 或指定位置
  3. 更新 sprint-X.md：把完成的 [ ] 改为 [x]
  4. 告诉 Later 今天的总结：学了什么 / 做了什么 / 留下了什么证据
```

**单个任务的标准流程：**

| 步骤 | 做什么 | 产出 |
|------|-------|------|
| 开始 | AI 确认今天任务内容，简述目标 | — |
| 执行 | 按理论/经验/实践类型协作完成 | 研究笔记 / 走读笔记 / Spike 代码 |
| 检查 | 对照任务的完成定义自检 | — |
| 记录 | 把交付物写入 `user/research/` | `.md` 文件 |
| 标完成 | 更新 `sprint-X.md` 的 checkbox | `[x]` |
| 总结 | 告诉 Later：项目推进了什么 / 学到了什么 / 面试能讲什么 | 口头 |

### 6.3 Sprint 完成时

```
触发条件：sprint-X.md 中所有任务都标为 [x]，且 mini-eval 自检通过

做这些事：
  1. 写复盘 → user/sprint-X-retro.md
  2. 更新 README.md §三 Sprint 总览 → 当前 Sprint 标 ✅，箭头移到下一个
  3. 创建下一个 Sprint 文件 → user/sprint-(X+1).md
     - 从 README.md §三 的粗粒度计划中展开为每日任务
     - 参考 map.md 全景图确定要覆盖的域和行
  4. 告诉 Later："Sprint X 完成，Sprint X+1 已创建，要调整吗？"
```

**Sprint 2 什么时候生效？** Sprint 2-8 已提前草拟，但都是草案。**只有 README §三 Sprint 总览中箭头 → 指向的那个 Sprint 才是当前生效的。** 启动新 Sprint 时可根据实际情况调整任务。

### 6.4 如果一个 Sprint 做不完

```
- 未完成的任务保留在当前 sprint-X.md，不要删
- 在复盘中标注哪些没完成、为什么
- 未完成的任务可以顺延到 sprint-(X+1).md
- 不要因为没完成就跳过 mini-eval，该复盘还是要复盘
```

### 6.5 Later 临时想做计划外的事

```
- Later 可以随时提出计划外任务
- AI 应提醒："这个任务不在当前 Sprint 范围内，要加入还是单独处理？"
- 如果加入 Sprint，更新 sprint-X.md
- 如果只是临时探索，不更新 Sprint，做完就好
```

### 6.6 多个 AI 之间的衔接

```
场景：Later 关闭当前 AI 对话，开启新 AI 对话

新 AI 应该：
  1. 读 user/README.md
  2. 读当前 sprint-X.md → 找到进度
  3. 如果需要前次对话的细节 → 读 user/research/ 下最近的笔记
  4. 不需要读 muse/src/ 代码（除非进入实践阶段）
  5. 继续推进未完成的下一个任务
```

---

## 七、注意事项

- **user/ 目录是 Later 的个人学习和规划空间**，不是 Muse 引擎代码
- **不要修改 Muse 根目录的 AGENTS.md**，那是引擎开发规范
- **不要修改 src/ 下的代码**，除非在实践阶段且 Later 明确要求
- **当前处于研究阶段（Phase 0+1）**，不做 Spike 编码、不重构代码
- Muse 引擎代码在 `muse/src/`，架构文档在 `muse/make-muse/`
