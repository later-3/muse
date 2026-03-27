# Sprint 4：Spike 2 (Memory) + MVP 场景锚定

> **Sprint 目标：** 验证 Memory 分层假设，锁定 3 个 MVP 场景的详细 AC。  
> **服务于：** 全景图域 2（Memory）+ Phase 2.5（场景锚定）  
> **前置条件：** Sprint 3 完成

---

## 每日任务清单

### 第 1 天：Spike 2 设计

- [ ] 写设计文档：`user/spikes/spike-2-memory-design.md`
  - 验证假设：短期+长期分层设计可以在 context window 约束下工作
  - 技术选型：SQLite + recall/store MCP 工具接口 + context 装配器
  - 成功标准：跨 session 记忆 + context 不超限 + recall <200ms
- [ ] 确认不做：向量检索、语义记忆、共享 scope

### 第 2-4 天：Spike 2 实现

- [ ] 实现 SQLite 存储层（store_memory / recall_memory）
- [ ] 实现 context 装配器（token 预算内装配最相关上下文）
- [ ] 集成到 Spike 1 的 Core Loop 上
- [ ] 代码存放：`user/spikes/spike-2-memory/`

### 第 5 天：Spike 2 验证

- [ ] 测试跨 session 记忆保持
- [ ] 测试 context window 溢出处理
- [ ] 记录验证结果：`user/spikes/spike-2-memory-report.md`

### 第 6-7 天：MVP 场景锚定

- [ ] 细化 S1（日常对话）的用户故事和验收标准
- [ ] 细化 S2（muse-harness）的用户故事和验收标准
- [ ] 细化 S3（审批）的用户故事和验收标准
- [ ] 产出：`user/mvp-scenario-spec.md`
- [ ] 确认 Spike 与场景的映射关系

### 第 8 天：3 Spike 综合评审

- [ ] 回顾 Spike 1/2/3 的验证结果
- [ ] 判断：3 个 Spike 中至少 2 个 pass？
- [ ] 提炼：哪些设计决策可以带入 Architecture v2
- [ ] 产出：`user/spike-synthesis.md`

### 第 9-10 天：Sprint 4 复盘

- [ ] mini-eval：
  - [ ] Memory Spike 跑通？
  - [ ] 3 个场景有完整 AC？
  - [ ] 3 个 Spike 中至少 2 个 pass？
- [ ] 写复盘：`user/sprint-4-retro.md`
- [ ] **判断：Phase 3 退出条件是否达标？**

---

## 交付物清单

| # | 交付物 | 状态 |
|---|-------|------|
| 1 | `user/spikes/spike-2-memory-design.md` | [ ] |
| 2 | `user/spikes/spike-2-memory/` (代码) | [ ] |
| 3 | `user/spikes/spike-2-memory-report.md` | [ ] |
| 4 | `user/mvp-scenario-spec.md` | [ ] |
| 5 | `user/spike-synthesis.md` | [ ] |
| 6 | `user/sprint-4-retro.md` | [ ] |
