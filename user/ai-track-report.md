# AI 并行轨道 — 任务看板

> **你忙完了来这里看 AI 干了啥。所有文件都在对应的 `dayXX/` 下。**

---

## Sprint 1 实验（🧪 巩固学习）— 全部完成 ✅

| # | 实验 | Day | Tests | 核心验证 |
|---|------|-----|-------|---------|
| exp01 | 链式/并行/路由 | 01 | 10/10 ✅ | Chain 传递完整 / Parallel 并行~20ms / Route 分类准确 |
| exp02 | Orchestrator | 02 | 4/4 ✅ | 动态匹配 Worker / 多轮编排 / maxRounds 保护 |
| exp03 | HITL Gate | 03 | 6/6 ✅ | 低风险自动放行 / 高风险拦截 / approve+reject / 防重复 |
| exp04 | Mini Swarm | 04 | 5/5 ✅ | Agent Handoff / 多级传递 / 缺失目标处理 |
| exp05 | 状态机 | 05 | 6/6 ✅ | 状态转换 / Guard 条件 / History / Muse 工作流模拟 |
| exp06 | 角色 Prompt | 06 | 3/3 ✅ | Role 定义 / Team 组装 / Muse 4角色 prompt 生成 |
| exp07 | Prompt 分层 | 07 | 5/5 ✅ | 7 层顺序 / 动态增删 / Token 估算 |

**总计: 39/39 tests pass** 🎉

---

## Sprint 1 消险（🔧 Muse 真用）— 全部完成 ✅

| # | 消险项 | Day | 评分 | 核心发现 | Sprint 接手须知 |
|---|--------|-----|------|---------|---------------|
| R1 | notify_planner | 01 | 🟡 5/10 | session 失效/无重试/无超时 | Sprint 4: 加超时+重试+session检测 |
| R2 | handoff 超时 | 02 | 🟡 6/10 | prompt 无超时/无全局 handoff 超时 | Sprint 4: 加全局超时+retry自动重执行 |
| R3 | MCP 工具完整性 | 03 | 🟢 7/10 | 23个工具已审计/角色隔离不足/API Key暴露 | Sprint 4: 按角色注册工具+移除硬编码Key |
| R4 | Prompt 注入 | 04 | 🟡 5/10 | workflow_json 无 schema/回调消息可注入 | Sprint 4+: 加 schema 校验+sanitize |
| R5 | Harness E2E | 05 | 🟡 6/10 | 正常~80%/异常~30%/LLM不遵守指令是最大风险 | Sprint 4: 加催促机制+强制检查 |
| R6 | Memory 持久化 | 06 | 🟢 7/10 | 无备份/无迁移，但数据模型设计好 | Sprint 2: 加定期备份+长度限制 |

---

## 风险热力图

```
           正常路径   Planner重启   网络抖动   LLM不遵守
notify      🟢        🔴           🔴         —
handoff     🟢        🟡           🟡         —
MCP工具     🟢        🟢           🟢         🟡
Memory      🟢        🟢           🟢         —
E2E整体     🟢        🔴           🟡         🔴
```

**一句话总结**: Happy Path 基本可用，**Planner 重启** 和 **LLM 不遵守指令** 是两个最大的系统性风险。Sprint 4 Spike 3 时集中修复。
