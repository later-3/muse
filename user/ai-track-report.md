# AI 并行轨道 — 任务看板

> **你忙完了来这里看 AI 干了啥。每个任务有状态 + 结论 + 详细报告链接。**

---

## Sprint 1 实验（🧪 巩固学习，不进 Muse 主线）

| # | 实验 | 状态 | 结论 | 报告 |
|---|------|------|------|------|
| exp01 | 链式/并行/路由模式 | ✅ 完成 | 10/10 tests pass，3 种模式均验证通过 | [代码](../experiments/exp01-chain-parallel-route.mjs) · [测试](../experiments/exp01-chain-parallel-route.test.mjs) · [报告](#exp01-报告) |
| exp02 | Orchestrator 动态分配 | [ ] 待做 | — | — |
| exp03 | 人类审批 Gate | [ ] 待做 | — | — |
| exp04 | JS 版迷你 Swarm | [ ] 待做 | — | — |
| exp05 | 最简状态机 | [ ] 待做 | — | — |
| exp06 | 角色 Prompt 模板 | [ ] 待做 | — | — |
| exp07 | Prompt 分层注入 | [ ] 待做 | — | — |

---

## Sprint 1 消险（🔧 Muse 真用，提前踩坑排雷）

| # | 消险项 | 状态 | 风险等级 | 结论 | 报告 |
|---|--------|------|---------|------|------|
| R1 | notify_planner 可靠性 | ✅ 完成 | 🟡 5/10 | 3 个高风险点：session 失效/无重试/无超时 | [详细报告](../pre-validation/R1-notify-planner-reliability.md) |
| R2 | handoff_to_member 超时 | [ ] 待做 | — | — | — |
| R3 | MCP 工具注册完整性 | [ ] 待做 | — | — | — |
| R4 | prompt 注入风险 | [ ] 待做 | — | — | — |
| R5 | harness 端到端可用性 | [ ] 待做 | — | — | — |
| R6 | memory 持久化稳定性 | [ ] 待做 | — | — | — |

---

## 已完成任务详细报告

### exp01 报告

**任务**: 用纯 JS 实现 Anthropic BEA 中的 3 种基础编排模式  
**完成时间**: Day 01  
**代码**: `user/experiments/exp01-chain-parallel-route.mjs` (82 行)  
**测试**: `user/experiments/exp01-chain-parallel-route.test.mjs` (10 cases)

**验证结果**:

| 模式 | 测试场景 | 结果 |
|------|---------|------|
| **Chain** | 文本处理流水线 | ✅ 输出正确串联 |
| **Chain** | Muse: planner→arch→coder→reviewer | ✅ 上下文完整传递 |
| **Chain** | 空链处理 | ✅ 直接返回输入 |
| **Parallel** | 3 个检查器并行（语法/风格/安全） | ✅ 并行执行 ~20ms (非 ~60ms) |
| **Parallel** | Muse: 多 reviewer 并行打分 | ✅ 平均分正确聚合 |
| **Route** | 按内容分类到 coder/arch/pua | ✅ 分类准确 |
| **Route** | 未知类别处理 | ✅ 优雅报错 |
| **Route** | Muse: Orchestrator 意图路由 | ✅ chat/task/approval 分流正确 |

**对 Muse 的启发**:
1. Chain 模式最适合 Muse 的 planner→worker 流水线
2. Parallel 模式可用于多 reviewer 同时审查
3. Route 模式对应 Orchestrator 的意图分类（现有 Sisyphus 已有类似能力）
4. 三种模式可以组合使用：Route 在最前面分流，Chain 在内部串联

---

### R1 报告

**任务**: 分析 `notify_planner` MCP 工具的可靠性风险  
**完成时间**: Day 01  
**分析对象**: `src/mcp/callback-tools.mjs` (129 行)  
**详细报告**: `user/pre-validation/R1-notify-planner-reliability.md`

**核心发现**:

| 风险等级 | 数量 | 关键问题 |
|---------|------|---------|
| 🔴 高 | 3 | session 失效 / 无重试 / HTTP 无超时 |
| 🟡 中 | 3 | 竞态读写 / 204 空 body / 无幂等 |
| 🟢 低 | 2 | 消息格式 / 回调去重 |

**整体可靠性: 5/10**

**Sprint 4 接手须知**:
- ✅ Happy Path 可用，不阻塞学习
- ⚠️ 到 Spike 3 时**必须先修**: 超时 + 重试 + session 检测
- 💡 建议改为结构化 JSON 回调（不再靠 LLM 解析纯文本）
