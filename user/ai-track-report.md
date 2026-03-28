# AI 并行轨道 — 任务看板

> **你忙完了来这里看 AI 干了啥。每个任务有状态 + 结论 + 链接到对应天的文件夹。**
> **所有文件都在对应的 `user/research/dayXX/` 下，和你的任务放在一起。**

---

## Sprint 1 实验（🧪 巩固学习）

| # | 实验 | 对应 Day | 状态 | 结论 | 文件位置 |
|---|------|---------|------|------|---------|
| exp01 | 链式/并行/路由 | Day 01 | ✅ | 10/10 pass | `day01/exp01-*.mjs` |
| exp02 | Orchestrator 动态分配 | Day 02 | [ ] | — | `day02/` |
| exp03 | 人类审批 Gate | Day 03 | [ ] | — | `day03/` |
| exp04 | JS 迷你 Swarm | Day 04 | [ ] | — | `day04/` |
| exp05 | 最简状态机 | Day 05 | [ ] | — | `day05/` |
| exp06 | 角色 Prompt 模板 | Day 06 | [ ] | — | `day06/` |
| exp07 | Prompt 分层注入 | Day 07 | [ ] | — | `day07/` |

## Sprint 1 消险（🔧 Muse 真用）

| # | 消险项 | 对应 Day | 状态 | 风险 | 结论 | 文件位置 |
|---|--------|---------|------|------|------|---------|
| R1 | notify_planner 可靠性 | Day 01 | ✅ | 🟡 5/10 | session 失效/无重试/无超时 | `day01/R1-*.md` |
| R2 | handoff 超时 | Day 02 | [ ] | — | — | `day02/` |
| R3 | MCP 注册完整性 | Day 03 | [ ] | — | — | `day03/` |
| R4 | prompt 注入风险 | Day 04 | [ ] | — | — | `day04/` |
| R5 | harness 端到端 | Day 05 | [ ] | — | — | `day05/` |
| R6 | memory 持久化 | Day 06 | [ ] | — | — | `day06/` |

---

## 查看方式

```
你做完 Day XX 的任务
  → 打开 user/research/dayXX/INDEX.md
  → 里面有三块：📖 AI交付 / 🎯 你的产出 / 🤖 AI并行
  → 所有文件都在同一个目录下
  → 或者回这个看板看全局进度
```

---

## 已完成任务报告

### exp01 — 链式/并行/路由 (Day 01)

**验证结果**: 10/10 tests pass

| 模式 | Muse 场景 | 结论 |
|------|----------|------|
| Chain | planner→arch→coder→reviewer | ✅ 上下文完整传递 |
| Parallel | 多 reviewer 并行打分 | ✅ 聚合正确，并行~20ms |
| Route | Orchestrator 意图分类 | ✅ chat/task/approval 分流 |

**对 Muse 的启发**: Chain 最适合 planner→worker 流水线，Route 对应意图分类，三种可组合

---

### R1 — notify_planner 可靠性 (Day 01)

**整体评分**: 🟡 5/10

| 🔴 高风险 | 说明 |
|-----------|------|
| session 失效 | Planner 重启后旧 session 消失，回调静默失败 |
| 无重试 | 网络抖动一次就断链 |
| HTTP 无超时 | Planner 卡住时 Worker 永远等待 |

**Sprint 4 接手须知**: 先修超时+重试+session检测，再做 Spike 3
