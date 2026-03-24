# T42-6 端到端验证 — 开发任务书

> 给 AI 开发者：本文档是自包含的开发任务书。前置依赖 T42-1 到 T42-5 全部完成。

---

## 任务概述

通过 7 个场景验证 Planner 驱动工作流的完整链路。分为 **L1 集成测试**（脚本化）和 **L2 本地联调**（真实启动）两层。

| 子任务 | 场景 | 验证层 |
|--------|------|--------|
| 6.1 | 2 节点 happy path | L1 + L2 |
| 6.2 | 迭代返工 | L1 + L2 |
| 6.3 | 双驱动防护 | L1 |
| 6.4 | user gate 拒绝 | L1 |
| 6.5 | 用户审核 + evidence | L1 + L2 |
| 6.6 | rollback | L1 |
| 6.7 | 持久化恢复 | L1 |

---

## 测试工作流定义

创建 `test/fixtures/t42-e2e-workflow.json`：

```json
{
  "id": "t42-e2e-test",
  "name": "T42 E2E 验证工作流",
  "driver": "planner",
  "participants": [
    { "role": "pua", "description": "写文档" }
  ],
  "initial": "write_doc",
  "nodes": {
    "write_doc": {
      "id": "write_doc",
      "type": "action",
      "participant": "pua",
      "objective": "编写测试文档",
      "instructions": ["创建 test-output.md", "包含项目概述"],
      "constraints": ["不修改 src/ 下的文件"],
      "capabilities": ["code"],
      "output": { "artifact": "test-output.md" },
      "transitions": {
        "doc_done": { "target": "review", "actor": "agent" }
      }
    },
    "review": {
      "id": "review",
      "type": "action",
      "participant": "pua",
      "objective": "用户审核文档",
      "wait_for_user": true,
      "capabilities": ["code"],
      "transitions": {
        "approved": { "target": "done", "actor": "user" },
        "rejected": { "target": "write_doc", "actor": "user" }
      }
    },
    "done": {
      "id": "done",
      "type": "terminal"
    }
  }
}
```

---

## 子任务 6.1: 2 节点 happy path

**目标**：验证最基本的 Planner 工作流：创建 → handoff → 执行者完成 → admin_transition → 结束。

### L1 集成测试

```javascript
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
// 导入 handler 函数
import { handleWorkflowCreate, handleWorkflowAdminTransition,
  handleWorkflowInspect } from '../../src/mcp/planner-tools.mjs'

describe('6.1 Happy Path', () => {
  let instanceId

  it('workflow_create 创建 driver=planner 实例', async () => {
    const result = await handleWorkflowCreate('planner-session', {
      workflow_id: 'test/fixtures/t42-e2e-workflow.json',
    })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.success, true)
    assert.equal(data.driver, 'planner')
    assert.equal(data.current_node, 'write_doc')
    instanceId = data.instance_id
  })

  it('workflow_inspect 返回全局视图', async () => {
    const result = await handleWorkflowInspect('planner-session', {
      instance_id: instanceId,
    })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.status, 'running')
    assert.equal(data.current_node, 'write_doc')
    assert.equal(data.nodes.length, 3) // write_doc, review, done
    assert.ok(data.nodes.find(n => n.id === 'write_doc' && n.is_current))
  })

  it('admin_transition(doc_done) 推进到 review', async () => {
    const result = await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId,
      event: 'doc_done',
      reason: 'pua 完成文档',
    })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.success, true)
  })

  it('admin_transition(approved) 越过 user gate 完成工作流', async () => {
    const result = await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId,
      event: 'approved',
      on_behalf_of: 'user',
      evidence: 'Later 说: 通过',
    })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.success, true)
  })

  it('inspect 确认终态', async () => {
    const result = await handleWorkflowInspect('planner-session', {
      instance_id: instanceId,
    })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.current_node, 'done')
    assert.equal(data.status, 'completed')
  })
})
```

### L2 本地联调

```bash
# 前置：两个终端分别启动
# Terminal 1: 启动 planner
./start.sh later-muse-family planner

# Terminal 2: 启动 pua
./start.sh later-muse-family test-pua

# 在 Planner 的 OpenCode 中手动执行：
# 1. workflow_create({ workflow_id: "t42-e2e-test" })
# 2. handoff_to_member({ instance_id: "...", role: "pua" })
# 3. 等 pua 完成
# 4. read_artifact({ instance_id: "...", name: "test-output.md" })
# 5. workflow_admin_transition({ instance_id: "...", event: "doc_done" })
# 6. 向 Later 展示产出 → 等用户回复
# 7. workflow_admin_transition({ ..., event: "approved", on_behalf_of: "user", evidence: "..." })
```

**预期结果**：
- pua 收到 handoff prompt 后自主执行，产出 test-output.md
- Planner 读取产出并推进
- 工作流到达 done 终态

> **❗ L2 前置条件**：当前 `buildHandoffPrompt`（`handoff.mjs:199`）会告诉执行者“完成后必须调用 workflow_transition”，
> 但 planner-mode 的 GateEnforcer（`gate-enforcer.mjs:104`）会拦截这个调用。
> 这​将​导致​执行者​完成​后​持续​重试​ transition ​而​失败​。
> **解决方案**（二选一）：
> 1. 在 T42-2 实施时，让 `buildHandoffPrompt` 感知 driver=planner，改为“完成后通知 Planner”
> 2. 或在 `workflow-prompt.mjs` 的 planner-mode 分支中覆盖 handoff prompt 的 transition 指令
> 实施者必须先确认此前置条件已满足，否则 L2 6.1 和 6.3 无法闭环。

---

## 子任务 6.2: 迭代返工

**目标**：验证 Planner 发现产出不合格后 rollback → 重新分派 → 再次推进。

### L1 集成测试

```javascript
describe('6.2 Iteration', () => {
  let instanceId

  before(async () => {
    // 创建实例 + 推进到 review
    const create = await handleWorkflowCreate('planner-session', {
      workflow_id: 'test/fixtures/t42-e2e-workflow.json',
    })
    instanceId = JSON.parse(create.content[0].text).instance_id
    await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId, event: 'doc_done', reason: '初次完成',
    })
  })

  it('用户"拒绝" → admin_transition(rejected) 回到 write_doc', async () => {
    const result = await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId,
      event: 'rejected',
      on_behalf_of: 'user',
      evidence: 'Later 说: 内容太少，补充细节',
    })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.success, true)
  })

  it('inspect 确认回到 write_doc', async () => {
    const result = await handleWorkflowInspect('planner-session', {
      instance_id: instanceId,
    })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.current_node, 'write_doc')
    // history 包含 rejected 记录
    assert.ok(data.history.some(h => h.event === 'rejected'))
  })

  it('再次推进到 review → approved → done', async () => {
    await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId, event: 'doc_done', reason: '返工后完成',
    })
    const result = await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId, event: 'approved',
      on_behalf_of: 'user', evidence: 'Later 说: 这次通过',
    })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.success, true)
  })
})
```

---

## 子任务 6.3: 双驱动防护

**目标**：验证 driver=planner 时，执行者调用 `workflow_transition` 被 GateEnforcer 拦截。

### L1 集成测试

```javascript
import { GateEnforcer } from '../../src/workflow/gate-enforcer.mjs'

describe('6.3 Dual-Drive Protection', () => {
  it('driver=planner 时拦截执行者 workflow_transition', () => {
    // GateEnforcer.check() 真实签名: { tool, args, node, participantStatus, workspaceRoot, driver }
    const result = GateEnforcer.check({
      tool: 'workflow_transition',
      args: {},
      node: { id: 'write_doc', capabilities: ['code', 'workflow_control'] },
      participantStatus: 'active',
      driver: 'planner',
    })
    assert.equal(result.allowed, false)
    assert.ok(result.reason.includes('planner') || result.reason.includes('Planner'))
  })

  it('driver=self 时不拦截执行者 workflow_transition', () => {
    const result = GateEnforcer.check({
      tool: 'workflow_transition',
      args: {},
      node: { id: 'write_doc', capabilities: ['code', 'workflow_control'] },
      participantStatus: 'active',
      driver: 'self',
    })
    assert.equal(result.allowed, true)
  })
})
```

### L2 本地联调

```
1. 启动 planner + pua
2. planner: workflow_create → handoff_to_member
3. 在 pua 的 OpenCode 中手动调 workflow_transition
4. 预期：被拦截，返回错误
```

---

## 子任务 6.4: user gate 拒绝

**目标**：验证越过 `actor=user` 的 transition 时，缺少 evidence 会被拒绝。

### L1 集成测试

```javascript
describe('6.4 User Gate', () => {
  let instanceId

  before(async () => {
    const create = await handleWorkflowCreate('planner-session', {
      workflow_id: 'test/fixtures/t42-e2e-workflow.json',
    })
    instanceId = JSON.parse(create.content[0].text).instance_id
    await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId, event: 'doc_done', reason: '完成',
    })
    // 现在在 review 节点，approved transition 的 actor=user
  })

  it('on_behalf_of=planner → 拒绝', async () => {
    const result = await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId, event: 'approved',
      on_behalf_of: 'planner',
    })
    const text = result.content[0].text
    assert.ok(text.includes('⛔'))
    assert.ok(text.includes('user'))
  })

  it('on_behalf_of=user + 空 evidence → 拒绝', async () => {
    const result = await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId, event: 'approved',
      on_behalf_of: 'user', evidence: '',
    })
    const text = result.content[0].text
    assert.ok(text.includes('⛔'))
    assert.ok(text.includes('evidence'))
  })

  it('不传 on_behalf_of → 拒绝', async () => {
    const result = await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId, event: 'approved',
    })
    const text = result.content[0].text
    assert.ok(text.includes('⛔'))
  })
})
```

---

## 子任务 6.5: 用户审核 + evidence

**目标**：验证 evidence 正确写入 history.meta。

### L1 集成测试

```javascript
describe('6.5 User Review with Evidence', () => {
  let instanceId

  before(async () => {
    const create = await handleWorkflowCreate('planner-session', {
      workflow_id: 'test/fixtures/t42-e2e-workflow.json',
    })
    instanceId = JSON.parse(create.content[0].text).instance_id
    await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId, event: 'doc_done', reason: '完成',
    })
  })

  it('on_behalf_of=user + evidence → 通过，meta 记录正确', async () => {
    const evidence = 'Later 原话: "文档写得不错，通过"'
    await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId, event: 'approved',
      on_behalf_of: 'user', evidence,
    })

    const inspect = await handleWorkflowInspect('planner-session', {
      instance_id: instanceId,
    })
    const data = JSON.parse(inspect.content[0].text)

    // 找到 approved transition 的 history 记录
    const approvedEntry = data.history.find(h => h.event === 'approved')
    assert.ok(approvedEntry, 'history 中有 approved 记录')
    assert.equal(approvedEntry.meta.on_behalf_of, 'user')
    assert.equal(approvedEntry.meta.evidence, evidence)
  })
})
```

---

## 子任务 6.6: rollback

**目标**：验证连续失败后 rollback 到已访问节点。

### L1 集成测试

```javascript
import { handleWorkflowRollback } from '../../src/mcp/planner-tools.mjs'

describe('6.6 Rollback', () => {
  let instanceId

  before(async () => {
    const create = await handleWorkflowCreate('planner-session', {
      workflow_id: 'test/fixtures/t42-e2e-workflow.json',
    })
    instanceId = JSON.parse(create.content[0].text).instance_id
    // 推进到 review
    await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId, event: 'doc_done', reason: '完成',
    })
  })

  it('rollback 到 write_doc', async () => {
    const result = await handleWorkflowRollback('planner-session', {
      instance_id: instanceId,
      target_node: 'write_doc',
      reason: '产出质量不合格，需要返工',
    })
    const data = JSON.parse(result.content[0].text)
    assert.equal(data.success, true)
  })

  it('inspect 确认回到 write_doc + history 有 rollback', async () => {
    const inspect = await handleWorkflowInspect('planner-session', {
      instance_id: instanceId,
    })
    const data = JSON.parse(inspect.content[0].text)
    assert.equal(data.current_node, 'write_doc')
    assert.ok(data.history.some(h => h.event === 'rollback'))
  })

  it('rollback 到未访问节点 → 拒绝', async () => {
    const result = await handleWorkflowRollback('planner-session', {
      instance_id: instanceId,
      target_node: 'done',
      reason: '测试',
    })
    const text = result.content[0].text
    assert.ok(text.includes('失败') || text.includes('未访问'))
  })
})
```

---

## 子任务 6.7: 持久化恢复

**目标**：验证 Planner 重启后能恢复工作流进度（含 history.meta）。

### L1 集成测试

```javascript
import { loadInstanceState, saveInstanceState } from '../../src/workflow/bridge.mjs'
import { StateMachine } from '../../src/workflow/state-machine.mjs'
import { loadWorkflowFromFile } from '../../src/workflow/definition.mjs'

describe('6.7 Persistence', () => {
  it('toState → 重建 → 状态一致', async () => {
    // 1. 创建实例
    const create = await handleWorkflowCreate('planner-session', {
      workflow_id: 'test/fixtures/t42-e2e-workflow.json',
    })
    const instanceId = JSON.parse(create.content[0].text).instance_id

    // 2. 带 meta 推进
    await handleWorkflowAdminTransition('planner-session', {
      instance_id: instanceId, event: 'doc_done',
      reason: '完成', on_behalf_of: 'planner',
    })

    // 3. 读取持久化状态
    const saved = loadInstanceState(instanceId)
    assert.ok(saved)
    assert.ok(saved.smState)
    assert.equal(saved.smState.current_node, 'review')

    // 4. 从持久化恢复
    const definition = await loadWorkflowFromFile(saved.workflowPath)
    const restored = StateMachine.fromState(definition, saved.smState)
    assert.equal(restored.getCurrentNode()?.id, 'review')

    // 5. 验证 history.meta 保留
    const state = restored.toState()
    const docDone = state.history.find(h => h.event === 'doc_done')
    assert.ok(docDone?.meta)
    assert.equal(docDone.meta.on_behalf_of, 'planner')
  })
})
```

---

## 注意事项

### ⚠️ 测试环境准备

1. **工作流定义文件** — 放在 `test/fixtures/t42-e2e-workflow.json`
2. **环境变量** — 持久化场景（6.7）需要设置 `MUSE_HOME` 和 `MUSE_FAMILY`（bridge.mjs:33 的 `getWorkflowRoot()` 依赖这两个）
3. **Registry mock** — L1 测试需要 mock `getRegistry()` 返回内存 registry
4. **Bridge mock** — L1 测试用临时目录做 `workflowRoot`，或在 `before` 中设置 `MUSE_HOME`/`MUSE_FAMILY` 指向 `os.tmpdir()`

### ⚠️ L2 联调前提

1. T42-3 创建 planner 成员目录完成
2. T42-5 AGENTS.md / prompt.md / 知识包就位
3. 两个成员都配好 Telegram bot token（或用同一个 bot 不同 session）
4. 端口不冲突

### ⚠️ 容易踩的坑

1. **handler 函数的 import** — planner-tools.mjs 的 handler 必须 export 才能在测试中直接调用
2. **registry 单例** — 多个 test describe 共享 registry 可能干扰，每个 describe 用 `before` 重建
3. **持久化路径** — L1 测试用 `os.tmpdir()` 避免污染真实数据目录
4. **异步** — 所有 handler 都是 async，测试要用 async/await

### ⚠️ 项目规范

- **测试文件** — `src/mcp/planner-tools.e2e.test.mjs`（区别于单元测试 `.test.mjs`）
- **运行命令** — `node --test src/mcp/planner-tools.e2e.test.mjs`
- **commit 格式** — `test(t42-6): 简述`

---

## 验收检查清单

| # | 检查项 | 验证方法 |
|---|--------|---------|
| 1 | 测试工作流 JSON 创建 | `test/fixtures/t42-e2e-workflow.json` 存在 |
| 2 | 6.1 happy path 通过 | 测试 |
| 3 | 6.2 迭代返工 — rejected → 回到 write_doc → 再次推进 | 测试 |
| 4 | 6.3 双驱动防护 — 执行者 transition 被拦截 | 测试 |
| 5 | 6.4 user gate — 无 evidence → ⛔ | 测试 |
| 6 | 6.4 user gate — on_behalf_of=planner → ⛔ | 测试 |
| 7 | 6.5 用户审核 — evidence 写入 history.meta | 测试 |
| 8 | 6.6 rollback 成功 — 回到已访问节点 | 测试 |
| 9 | 6.6 rollback 失败 — 未访问节点拒绝 | 测试 |
| 10 | 6.7 持久化 — toState → fromState → 状态一致 | 测试 |
| 11 | 6.7 持久化 — history.meta 保留 | 测试 |
| 12 | L1 全部通过 | `node --test src/mcp/planner-tools.e2e.test.mjs` |
| 13 | L2 联调 — 2 节点 happy path | 手动验证 |
| 14 | L2 联调 — handoff 成功触发 | 手动验证 |
