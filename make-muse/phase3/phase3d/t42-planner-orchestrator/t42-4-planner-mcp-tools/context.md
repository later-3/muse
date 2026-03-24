# T42-4 上下文 — Planner MCP 工具

## 背景

Planner 需要自己的 MCP 工具集。现有 `workflow-tools.mjs` 的工具是给**执行者**（pua/arch/coder）用的，Planner 的工具语义不同：

| 执行者工具 | Planner 工具 | 区别 |
|-----------|-------------|------|
| `workflow_init` | `workflow_create` | Planner 解析 role→member 映射，创建 driver=planner 实例 |
| `workflow_transition` | `workflow_admin_transition` | 用 admin actor，强制 user gate 证据 |
| `workflow_status` | `workflow_inspect` | 返回全局视图（所有节点），不是当前节点视图 |
| — | `workflow_rollback` | 执行者没有回退能力 |
| — | `handoff_to_member` | 向指定成员发送任务指令 |
| — | `read_artifact` | 读取工作流产出物进行质量检查 |

## 前置依赖

| 依赖 | 状态 | 说明 |
|------|------|------|
| T42-1 | ⚠️ 必须先完成 | admin override / meta / rollback / driver 字段 |
| T42-2 | ⚠️ 必须先完成 | prompt 分叉 + gate 拦截（否则执行者也能调 transition） |

## 文件定位

| 文件 | 路径 | 说明 |
|------|------|------|
| workflow-tools.mjs (现有) | `src/mcp/workflow-tools.mjs` | 执行者工具，655行 |
| planner-tools.mjs (新建) | `src/mcp/planner-tools.mjs` | Planner 专属工具 |
| memory.mjs (注册入口) | `src/mcp/memory.mjs` | L858 ListTools + L863 CallTool switch |

## 关键代码模式

### 工具定义格式

```javascript
export const PLANNER_TOOLS = [
  {
    name: 'workflow_create',
    description: '...',
    inputSchema: {
      type: 'object',
      properties: { /* ... */ },
      required: ['...'],
    },
  },
]
```

### Handler 模式

```javascript
export async function handleWorkflowCreate(sessionId, args) {
  // 1. 参数校验
  // 2. 业务逻辑
  // 3. 持久化
  // 4. return textResult(JSON.stringify({...}, null, 2))
}
```

### 工具注册

在 `server.mjs` 中注册时，需要判断当前成员 role 是否为 planner：

```javascript
if (memberRole === 'planner') {
  tools.push(...PLANNER_TOOLS)
}
```
