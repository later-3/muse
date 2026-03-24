# T42-1 T39 引擎扩展 — 开发任务书

> 给 AI 开发者：本文档是自包含的开发任务书，包含所有改动、测试用例、注意事项。

---

## 任务概述

修改 T39 工作流引擎的 3 个核心文件，为 Planner 驱动模式提供基础设施支持。

| 子任务 | 文件 | 改动量 |
|--------|------|--------|
| 1.1 admin override | `src/workflow/state-machine.mjs` | 1 行 |
| 1.2 transition meta | `src/workflow/state-machine.mjs` | 3 行 |
| 1.3 driver 字段校验 | `src/workflow/definition.mjs` | ~10 行 |
| 1.4 max_iterations / rollback_target 校验 | `src/workflow/definition.mjs` | ~15 行 |
| 1.5 rollback() API | `src/workflow/state-machine.mjs` | ~30 行 |

> **注意**：`WorkflowRegistry` 已有 `getInstance(instanceId)` 方法（`registry.mjs:134`），不需要新增任何 registry 代码。后续 T42-4 的 `workflow_admin_transition` 直接使用 `registry.getInstance(instance_id)` 即可。

---

## 子任务 1.1: admin override

### 现状

`state-machine.mjs` 第 110 行，actor 校验是严格相等：

```javascript
// state-machine.mjs:110
if (transitionDef.actor && transitionDef.actor !== actor) {
  throw new TransitionError(
    `Transition "${event}" 需要 ${transitionDef.actor} 触发，当前 actor 是 ${actor}`,
    { node: node.id, event, required: transitionDef.actor, actual: actor },
  )
}
```

### 改动

```diff
- if (transitionDef.actor && transitionDef.actor !== actor) {
+ if (transitionDef.actor && transitionDef.actor !== actor && actor !== 'admin') {
```

### 语义

- `admin` 可以触发任何 transition，无视 `transitionDef.actor` 约束
- `agent`/`user`/`system` 行为不变

### 测试用例

```javascript
// 新增到 state-machine.test.mjs

describe('StateMachine — Admin Override', () => {
  it('admin 触发 actor=agent 的 transition → 成功', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    // analyze → review, transition actor=agent
    const result = sm.transition('submit', 'admin')
    assert.equal(result.to, 'review')
    assert.equal(sm.currentNodeId, 'review')
  })

  it('admin 触发 actor=user 的 transition → 成功', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')  // → review
    // review → execute, transition actor=user
    const result = sm.transition('approve', 'admin')
    assert.equal(result.to, 'execute')
    assert.equal(sm.currentNodeId, 'execute')
  })

  it('system 触发 actor=agent 的 transition → 仍然拒绝', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    assert.throws(
      () => sm.transition('submit', 'system'),
      (err) => {
        assert.ok(err instanceof TransitionError)
        assert.equal(err.details.required, 'agent')
        assert.equal(err.details.actual, 'system')
        return true
      },
    )
  })

  it('admin override 的 history 记录 actor=admin', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'admin')
    const entry = sm.history.at(-1)
    assert.equal(entry.actor, 'admin')
    assert.equal(entry.event, 'submit')
  })
})
```

---

## 子任务 1.2: transition meta 参数

### 现状

`state-machine.mjs` 第 90 行，`transition()` 签名只接受 `event` 和 `actor`：

```javascript
transition(event, actor) {
  // ...
  this.#state.history.push({ from, to, event, actor, ts: Date.now() })
}
```

### 改动

修改签名，新增可选 `meta` 参数，写入 history：

```diff
- transition(event, actor) {
+ transition(event, actor, meta) {
```

```diff
- this.#state.history.push({ from, to, event, actor, ts: Date.now() })
+ this.#state.history.push({ from, to, event, actor, ts: Date.now(), ...(meta ? { meta } : {}) })
```

同时更新 JSDoc：

```diff
  /**
   * @param {string} event - transition 事件名
   * @param {string} actor - 触发者身份（agent/user/admin/system）
+  * @param {object} [meta] - 可选的审计元数据，会写入 history
+  * @param {string} [meta.on_behalf_of] - 实际决策者（user/planner）
+  * @param {string} [meta.evidence] - 决策证据
   * @returns {{ from: string, to: string, event: string }}
   * @throws {TransitionError}
   */
```

### 测试用例

```javascript
describe('StateMachine — Transition Meta', () => {
  it('不传 meta → history 无 meta 字段', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    const entry = sm.history.at(-1)
    assert.equal(entry.meta, undefined)
  })

  it('传入 meta → history 包含 meta', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'admin', {
      on_behalf_of: 'planner',
      evidence: '质量检查通过',
    })
    const entry = sm.history.at(-1)
    assert.deepEqual(entry.meta, {
      on_behalf_of: 'planner',
      evidence: '质量检查通过',
    })
  })

  it('meta 不影响 transition 逻辑', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'admin', { on_behalf_of: 'user', evidence: '通过' })
    assert.equal(sm.currentNodeId, 'review')
  })

  it('toState/fromState 保留 meta', () => {
    const def = devWorkflow()
    const sm1 = new StateMachine(def, { taskId: 't1' })
    sm1.transition('submit', 'admin', { on_behalf_of: 'user', evidence: '通过' })
    const state = sm1.toState()
    const sm2 = StateMachine.fromState(def, state)
    const entry = sm2.history.at(-1)
    assert.deepEqual(entry.meta, { on_behalf_of: 'user', evidence: '通过' })
  })
})
```

---

## 子任务 1.3: definition.mjs 新增 driver 字段校验

### 现状

`definition.mjs` 的 `parseWorkflow()` 不认识 `driver` 字段。

### 改动

在 `parseWorkflow()` 的校验逻辑中新增：

```javascript
// 新增常量
export const DRIVER_TYPES = new Set(['self', 'planner'])

// 在 parseWorkflow 校验中新增
if (raw.driver !== undefined) {
  if (!DRIVER_TYPES.has(raw.driver)) {
    errors.push(`未知 driver "${raw.driver}"，合法值: ${[...DRIVER_TYPES].join(', ')}`)
  }
}
```

同时确保 `WorkflowDefinition` 类暴露 `driver` 属性：

```javascript
// WorkflowDefinition 类中
get driver() { return this.#raw.driver || 'self' }
```

### 测试用例

```javascript
// 新增到 definition.test.mjs

describe('WorkflowDefinition — driver 校验', () => {
  it('driver=self → 合法', () => {
    const def = parseWorkflow({ ...validWorkflow(), driver: 'self' })
    assert.equal(def.driver, 'self')
  })

  it('driver=planner → 合法', () => {
    const def = parseWorkflow({ ...validWorkflow(), driver: 'planner' })
    assert.equal(def.driver, 'planner')
  })

  it('driver 省略 → 默认 self', () => {
    const def = parseWorkflow(validWorkflow())
    assert.equal(def.driver, 'self')
  })

  it('driver=xxx → 报错', () => {
    assert.throws(
      () => parseWorkflow({ ...validWorkflow(), driver: 'xxx' }),
      (err) => err.errors?.some(e => e.includes('driver')),
    )
  })
})
```

> **注意**：`definition.test.mjs` 里应该已有一个 `validWorkflow()` 辅助函数或类似的 fixture。如果没有，参考 `state-machine.test.mjs` 的 `devWorkflow()` 模式创建。

---

## 子任务 1.4: max_iterations / rollback_target 校验

### 改动

在 `parseWorkflow()` 的节点校验循环中新增：

```javascript
// 在 for (const [nodeId, node] of Object.entries(raw.nodes)) 内

// max_iterations（可选，正整数）
if (node.max_iterations !== undefined) {
  if (!Number.isInteger(node.max_iterations) || node.max_iterations < 1) {
    errors.push(`${prefix}: "max_iterations" 必须是正整数`)
  }
}

// rollback_target（可选，必须指向已声明的节点）
if (node.rollback_target !== undefined) {
  if (typeof node.rollback_target !== 'string') {
    errors.push(`${prefix}: "rollback_target" 必须是字符串`)
  } else if (!raw.nodes[node.rollback_target]) {
    errors.push(`${prefix}: "rollback_target" 指向不存在的节点 "${node.rollback_target}"`)
  }
}
```

### 测试用例

```javascript
describe('WorkflowDefinition — max_iterations / rollback_target', () => {
  it('max_iterations=3 → 合法', () => {
    const wf = validWorkflow()
    wf.nodes[Object.keys(wf.nodes)[0]].max_iterations = 3
    const def = parseWorkflow(wf)
    assert.ok(def)
  })

  it('max_iterations=0 → 报错', () => {
    const wf = validWorkflow()
    wf.nodes[Object.keys(wf.nodes)[0]].max_iterations = 0
    assert.throws(
      () => parseWorkflow(wf),
      (err) => err.errors?.some(e => e.includes('max_iterations')),
    )
  })

  it('max_iterations=-1 → 报错', () => {
    const wf = validWorkflow()
    wf.nodes[Object.keys(wf.nodes)[0]].max_iterations = -1
    assert.throws(
      () => parseWorkflow(wf),
      (err) => err.errors?.some(e => e.includes('max_iterations')),
    )
  })

  it('max_iterations=1.5 → 报错', () => {
    const wf = validWorkflow()
    wf.nodes[Object.keys(wf.nodes)[0]].max_iterations = 1.5
    assert.throws(
      () => parseWorkflow(wf),
      (err) => err.errors?.some(e => e.includes('max_iterations')),
    )
  })

  it('rollback_target 指向已有节点 → 合法', () => {
    const wf = validWorkflow()
    const nodeIds = Object.keys(wf.nodes)
    if (nodeIds.length >= 2) {
      wf.nodes[nodeIds[1]].rollback_target = nodeIds[0]
    }
    const def = parseWorkflow(wf)
    assert.ok(def)
  })

  it('rollback_target 指向不存在的节点 → 报错', () => {
    const wf = validWorkflow()
    wf.nodes[Object.keys(wf.nodes)[0]].rollback_target = 'nonexistent'
    assert.throws(
      () => parseWorkflow(wf),
      (err) => err.errors?.some(e => e.includes('rollback_target')),
    )
  })
})
```

---

## 子任务 1.5: StateMachine.rollback() API

### 改动

在 `StateMachine` 类中新增 `rollback()` 方法：

```javascript
/**
 * 回退到之前访问过的节点
 * @param {string} targetNodeId - 目标节点 ID（必须在 history 中出现过）
 * @param {string} actor - 触发者（必须是 'system' 或 'admin'）
 * @param {string} reason - 回退原因
 * @param {object} [meta] - 可选审计元数据
 * @returns {{ from: string, to: string }}
 * @throws {TransitionError}
 */
rollback(targetNodeId, actor, reason, meta) {
  // 1. 状态校验
  if (this.#state.status !== 'running' && this.#state.status !== 'paused') {
    throw new TransitionError(
      `工作流已 ${this.#state.status}，不能 rollback`,
      { status: this.#state.status },
    )
  }

  // 2. targetNodeId 必须在 history 中出现过
  const visited = new Set()
  for (const h of this.#state.history) {
    if (h.to) visited.add(h.to)
    if (h.from) visited.add(h.from)
  }
  if (!visited.has(targetNodeId)) {
    throw new TransitionError(
      `不能回退到未访问过的节点 "${targetNodeId}"`,
      { targetNodeId, visited: [...visited] },
    )
  }

  // 3. 目标节点必须存在于定义中
  const targetNode = this.#definition.getNode(targetNodeId)
  if (!targetNode) {
    throw new TransitionError(
      `目标节点 "${targetNodeId}" 不存在`,
      { targetNodeId },
    )
  }

  // 4. actor 只能是 system 或 admin
  if (!['system', 'admin'].includes(actor)) {
    throw new TransitionError(
      `rollback 只能由 system 或 admin 触发，当前: ${actor}`,
      { actor },
    )
  }

  // 5. 执行回退
  const from = this.#state.current_node
  this.#state.current_node = targetNodeId
  this.#state.history.push({
    from,
    to: targetNodeId,
    event: 'rollback',
    actor,
    reason,
    ts: Date.now(),
    ...(meta ? { meta } : {}),
  })

  // 6. 恢复状态
  if (this.#state.status === 'paused') {
    this.#state.status = 'running'
  }

  log.info('工作流回退', { instance: this.instanceId, from, to: targetNodeId, reason })

  // 7. ★ 触发 listener（与 transition() 一致的可观测性）
  const result = { from, to: targetNodeId, event: 'rollback' }
  this.#fireListeners(result)
  return result
}
```

### 测试用例

```javascript
describe('StateMachine — Rollback', () => {
  it('回退到已访问的节点 → 成功', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')  // analyze → review
    const result = sm.rollback('analyze', 'admin', '产出不合格')
    assert.equal(result.from, 'review')
    assert.equal(result.to, 'analyze')
    assert.equal(sm.currentNodeId, 'analyze')
  })

  it('回退到未访问的节点 → 拒绝', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    // 只访问了 analyze，还没到 execute
    assert.throws(
      () => sm.rollback('execute', 'admin', 'test'),
      (err) => {
        assert.ok(err instanceof TransitionError)
        assert.ok(err.message.includes('未访问'))
        return true
      },
    )
  })

  it('agent 不能触发 rollback → 拒绝', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    assert.throws(
      () => sm.rollback('analyze', 'agent', 'test'),
      (err) => {
        assert.ok(err instanceof TransitionError)
        assert.ok(err.message.includes('system 或 admin'))
        return true
      },
    )
  })

  it('user 不能触发 rollback → 拒绝', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    assert.throws(
      () => sm.rollback('analyze', 'user', 'test'),
      TransitionError,
    )
  })

  it('rollback 的 history 记录', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    sm.rollback('analyze', 'admin', '产出不合格')
    const entry = sm.history.at(-1)
    assert.equal(entry.event, 'rollback')
    assert.equal(entry.from, 'review')
    assert.equal(entry.to, 'analyze')
    assert.equal(entry.actor, 'admin')
    assert.equal(entry.reason, '产出不合格')
  })

  it('rollback 带 meta', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    sm.rollback('analyze', 'admin', '用户要求退回', {
      on_behalf_of: 'user',
      evidence: '用户消息: "退回"',
    })
    const entry = sm.history.at(-1)
    assert.equal(entry.meta.on_behalf_of, 'user')
  })

  it('已完成的工作流 → rollback 拒绝', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    sm.transition('approve', 'user')
    sm.transition('done', 'agent')
    assert.equal(sm.status, 'completed')
    assert.throws(
      () => sm.rollback('analyze', 'admin', 'test'),
      TransitionError,
    )
  })

  it('rollback 后可以继续正常 transition', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')  // → review
    sm.rollback('analyze', 'admin', '重做')  // → analyze
    sm.transition('submit', 'agent')  // → review again
    assert.equal(sm.currentNodeId, 'review')
  })

  it('paused 状态下 rollback → 恢复为 running', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')
    sm.pause()
    assert.equal(sm.status, 'paused')
    sm.rollback('analyze', 'admin', 'test')
    assert.equal(sm.status, 'running')
  })

  it('toState/fromState 保留 rollback 记录', () => {
    const def = devWorkflow()
    const sm1 = new StateMachine(def, { taskId: 't1' })
    sm1.transition('submit', 'agent')
    sm1.rollback('analyze', 'admin', 'test')
    const state = sm1.toState()
    const sm2 = StateMachine.fromState(def, state)
    assert.equal(sm2.currentNodeId, 'analyze')
    const entry = sm2.history.at(-1)
    assert.equal(entry.event, 'rollback')
  })

  it('rollback 触发 onTransition listener', () => {
    const sm = new StateMachine(devWorkflow(), { taskId: 't1' })
    sm.transition('submit', 'agent')  // → review
    const events = []
    sm.onTransition((e) => events.push(e))
    sm.rollback('analyze', 'admin', 'test')
    assert.equal(events.length, 1)
    assert.equal(events[0].event, 'rollback')
    assert.equal(events[0].from, 'review')
    assert.equal(events[0].to, 'analyze')
    assert.equal(events[0].status, 'running')
    assert.equal(events[0].instanceId, sm.instanceId)
  })
})
```

---

## 关于 Registry

> **不需要新增 registry 代码。** `WorkflowRegistry` 已有 `getInstance(instanceId)` 方法（`registry.mjs:134`），签名和行为完全符合需求。后续 T42-4 的 `workflow_admin_transition` 直接调用 `registry.getInstance(instance_id)` 即可。
>
> 已有调用点参考：`telegram.mjs:406`、`loader.mjs:92`。

---

## 注意事项

### ⚠️ 不要改的

1. **不要修改现有测试** — 所有现有测试必须继续通过。新测试追加到已有 describe 块之后
2. **不要修改 transition() 的已有行为** — agent/user/system 的 actor 校验逻辑不变，只加 admin 豁免
3. **不要给 rollback 加太复杂的逻辑** — artifacts 保留、bindings 不变、history 只追加。不做清理

### ⚠️ 容易踩的坑

1. **history 的 start 事件** — `StateMachine` 构造时会 push 一个 `event: 'start'` 到 history。rollback 判断"已访问节点"时，要包含 start 事件中的 initial node
2. **decision 节点的递归 transition** — `transition()` 在遇到 decision 节点时会递归调用自己。确保 meta 参数在递归路径中正确传播（当前 decision 递归调用 `sm.transition(event, 'system')`，meta 不需要传递，因为 decision 是自动路由）
3. **toState/fromState** — `toState()` 是深拷贝，`fromState()` 恢复。新增的 meta 字段会自动随 history 一起序列化/反序列化，不需要额外处理
4. **ACTOR_TYPES** — `admin` 已在 `definition.mjs:19` 的 `ACTOR_TYPES` 中，不需要新增
5. **#fireListeners** — `transition()` 在 L142 调用 `#fireListeners(result)` 通知监听者。`rollback()` 必须保持同样的可观测性，否则 bridge / trace / planner 审计挂监听时 rollback 会静默失踪

### ⚠️ 项目规范

- **ESM only** — 所有文件使用 `import/export`
- **测试框架** — `node:test`（`describe`/`it`）+ `assert/strict`
- **日志** — `createLogger()` 来自 `../logger.mjs`
- **运行测试** — `node --test src/workflow/state-machine.test.mjs`
- **commit 格式** — `feat(t42-1): 简述`

---

## 验收检查清单

| # | 检查项 | 验证方法 |
|---|--------|---------|
| 1 | 所有现有测试通过 | `node --test src/workflow/state-machine.test.mjs` 0 failures |
| 2 | 所有现有测试通过 | `node --test src/workflow/definition.test.mjs` 0 failures |
| 3 | admin override 测试通过 | admin 可触发 agent/user transition |
| 4 | system 不受 admin override 影响 | system 仍然不能触发 agent transition |
| 5 | meta 写入 history | transition 带 meta → history 包含 meta |
| 6 | meta 不影响逻辑 | 带 meta 的 transition 结果和不带一样 |
| 7 | meta 持久化 | toState/fromState 后 meta 保留 |
| 8 | driver 校验 | self/planner 合法，xxx 报错 |
| 9 | driver 默认值 | 省略 → self |
| 10 | max_iterations 校验 | 正整数合法，0/负数/小数报错 |
| 11 | rollback_target 校验 | 已有节点合法，不存在报错 |
| 12 | rollback 基本功能 | 回退到已访问节点成功 |
| 13 | rollback 未访问拒绝 | 回退到未访问节点报错 |
| 14 | rollback actor 限制 | agent/user 不能 rollback |
| 15 | rollback history | event=rollback, 带 reason |
| 16 | rollback 后可继续 | rollback 后正常 transition |
| 17 | rollback 持久化 | toState/fromState 后 rollback 记录保留 |
| 18 | **rollback 触发 listener** | onTransition 回调被调用，event=rollback |
| 19 | 无新增 registry 代码 | 使用已有 `getInstance()` |
