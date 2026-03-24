# T42-2 上下文 — 为什么需要 prompt planner-mode

## 背景

T42 Planner 驱动模式需要 2 个行为变更来避免"双驱动"：

1. **workflow-prompt 改注入指令** — 当前 `compileNodePrompt()` 在 L194-197 告诉 active Muse "完成后调 workflow_transition"，在 L210-215 告诉 Muse "完成后立即调用 workflow_transition"。Planner 模式下应该改为"通知 Planner"。
2. **GateEnforcer 拦截 transition 工具** — 当前 `CAPABILITY_MAP.workflow_control` 包含 `workflow_transition`，active Muse 可以调用。Planner 模式下应该将 `workflow_transition` 从 active Muse 的能力中移除。

## 前置依赖

| 依赖 | 状态 | 说明 |
|------|------|------|
| T42-1 | ⚠️ 必须先完成 | definition.mjs 需要支持 `driver` 字段，`sm.definition.driver` 才可用 |

## 文件定位

| 文件 | 路径 | 当前行数 |
|------|------|---------|
| workflow-prompt.mjs | `muse/src/plugin/hooks/workflow-prompt.mjs` | 303 行 |
| gate-enforcer.mjs | `muse/src/workflow/gate-enforcer.mjs` | 298 行 |
| gate-enforcer.test.mjs | `muse/src/workflow/gate-enforcer.test.mjs` | 存在 |

## 关键代码段

### workflow-prompt.mjs 执行模式区域（L191-216）

```javascript
// L191-198: 系统通知头
sections.push(
  `[系统通知] 你在工作流「${wfDisplayName}」的「${node.id}」节点。` +
  `当前任务行为以节点要求为准（P2 日常行为让位），安全/身份边界持续生效。` +
  (node.wait_for_user ? '' : `完成后调 workflow_transition 推进。`)
)

// L201-216: 执行模式分叉
if (node.wait_for_user) {
  // "向用户展示内容，等待 Telegram 回复，再调 transition"
} else {
  // "完成后立即调用 workflow_transition 推进"
}
```

### gate-enforcer.mjs 能力映射（L19-25）

```javascript
const CAPABILITY_MAP = {
  workflow_control: ['workflow_list', 'workflow_status', 'workflow_transition',
                     'workflow_emit_artifact', 'workflow_retry_handoff', 'workflow_cancel_handoff'],
}
```

### compileNodePrompt 函数签名（L140）

```javascript
export function compileNodePrompt(node, sm, participantStatus)
```

`sm` 对象有 `sm.definition`（WorkflowDefinition 实例），T42-1 完成后会有 `sm.definition.driver`（`'self'` 或 `'planner'`）。
