# T10.5: Hook / Plugin / Bus 基座

> **第一批 原生基座** — 与 T10/T11/T12 并行
> **详细方案**: [context.md](./context.md)
> **评审**: ✅ 通过 (见 context.md 末尾评审报告)

## 定位

**Hook/Plugin/Bus 是 Muse 的生命周期拦截层** — 它让 Muse 能在 OpenCode 的关键节点注入自己的逻辑。

- **是**：OpenCode 生命周期的拦截和增强
- **是**：Muse 自动化行为的运行时触发器
- **是**：未来 Pulse / Gap / 审批链 / 状态桥的挂点层
- **不是**：行为策略指导 (→ T10 Skill)
- **不是**：能力载体 (→ T11 MCP)
- **不是**：身份人格 (→ T12 AGENTS.md)
- **不是**：Orchestrator 的平移替代

### 优先级层级

```
AGENTS.md (身份/全局)         ← T12
    ↓
Skill (场景策略)              ← T10
    ↓
Plugin Hook (生命周期拦截)    ← T10.5 ← 本任务
    ↓
MCP / Custom Tool (能力实现)  ← T11
```

## 背景

Phase 1 所有自动化行为 (记忆注入、偏好提取、意图分类) 硬编码在 Orchestrator 内。
T10.5 将这些行为迁移到 OpenCode 原生 Plugin+Hook 机制：
- **chat.system.transform**: 动态上下文注入 (时间等，**不承载人格**)
- **tool.execute.after**: 运行时审计日志
- **event**: 关键事件监听 (Session.Error/Idle/Created)
- **Session.Error**: 预留 Gap Journal 桥接 (T16)
- **Session.Idle**: 预留主动触发 (P3 Pulse)

## 与其他任务的关系

| 任务 | 关系 | 边界 |
|------|------|------|
| **T10** Skill ✅ | Hook + Skill 形成"策略+生命周期"闭环 | Skill 定义策略，Hook 在运行时触发 |
| **T11** Memory MCP ✅ | `tool.execute.after` 做运行时审计 | Hook 不接管记忆语义决策，只触发和观察 |
| **T12** Identity | `chat.system.transform` 补动态信息 | **人格主载体仍是 AGENTS.md**，Hook 不重复 |
| **T13** Orchestrator | Hook 接手部分自动化逻辑 | **不能把胖 Orchestrator 平移成胖 Plugin** |
| **T16** Gap Journal | `Session.Error` → 桥接错误事件 | P2 先做错误桥接，Gap 语义由 T16 定义 |
| **P3** Pulse | `Session.Idle` → 预留主动消息触发 | P2 只注册事件，P3 实现逻辑 |

## 评审要求的 4 个守则

1. **`chat.system.transform` 只补动态上下文** — 不能重新承载人格 (人格归 AGENTS.md)
2. **Hook 只负责触发和观察** — 不替 AI 做重决策，不写 if/else 业务逻辑
3. **event 不全量落盘** — 只记录关键事件 (Session.Created/Error/Idle + tool.execute)，过滤 PartDelta/Updated 等高频事件
4. **运行时审计 vs 领域审计分层** — T10.5 的 tool-calls.jsonl 是运行时审计，T11 的 memory_audit 是领域审计，不混不替

## 目标

### 第一阶段: Plugin 壳子 + 核心 Hook (本次)

1. 编写 Muse Plugin (`muse/plugin/index.mjs`)
2. opencode.json 注册 Plugin (`plugin: ["file://..."]`)
3. 实现 `event` hook — 接收**关键** Bus 事件 (白名单过滤)
4. 实现 `chat.message` hook — 消息到达时记录元信息
5. 实现 `tool.execute.after` hook — 工具调用运行时审计
6. 实现 `experimental.chat.system.transform` hook — 动态上下文 (仅时间等)

### 第二阶段: 预留点位 (本次注册，不实现)

7. `permission.ask` — 预留审批链 (Phase 4)
8. `Session.Idle` event — 预留 Pulse 触发 (Phase 3)
9. `Session.Error` event — 预留 Gap Journal 桥接 (T16)

## 验收 (三层验证)

| 层 | # | 标准 | 验证方式 |
|----|---|------|---------|
| **文件层** | 1 | Plugin 文件存在，格式合规 | unit test |
| **注册层** | 2 | opencode.json 包含 Plugin 注册 | unit test |
| **行为层** | 3 | Hook 在 OpenCode 运行时被调用 | E2E `--print-logs` 检查 hook 日志 |
| 事件流 | 4 | 关键 Bus 事件被接收并记录 | E2E 检查事件日志文件 |
| 降级 | 5 | Plugin 异常不影响主链路 | unit test: hook 抛错 → 主流程继续 |

### 验证边界

| ✅ T10.5 自身验收 | ⏳ 待后续任务联动 |
|-------------------|------------------|
| Plugin 注册并加载成功 | chat.system.transform 与 T12 AGENTS.md 联动 |
| event hook 接收关键事件 | T13 Orchestrator 逻辑迁移到 Hook |
| tool.execute.after 运行时审计 | Session.Error → T16 Gap 记录 |
| Plugin 异常降级不崩 | Session.Idle → P3 Pulse 触发 |

