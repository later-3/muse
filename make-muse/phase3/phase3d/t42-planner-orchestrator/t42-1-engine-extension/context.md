# T42-1 上下文 — 为什么需要 engine extension

## 背景

T42 Planner Orchestrator 需要 Planner Muse 统一驱动工作流。但当前 T39 引擎有 3 个缺口阻止这个模型跑通：

1. **StateMachine.transition() 不支持 admin override** — actor 校验是严格相等，`admin` 不能触发 `actor: 'agent'` 的 transition
2. **StateMachine.transition() 没有 meta 参数** — 所有 transition 在 history 里只记 `{from, to, event, actor, ts}`，无法区分"用户确认"和"Planner 自主推进"
3. **StateMachine 没有 rollback API** — 只有正向 transition，当 Planner 需要回退到之前的节点时无法操作
4. **WorkflowRegistry 只有 getBySession()** — Planner 需要按 instance_id 查找 SM（不依赖 session 绑定）
5. **WorkflowDefinition 不校验 driver/max_iterations/rollback_target** — T42 新增字段没有校验

## 文件定位

| 文件 | 路径 | 当前行数 |
|------|------|---------|
| state-machine.mjs | `muse/src/workflow/state-machine.mjs` | 309 行 |
| state-machine.test.mjs | `muse/src/workflow/state-machine.test.mjs` | 354 行 |
| definition.mjs | `muse/src/workflow/definition.mjs` | 227 行 |
| definition.test.mjs | `muse/src/workflow/definition.test.mjs` | 存在 |
| registry.mjs | `muse/src/workflow/registry.mjs` | 227 行 |
| registry.test.mjs | `muse/src/workflow/registry.test.mjs` | 存在 |

## 依赖关系

T42-1 是 T42 的第一个子任务，无前置依赖。后续 T42-2（prompt 分叉）、T42-4（Planner MCP 工具）都依赖本任务的改动。
