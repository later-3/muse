# T42-2 workflow-prompt planner-mode 分叉 — 开发任务书

> 给 AI 开发者：本文档是自包含的开发任务书。前置依赖 T42-1（`sm.definition.driver` 可用）。

---

## 任务概述

修改 2 个文件，让 `driver=planner` 的工作流在 prompt 注入和工具拦截上与 T39 默认模式区分开。

| 子任务 | 文件 | 改动量 |
|--------|------|--------|
| 2.1 planner-mode prompt 注入 | `src/plugin/hooks/workflow-prompt.mjs` | ~20 行 |
| 2.2 planner-mode transition 展示 | `src/plugin/hooks/workflow-prompt.mjs` | ~5 行 |
| 2.3 GateEnforcer planner-mode 拦截 | `src/workflow/gate-enforcer.mjs` | ~10 行 |

---

## 子任务 2.1: planner-mode prompt 注入

### 现状

`workflow-prompt.mjs` 的 `compileNodePrompt()` 函数有 2 处硬编码了"调 transition"指令：

**位置 1 — 系统通知头（L194-198）**：

```javascript
sections.push(
  `[系统通知] 你在工作流「${wfDisplayName}」的「${node.id}」节点。` +
  `当前任务行为以节点要求为准（P2 日常行为让位），安全/身份边界持续生效。` +
  (node.wait_for_user ? '' : `完成后调 workflow_transition 推进。`)
)
```

**位置 2 — 执行模式分叉（L201-216）**：

```javascript
if (node.wait_for_user) {
  sections.push(`\n## ⏸️ 等待用户指令`)
  sections.push(`此节点需要用户参与。你必须：`)
  sections.push(`- 向用户展示需要审核的内容`)
  sections.push(`- 等待用户通过 Telegram 回复指示`)
  sections.push(`- 根据用户指示调用相应的 workflow_transition`)
  sections.push(`- 不要自主决定通过或拒绝`)
} else {
  sections.push(`\n## ⚠️ 执行规则`)
  sections.push(`你是自主执行的 Agent。你必须：`)
  sections.push(`- 按照步骤指引完成所有操作，不要跳过任何步骤`)
  sections.push(`- 完成后立即调用 workflow_transition 推进到下一节点`)
  sections.push(`- 不要停下来等待用户确认或反馈`)
  sections.push(`- 不要只回复文字而不执行工具调用`)
}
```

### 改动

**位置 1 — 系统通知头**：

```diff
+ const isPlannerMode = sm.definition?.driver === 'planner'
+
  sections.push(
    `[系统通知] 你在工作流「${wfDisplayName}」的「${node.id}」节点。` +
    `当前任务行为以节点要求为准（P2 日常行为让位），安全/身份边界持续生效。` +
-   (node.wait_for_user ? '' : `完成后调 workflow_transition 推进。`)
+   (isPlannerMode ? `完成后通知 Planner。` : (node.wait_for_user ? '' : `完成后调 workflow_transition 推进。`))
  )
```

**位置 2 — 执行模式分叉**（在原有 if/else 之前插入 planner 分支）：

```diff
- if (node.wait_for_user) {
+ if (isPlannerMode) {
+   // ★ Planner 模式：统一行为，不区分 wait_for_user
+   sections.push(`\n## ⚠️ 执行规则（Planner 驱动）`)
+   sections.push(`你由 Planner 指挥官调度。你必须：`)
+   sections.push(`- 按照步骤指引完成所有操作`)
+   sections.push(`- 完成后通知 Planner，说明产出和结果`)
+   sections.push(`- ⛔ 不要调用 workflow_transition，由 Planner 统一推进`)
+   sections.push(`- ⛔ 不要直接通过 Telegram 联系用户，由 Planner 中转`)
+ } else if (node.wait_for_user) {
    // T39 原逻辑不变
    sections.push(`\n## ⏸️ 等待用户指令`)
    // ...
```

### 行为矩阵

| driver | wait_for_user | 注入给 active Muse 的指令 |
|--------|-----------|--------------------------|
| `self` | false | "完成后**立即调用 workflow_transition** 推进" |
| `self` | true | "向用户展示内容，等待用户 Telegram 回复" |
| `planner` | false | "通知 Planner，**不要调 workflow_transition**" |
| `planner` | true | "通知 Planner，**不要调 workflow_transition、不要联系用户**" |

> **硬规则**：`driver=planner` 时，`isPlannerMode` 分支优先于 `wait_for_user`，两种 wait_for_user 状态都走同一逻辑。

### 测试用例

> 测试需要 mock `sm.definition.driver`。`compileNodePrompt(node, sm, participantStatus)` 是纯函数（用到的副作用如 ENV/existsSync 可在测试中忽略），直接传入构造好的 sm 对象即可。

```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { compileNodePrompt } from './workflow-prompt.mjs'

// ── 测试辅助 ──

function mockSm(driver = 'self') {
  return {
    instanceId: 'test-instance',
    workflowId: 'test-wf',
    taskId: 't1',
    status: 'running',
    definition: {
      name: 'Test Workflow',
      description: '',
      driver,
    },
  }
}

function mockNode(overrides = {}) {
  return {
    id: 'test-node',
    type: 'action',
    participant: 'worker',
    objective: '测试目标',
    capabilities: ['code_read'],
    bash_policy: 'deny',
    transitions: {
      done: { target: 'next', actor: 'agent' },
    },
    ...overrides,
  }
}

describe('compileNodePrompt — Planner Mode', () => {
  it('driver=self → 包含 "workflow_transition"', () => {
    const prompt = compileNodePrompt(mockNode(), mockSm('self'), 'active')
    assert.ok(prompt.includes('workflow_transition'))
    assert.ok(!prompt.includes('通知 Planner'))
  })

  it('driver=planner → 包含 "通知 Planner"', () => {
    const prompt = compileNodePrompt(mockNode(), mockSm('planner'), 'active')
    assert.ok(prompt.includes('通知 Planner'))
    assert.ok(prompt.includes('不要调用 workflow_transition'))
    assert.ok(prompt.includes('不要直接通过 Telegram 联系用户'))
  })

  it('driver=planner → 不包含 "workflow_transition" 调用指令', () => {
    const prompt = compileNodePrompt(mockNode(), mockSm('planner'), 'active')
    // 注意：只检查「执行指令」部分不含 transition 调用
    // 状态流转列表可能仍然显示可用 transition（见 2.2）
    assert.ok(!prompt.includes('完成后立即调用 workflow_transition'))
    assert.ok(!prompt.includes('完成后调 workflow_transition 推进'))
  })

  it('driver=planner + wait_for_user=true → 同样走 planner 分支', () => {
    const node = mockNode({ wait_for_user: true })
    const prompt = compileNodePrompt(node, mockSm('planner'), 'active')
    assert.ok(prompt.includes('通知 Planner'))
    // 不应包含 T39 的 "等待用户指令" 分支
    assert.ok(!prompt.includes('等待用户通过 Telegram 回复'))
  })

  it('driver=self + wait_for_user=true → T39 原逻辑', () => {
    const node = mockNode({ wait_for_user: true })
    const prompt = compileNodePrompt(node, mockSm('self'), 'active')
    assert.ok(prompt.includes('等待用户通过 Telegram 回复'))
    assert.ok(!prompt.includes('通知 Planner'))
  })

  it('driver=self + wait_for_user=false → T39 原逻辑', () => {
    const node = mockNode()
    const prompt = compileNodePrompt(node, mockSm('self'), 'active')
    assert.ok(prompt.includes('完成后立即调用 workflow_transition'))
  })

  it('frozen 状态 → 不受 planner mode 影响', () => {
    const prompt = compileNodePrompt(mockNode(), mockSm('planner'), 'frozen')
    assert.ok(prompt.includes('冻结状态'))
    assert.ok(!prompt.includes('通知 Planner'))
  })
})
```

---

## 子任务 2.2: planner-mode transition 展示

### 现状

`workflow-prompt.mjs` L262-269 只显示 `actor: 'agent'` 的 transition 给 AI：

```javascript
const agentTransitions = Object.entries(node.transitions || {})
  .filter(([_, t]) => t.actor === 'agent')
if (agentTransitions.length) {
  sections.push(`\n## 状态流转`)
  agentTransitions.forEach(([event, t]) =>
    sections.push(`- workflow_transition("${event}") → 进入 "${t.target}"`))
}
```

### 改动

`driver=planner` 时，不显示 transition 调用指令（因为 Muse 不应该调 transition）：

```diff
- const agentTransitions = Object.entries(node.transitions || {})
-   .filter(([_, t]) => t.actor === 'agent')
- if (agentTransitions.length) {
-   sections.push(`\n## 状态流转`)
-   agentTransitions.forEach(([event, t]) =>
-     sections.push(`- workflow_transition("${event}") → 进入 "${t.target}"`))
- }
+ if (!isPlannerMode) {
+   const agentTransitions = Object.entries(node.transitions || {})
+     .filter(([_, t]) => t.actor === 'agent')
+   if (agentTransitions.length) {
+     sections.push(`\n## 状态流转`)
+     agentTransitions.forEach(([event, t]) =>
+       sections.push(`- workflow_transition("${event}") → 进入 "${t.target}"`))
+   }
+ }
```

### 测试用例

```javascript
describe('compileNodePrompt — Planner Mode Transition Display', () => {
  it('driver=self → 显示 transition 调用', () => {
    const node = mockNode({
      transitions: { done: { target: 'next', actor: 'agent' } },
    })
    const prompt = compileNodePrompt(node, mockSm('self'), 'active')
    assert.ok(prompt.includes('workflow_transition("done")'))
  })

  it('driver=planner → 不显示 transition 调用', () => {
    const node = mockNode({
      transitions: { done: { target: 'next', actor: 'agent' } },
    })
    const prompt = compileNodePrompt(node, mockSm('planner'), 'active')
    assert.ok(!prompt.includes('workflow_transition("done")'))
  })
})
```

---

## 子任务 2.3: GateEnforcer planner-mode 拦截

### 现状

`gate-enforcer.mjs` 的 `GateEnforcer.check()` 不感知 `driver`。当节点 `capabilities` 包含 `workflow_control` 时，`workflow_transition` 被允许。

### 改动

`GateEnforcer.check()` 需要新增 `driver` 参数。当 `driver === 'planner'` 时，从允许的工具集中移除 `workflow_transition`。

**方案 A（推荐）**：在 `check()` 入参中增加 `driver`：

```diff
  // gate-enforcer.mjs L68
- static check({ tool, args, node, participantStatus, workspaceRoot }) {
+ static check({ tool, args, node, participantStatus, workspaceRoot, driver }) {
```

在步骤 4（能力白名单校验）之后、bash 策略之前，新增拦截逻辑：

```javascript
    // 4.5 ★ Planner 模式：拦截 active Muse 的 workflow_transition
    if (driver === 'planner' && tool === 'workflow_transition') {
      log.info('planner-mode 拦截 transition', { tool, node: node.id })
      return {
        allowed: false,
        reason: '当前工作流由 Planner 驱动，workflow_transition 只能由 Planner 调用。请通知 Planner 你已完成工作。',
      }
    }
```

**调用方也需修改**：`workflow-prompt.mjs` L244 调用 `resolveCapabilities()` 不需要改，但调用 `GateEnforcer.check()` 的地方需要传入 `driver`。

查找 `GateEnforcer.check` 的调用点：

```bash
grep -rn 'GateEnforcer.check' muse/src/
```

预期调用点在 plugin hook 中（如 `tool-gate.mjs`），需要从当前 session 的 SM 中获取 `sm.definition.driver` 并传入。

### 测试用例

```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { GateEnforcer } from './gate-enforcer.mjs'

describe('GateEnforcer — Planner Mode', () => {
  const activeNode = {
    id: 'test-node',
    capabilities: ['code_read', 'workflow_control'],
    bash_policy: 'deny',
  }

  it('driver=self → workflow_transition 放行', () => {
    const result = GateEnforcer.check({
      tool: 'workflow_transition',
      args: {},
      node: activeNode,
      participantStatus: 'active',
      driver: 'self',
    })
    assert.equal(result.allowed, true)
  })

  it('driver=planner → workflow_transition 拦截', () => {
    const result = GateEnforcer.check({
      tool: 'workflow_transition',
      args: {},
      node: activeNode,
      participantStatus: 'active',
      driver: 'planner',
    })
    assert.equal(result.allowed, false)
    assert.ok(result.reason.includes('Planner'))
  })

  it('driver=planner → workflow_status 仍然放行', () => {
    const result = GateEnforcer.check({
      tool: 'workflow_status',
      args: {},
      node: activeNode,
      participantStatus: 'active',
      driver: 'planner',
    })
    assert.equal(result.allowed, true)
  })

  it('driver=planner → workflow_emit_artifact 仍然放行', () => {
    const result = GateEnforcer.check({
      tool: 'workflow_emit_artifact',
      args: {},
      node: activeNode,
      participantStatus: 'active',
      driver: 'planner',
    })
    assert.equal(result.allowed, true)
  })

  it('driver=planner → read 工具不受影响', () => {
    const result = GateEnforcer.check({
      tool: 'read',
      args: {},
      node: activeNode,
      participantStatus: 'active',
      driver: 'planner',
    })
    assert.equal(result.allowed, true)
  })

  it('driver 不传（兼容 T39）→ 不拦截', () => {
    const result = GateEnforcer.check({
      tool: 'workflow_transition',
      args: {},
      node: activeNode,
      participantStatus: 'active',
    })
    assert.equal(result.allowed, true)
  })
})
```

---

## 注意事项

### ⚠️ GateEnforcer.check 调用链

`GateEnforcer.check()` 新增了 `driver` 参数，需要找到所有 **调用方** 并传入 `driver`。

查找命令：
```bash
grep -rn 'GateEnforcer.check' muse/src/
```

调用方需要从当前 session 的 SM 中获取 driver：
```javascript
const sm = registry.getBySession(sessionId)
const driver = sm?.definition?.driver || 'self'
```

**如果调用方无法获取 SM 或 definition**，`driver` 应该默认为 `undefined`，此时不触发 planner-mode 拦截（兼容 T39）。

### ⚠️ 不要改的

1. **frozen 状态的行为不变** — frozen 分支在 planner-mode 检查之前提前 return，不受影响
2. **input artifact 检查不变** — 输入缺失分支也在 planner-mode 之前
3. **handoff 状态感知不变** — handoff 分支也在 planner-mode 之前
4. **GateEnforcer 的其他策略不变** — bash_policy、file_scope、FROZEN_TOOLS 全部不动

### ⚠️ 容易踩的坑

1. **`sm.definition` 可能为 null** — 在恢复场景中 definition 可能未加载。用 `sm.definition?.driver` 安全访问
2. **`isPlannerMode` 变量作用域** — 必须在 `compileNodePrompt` 函数顶部声明，因为系统通知头和执行模式分叉都需要用
3. **测试 mock** — `compileNodePrompt` 内部调用了 `process.env.MUSE_HOME` 等环境变量和 `existsSync`。测试中不设置这些环境变量，相关分支会自动跳过
4. **transition 展示 vs transition 拦截** — 2.2 是 prompt 层面（不告诉 AI 有这个选项），2.3 是执行层面（即使 AI 尝试调用也被拦截）。两层防护缺一不可

### ⚠️ 项目规范

- **ESM only** — 所有文件使用 `import/export`
- **测试框架** — `node:test`（`describe`/`it`）+ `assert/strict`
- **运行测试** — `node --test src/workflow/gate-enforcer.test.mjs`
- **commit 格式** — `feat(t42-2): 简述`

---

## 验收检查清单

| # | 检查项 | 验证方法 |
|---|--------|---------|
| 1 | 所有现有测试通过 | `node --test src/workflow/gate-enforcer.test.mjs` 0 failures |
| 2 | driver=self prompt 包含 "workflow_transition" | 测试 2.1 |
| 3 | driver=planner prompt 包含 "通知 Planner" | 测试 2.1 |
| 4 | driver=planner prompt 不含 "调用 workflow_transition" | 测试 2.1 |
| 5 | driver=planner + wait_for_user → 也走 planner 分支 | 测试 2.1 |
| 6 | driver=self + wait_for_user → T39 原逻辑 | 测试 2.1 |
| 7 | frozen 状态 → 不受 planner mode 影响 | 测试 2.1 |
| 8 | driver=planner → 不显示 transition 调用列表 | 测试 2.2 |
| 9 | driver=self → 正常显示 transition 调用列表 | 测试 2.2 |
| 10 | driver=planner → GateEnforcer 拦截 workflow_transition | 测试 2.3 |
| 11 | driver=planner → GateEnforcer 放行 workflow_status | 测试 2.3 |
| 12 | driver=planner → GateEnforcer 放行 workflow_emit_artifact | 测试 2.3 |
| 13 | driver 不传 → 兼容 T39，不拦截 | 测试 2.3 |
| 14 | GateEnforcer.check 调用方正确传入 driver | grep 检查所有调用点 |
