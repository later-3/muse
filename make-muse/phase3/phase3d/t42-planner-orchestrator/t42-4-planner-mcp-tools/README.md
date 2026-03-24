# T42-4 Planner MCP 工具 — 开发任务书

> 给 AI 开发者：本文档是自包含的开发任务书。前置依赖 T42-1（admin override + meta + rollback + driver）和 T42-2（prompt 分叉 + gate 拦截）。

---

## 任务概述

新建 `src/mcp/planner-tools.mjs`，实现 Planner 专属的 6 个 MCP 工具，并在 `server.mjs` 中按 role 注册。

| 子任务 | 工具名 | 说明 |
|--------|--------|------|
| 4.1 | `workflow_create` | 创建 driver=planner 的工作流实例 |
| 4.2 | `workflow_admin_transition` | admin 身份推进，含 user gate 保护 |
| 4.3 | `workflow_inspect` | 全局视图（所有节点 + history） |
| 4.4 | `workflow_rollback` | 回退到已访问过的节点 |
| 4.5 | `handoff_to_member` | 向指定成员发送任务指令 |
| 4.6 | `read_artifact` | 读取工作流产出物 |
| 4.7 | 工具注册 | server.mjs 按 role 条件注册 |

---

## 子任务 4.1: workflow_create

### 输入

```json
{
  "name": "workflow_create",
  "description": "创建一个 Planner 驱动的工作流实例。传入工作流定义 JSON，Planner 统一管理实例生命周期。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "workflow_id": {
        "type": "string",
        "description": "工作流 ID 或工作流定义文件路径"
      },
      "task_id": {
        "type": "string",
        "description": "任务 ID（可选，默认自动生成）"
      }
    },
    "required": ["workflow_id"]
  }
}
```

### Handler 伪代码

```javascript
export async function handleWorkflowCreate(sessionId, args) {
  const { workflow_id, task_id } = args || {}
  if (!workflow_id) return textResult('缺少 workflow_id 参数')

  // 1. 加载工作流定义
  const raw = JSON.parse(await readFile(resolvedPath, 'utf-8'))

  // 2. 校验 driver=planner
  if (raw.driver !== 'planner') {
    return textResult('⛔ 此工作流不是 planner 驱动（driver !== "planner"）')
  }

  // 3. 创建 bindings — Planner 绑定自己的 session，其他角色全部 placeholder
  const bindings = raw.participants.map(p => ({
    role: p.role,
    sessionId: `${sessionId}_${p.role}`,
    placeholder: true,
  }))
  // Planner 自己也注册一个 binding（orchestrator 或第一个非执行角色）
  // 但 Planner 不是工作流参与者 — 他是外部指挥官
  // → 所有角色都是 placeholder，等 handoff_to_member 时创建真实 session

  // 4. 调用 initWorkflow
  const { sm, registry } = await initWorkflow({
    workflowPath: resolvedPath,
    taskId: task_id || `planner-${Date.now()}`,
    workspaceRoot: process.env.MUSE_ROOT || process.cwd(),
    bindings,
  })

  // 5. 持久化
  saveInstanceState(sm.instanceId, {
    workflowPath: resolvedPath,
    workflowId: sm.workflowId,
    instanceId: sm.instanceId,
    taskId: sm.taskId,
    bindings,
    smState: sm.toState(),
  })

  // 6. 返回
  return textResult(JSON.stringify({
    success: true,
    instance_id: sm.instanceId,
    workflow: raw.name || raw.id,
    driver: 'planner',
    current_node: sm.getCurrentNode()?.id,
    participants: raw.participants.map(p => p.role),
    hint: '实例已创建。用 handoff_to_member 向执行者分派任务。',
  }, null, 2))
}
```

### 与 workflow_init 的区别

| | workflow_init（执行者） | workflow_create（Planner） |
|-|------------------------|--------------------------|
| 调用者绑定 | 调用者绑定为初始节点参与者 | 所有角色都是 placeholder |
| driver 校验 | 无 | 必须 driver=planner |
| 返回 hint | "向用户描述目标" | "用 handoff_to_member 分派" |

---

## 子任务 4.2: workflow_admin_transition

### 输入

```json
{
  "name": "workflow_admin_transition",
  "description": "以 admin 身份推进工作流。Planner 专用。如果越过 actor=user 的 transition，必须提供 on_behalf_of 和 evidence。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "instance_id": {
        "type": "string",
        "description": "工作流实例 ID"
      },
      "event": {
        "type": "string",
        "description": "transition 事件名"
      },
      "reason": {
        "type": "string",
        "description": "推进原因（写入 history.meta）"
      },
      "on_behalf_of": {
        "type": "string",
        "description": "代表谁操作（'planner' 或 'user'）。越过 actor=user 的 transition 时必须为 'user'。"
      },
      "evidence": {
        "type": "string",
        "description": "用户原始确认消息（on_behalf_of=user 时必填）"
      }
    },
    "required": ["instance_id", "event"]
  }
}
```

### Handler 伪代码

```javascript
export async function handleWorkflowAdminTransition(sessionId, args) {
  const { instance_id, event, reason, on_behalf_of, evidence } = args || {}
  if (!instance_id || !event) return textResult('缺少必要参数')

  // 1. 获取实例
  const registry = getRegistry()
  const sm = registry?.getInstance(instance_id)
  if (!sm) return textResult(`实例 ${instance_id} 不存在`)

  // 2. ★ User Gate 保护
  const currentNode = sm.getCurrentNode()
  const transitionDef = currentNode?.transitions?.[event]
  if (!transitionDef) return textResult(`事件 "${event}" 不存在`)

  if (transitionDef.actor === 'user') {
    // 必须提供 on_behalf_of=user + evidence
    if (on_behalf_of !== 'user') {
      return textResult('⛔ 此 transition 的 actor 是 user，必须 on_behalf_of="user"')
    }
    if (!evidence || evidence.trim().length === 0) {
      return textResult('⛔ 越过 user gate 必须提供 evidence（用户原始确认消息）')
    }
  }

  // 3. 执行 transition（admin 身份 + meta）
  const meta = {
    on_behalf_of: on_behalf_of || 'planner',
    reason: reason || '',
    ...(evidence ? { evidence } : {}),
  }

  try {
    const result = sm.transition(event, 'admin', meta)

    // 4. 持久化
    const state = loadInstanceState(instance_id)
    if (state) {
      state.smState = sm.toState()
      saveInstanceState(instance_id, state)
    }

    return textResult(JSON.stringify({
      success: true,
      ...result,
      new_status: sm.status,
      meta,
    }, null, 2))
  } catch (e) {
    return textResult(`transition 失败: ${e.message}`)
  }
}
```

### User Gate 验证矩阵

| transitionDef.actor | on_behalf_of | evidence | 结果 |
|--------------------|--------------|---------|----|
| agent | 不填/planner | 不需要 | ✅ 通过 |
| agent | user | 不需要 | ✅ 通过 |
| user | 不填/planner | — | ❌ 拒绝 |
| user | user | 空 | ❌ 拒绝 |
| user | user | "用户说通过" | ✅ 通过 |

---

## 子任务 4.3: workflow_inspect

### 输入

```json
{
  "name": "workflow_inspect",
  "description": "查看工作流全貌。返回所有节点状态、history、产物清单。Planner 用于全局监控。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "instance_id": {
        "type": "string",
        "description": "工作流实例 ID"
      }
    },
    "required": ["instance_id"]
  }
}
```

### Handler 伪代码

```javascript
export async function handleWorkflowInspect(sessionId, args) {
  const { instance_id } = args || {}
  if (!instance_id) return textResult('缺少 instance_id')

  const registry = getRegistry()
  const sm = registry?.getInstance(instance_id)
  if (!sm) return textResult(`实例 ${instance_id} 不存在`)

  const state = sm.toState()

  return textResult(JSON.stringify({
    workflow: sm.workflowId,
    instance: sm.instanceId,
    task: sm.taskId,
    driver: sm.definition?.driver || 'self',
    status: sm.status,
    current_node: state.current,
    nodes: Object.entries(sm.definition.nodes).map(([id, node]) => ({
      id,
      type: node.type,
      participant: node.participant,
      objective: node.objective,
      is_current: id === state.current,
      visited: state.history.some(h => h.to === id),
    })),
    history: state.history,
    artifacts: state.artifacts,
  }, null, 2))
}
```

### 与 workflow_status 的区别

| | workflow_status（执行者） | workflow_inspect（Planner） |
|-|--------------------------|---------------------------|
| 视角 | 当前节点 + 我的角色 | 全局：所有节点 + 完整 history |
| 查找方式 | 按 sessionId | 按 instance_id |
| transition 显示 | 只显示 actor=agent | 全部显示 |
| history.meta | 不显示 | 显示（含 on_behalf_of/evidence） |

---

## 子任务 4.4: workflow_rollback

### 输入

```json
{
  "name": "workflow_rollback",
  "description": "将工作流回退到指定节点。只能回退到已经访问过的节点。回退原因写入 history。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "instance_id": {
        "type": "string",
        "description": "工作流实例 ID"
      },
      "target_node": {
        "type": "string",
        "description": "目标节点 ID（必须是已访问过的节点）"
      },
      "reason": {
        "type": "string",
        "description": "回退原因"
      }
    },
    "required": ["instance_id", "target_node", "reason"]
  }
}
```

### Handler 伪代码

```javascript
export async function handleWorkflowRollback(sessionId, args) {
  const { instance_id, target_node, reason } = args || {}
  if (!instance_id || !target_node || !reason) {
    return textResult('缺少必要参数')
  }

  const registry = getRegistry()
  const sm = registry?.getInstance(instance_id)
  if (!sm) return textResult(`实例 ${instance_id} 不存在`)

  try {
    // sm.rollback() 由 T42-1 实现
    const result = sm.rollback(target_node, { reason })

    // 持久化
    const state = loadInstanceState(instance_id)
    if (state) {
      state.smState = sm.toState()
      saveInstanceState(instance_id, state)
    }

    return textResult(JSON.stringify({
      success: true,
      ...result,
      new_status: sm.status,
      reason,
    }, null, 2))
  } catch (e) {
    return textResult(`rollback 失败: ${e.message}`)
  }
}
```

---

## 子任务 4.5: handoff_to_member

### 输入

```json
{
  "name": "handoff_to_member",
  "description": "向指定 Muse 成员分派当前节点的工作任务。Planner 将节点目标、步骤、约束组装成 prompt 发送给目标成员。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "instance_id": {
        "type": "string",
        "description": "工作流实例 ID"
      },
      "role": {
        "type": "string",
        "description": "目标角色（如 'pua', 'coder', 'arch'）"
      },
      "instructions": {
        "type": "string",
        "description": "Planner 附加指令（补充节点定义之外的上下文）"
      }
    },
    "required": ["instance_id", "role"]
  }
}
```

### Handler 伪代码

```javascript
export async function handleHandoffToMember(sessionId, args) {
  const { instance_id, role, instructions } = args || {}
  if (!instance_id || !role) return textResult('缺少必要参数')

  const registry = getRegistry()
  const sm = registry?.getInstance(instance_id)
  if (!sm) return textResult(`实例 ${instance_id} 不存在`)

  const currentNode = sm.getCurrentNode()
  if (!currentNode) return textResult('工作流已结束')

  // 验证 role 是否是当前节点的 participant
  if (currentNode.participant !== role) {
    return textResult(`当前节点 "${currentNode.id}" 的参与者是 "${currentNode.participant}"，不是 "${role}"`)
  }

  // 组装 handoff prompt
  // 复用现有 handoff 机制（family/handoff.mjs）
  try {
    const result = await triggerHandoff(sm, currentNode, 'planner', {
      extraInstructions: instructions,
    })

    return textResult(JSON.stringify({
      success: true,
      target_role: role,
      node: currentNode.id,
      handoff_status: 'triggered',
      hint: '已向成员发送任务。用 workflow_inspect 跟踪进度。',
    }, null, 2))
  } catch (e) {
    return textResult(`handoff 失败: ${e.message}`)
  }
}
```

> **注意**：具体的 handoff 触发方式需要参考现有 `src/family/handoff.mjs` 的实现。核心是通过 Telegram 或 Engine 向目标成员发送一条包含节点 prompt 的消息。

---

## 子任务 4.6: read_artifact

### 输入

```json
{
  "name": "read_artifact",
  "description": "读取工作流产出物文件内容。用于 Planner 检查执行者的产出质量。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "instance_id": {
        "type": "string",
        "description": "工作流实例 ID"
      },
      "name": {
        "type": "string",
        "description": "产出物文件名"
      }
    },
    "required": ["instance_id", "name"]
  }
}
```

### Handler 伪代码

```javascript
export async function handleReadArtifact(sessionId, args) {
  const { instance_id, name } = args || {}
  if (!instance_id || !name) return textResult('缺少必要参数')

  // 路径安全检查：不允许 ../ 和绝对路径
  if (name.includes('..') || name.startsWith('/')) {
    return textResult('⛔ 非法文件名')
  }

  const artDir = getArtifactDir(instance_id)
  if (!artDir) return textResult('无法获取 artifact 目录')

  const filePath = join(artDir, name)
  try {
    const content = await readFile(filePath, 'utf-8')
    return textResult(JSON.stringify({
      name,
      instance_id,
      content,
      size: content.length,
    }, null, 2))
  } catch (e) {
    return textResult(`读取失败: ${e.message}`)
  }
}
```

---

## 子任务 4.7: 工具注册

### 现状

`src/mcp/server.mjs` 中注册工具的位置需要确认，但模式是：

```javascript
import { WORKFLOW_TOOLS } from './workflow-tools.mjs'
// 注册所有工具
for (const tool of WORKFLOW_TOOLS) {
  server.tool(tool.name, tool.inputSchema, handler)
}
```

### 改动

```javascript
import { PLANNER_TOOLS, handleWorkflowCreate, ... } from './planner-tools.mjs'

// 按 role 条件注册
const memberRole = process.env.MUSE_ROLE || 'unknown'

if (memberRole === 'planner') {
  for (const tool of PLANNER_TOOLS) {
    server.tool(tool.name, tool.inputSchema, plannerHandler)
  }
}
```

> **注意**：具体的注册入口位置需要 grep `server.tool` 确认。

### 非 Planner 成员不注册这些工具

Planner 工具只在 `role=planner` 的成员上注册。执行者成员看不到这些工具。

---

## 注意事项

### ⚠️ 不要改的

1. **不改 workflow-tools.mjs** — 执行者工具保持不变
2. **不改 state-machine.mjs** — T42-1 的改动已经提供了 admin override + meta + rollback
3. **不改 gate-enforcer.mjs** — T42-2 的改动已经拦截了执行者的 transition

### ⚠️ 容易踩的坑

1. **registry.getInstance vs registry.getBySession** — Planner 工具用 `instance_id`（`getInstance()`），不是 `sessionId`（`getBySession()`）
2. **Planner 不是工作流参与者** — Planner 不绑定 session 到工作流。他是外部指挥官，通过 `instance_id` 操作
3. **meta 只在 admin_transition 中使用** — `workflow_create` / `workflow_inspect` / `workflow_rollback` 不需要 meta
4. **rollback 的 meta** — rollback 的参数是 `{ reason }`，不是 `{ on_behalf_of, evidence }`
5. **路径安全** — `read_artifact` 必须防止 `../` 路径穿越
6. **handoff 依赖** — `handoff_to_member` 需要复用 `src/family/handoff.mjs` 的机制，不要重新实现一套

### ⚠️ 项目规范

- **ESM only** — 所有文件使用 `import/export`
- **测试框架** — `node:test`（`describe`/`it`）+ `assert/strict`
- **日志** — `createLogger('planner-tools')`
- **运行测试** — `node --test src/mcp/planner-tools.test.mjs`
- **commit 格式** — `feat(t42-4): 简述`

---

## 测试策略

每个工具至少 3 个测试用例（正常 / 参数错误 / 边界条件）：

### workflow_create 测试

```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('workflow_create', () => {
  it('合法 planner 工作流 → 创建成功', async () => {
    // 准备 driver=planner 的工作流定义文件
    // 调用 handleWorkflowCreate
    // 验证返回 success=true, driver='planner'
  })

  it('driver=self 的工作流 → 拒绝', async () => {
    // 准备 driver=self 的工作流
    // 调用 → 返回错误信息包含 'driver'
  })

  it('缺少 workflow_id → 报错', async () => {
    // 调用不带参数 → 返回包含 '缺少'
  })
})
```

### workflow_admin_transition 测试

```javascript
describe('workflow_admin_transition', () => {
  it('agent transition + admin → 通过', async () => {
    // transitionDef.actor=agent, on_behalf_of=planner → 成功
  })

  it('user transition + no evidence → 拒绝', async () => {
    // transitionDef.actor=user, on_behalf_of=user, evidence='' → 失败
  })

  it('user transition + evidence → 通过', async () => {
    // transitionDef.actor=user, on_behalf_of=user, evidence='用户确认' → 成功
    // 验证 history 中 meta.evidence 存在
  })

  it('user transition + on_behalf_of=planner → 拒绝', async () => {
    // transitionDef.actor=user, on_behalf_of=planner → 失败
  })
})
```

### read_artifact 测试

```javascript
describe('read_artifact', () => {
  it('存在的文件 → 返回内容', async () => { /* ... */ })
  it('不存在的文件 → 报错', async () => { /* ... */ })
  it('../ 路径穿越 → 拒绝', async () => { /* ... */ })
  it('绝对路径 → 拒绝', async () => { /* ... */ })
})
```

---

## 验收检查清单

| # | 检查项 | 验证方法 |
|---|--------|---------|
| 1 | planner-tools.mjs 文件创建 | 文件存在 |
| 2 | 6 个工具定义在 PLANNER_TOOLS 数组 | 代码检查 |
| 3 | workflow_create: driver=planner 校验 | 测试 |
| 4 | workflow_create: 所有 binding 都是 placeholder | 测试 |
| 5 | admin_transition: agent actor → 通过 | 测试 |
| 6 | admin_transition: user actor + 无 evidence → 拒绝 | 测试 |
| 7 | admin_transition: user actor + evidence → 通过 | 测试 |
| 8 | admin_transition: meta 写入 history | 测试 |
| 9 | admin_transition: 持久化后重启恢复 | 测试 |
| 10 | workflow_inspect: 返回所有节点 + history | 测试 |
| 11 | workflow_rollback: 成功回退 + 持久化 | 测试 |
| 12 | workflow_rollback: 未访问节点 → 拒绝 | 测试 |
| 13 | handoff_to_member: 触发 handoff | 测试 |
| 14 | handoff_to_member: 错误 role → 拒绝 | 测试 |
| 15 | read_artifact: 正常读取 | 测试 |
| 16 | read_artifact: ../ 路径穿越 → 拒绝 | 测试 |
| 17 | server.mjs: role=planner → 注册 Planner 工具 | grep 检查 |
| 18 | server.mjs: role!=planner → 不注册 Planner 工具 | grep 检查 |
| 19 | 所有测试通过 | `node --test src/mcp/planner-tools.test.mjs` |
