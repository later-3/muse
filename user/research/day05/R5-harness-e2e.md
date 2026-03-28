# R5: Harness 端到端可用性检查

> **消险任务**: 评估 Muse harness (planner→worker) 端到端流程的可用性  
> **分析对象**: `planner-tools.mjs` + `callback-tools.mjs` + `handoff.mjs`

---

## 端到端链路

```
用户说 "帮我重构 X"
  → Planner 调用 workflow_create(workflow_json)     ← AI 自主生成
  → Planner 展示工作流给 Later                      ← User Gate
  → Later 确认
  → Planner 调用 handoff_to_member(role="coder")
    → createSession → waitForMcpReady → prompt      ← 2-step 协议
  → Coder 执行任务
  → Coder 调用 notify_planner(status="done")
    → HTTP POST → Planner session 注入              ← 回调
  → Planner 用 read_artifact 检查
  → Planner 调用 workflow_admin_transition("done")
  → 工作流完成
```

## 各环节风险评估

| 环节 | 可靠性 | 关键风险 | 详见 |
|------|--------|---------|------|
| workflow_create | 🟢 8/10 | workflow_json 无 schema 校验 | R4 |
| User Gate 确认 | 🟢 9/10 | 设计完善，有 evidence 校验 | — |
| handoff_to_member | 🟡 6/10 | prompt 无超时，MCP 超时仍发 | R2 |
| Worker 执行 | 🟡 5/10 | 依赖 LLM 遵守指令（不保证） | — |
| notify_planner | 🟡 5/10 | session 失效/无重试/无超时 | R1 |
| read_artifact | 🟢 8/10 | 有路径安全检查 | — |
| workflow_transition | 🟢 8/10 | 状态机逻辑完善 | — |

## 端到端成功率估计

```
正常条件 (所有服务在线): ~80%
  主要失败原因: LLM 不调 notify_planner (~15%)
              MCP 工具冷启动竞态 (~5%)

异常条件 (Planner 重启): ~30%
  主要失败原因: session 失效 (R1) + 无重试
```

## 整体评估: 🟡 6/10

Happy Path 基本可用，但 LLM 不遵守指令是最大不确定性。建议 Sprint 4 加 ensureNodeCompletion 超时催促 + 强制 notify_planner 检查。
