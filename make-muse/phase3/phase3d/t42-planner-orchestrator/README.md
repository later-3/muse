# T42 Planner Orchestrator — 架构设计

> Planner 是工作流指挥官：创建工作流、驱动节点、检查产出、管理迭代、汇报用户。

---

## 核心范式

```
Hook 驱动（T39）：                     Planner 驱动（T42）：
工作流 JSON 预定义                      Planner 根据任务动态设计工作流
Plugin hook 注入 prompt                Planner 为每个 Muse 准备精确指令
各 Muse 自己调 transition()            Planner 检查产出 → 决定是否推进
分散式，无人负责全局                    Planner 是唯一指挥官和用户接口
```

---

## 一、交互全景

### 场景一：Web 驾驶舱开发（全链路）

**参与者**：Later（用户）、Planner、PM(pua)、Arch、Coder

```
═══ 阶段 0: 用户提需求 ═══

Later → Planner (Telegram):
  "在 web 驾驶舱上加一个工作流看板，能看到所有工作流、
   节点状态、历史记录"

═══ 阶段 1: Planner 设计工作流 ═══

Planner 内部:
  - 分析：前端开发任务，需要 pua(PM) 明确需求 + arch 做方案 + coder 实现
  - 设计工作流节点

Planner → Later:
  "📋 我为这个任务设计了工作流：

   1️⃣ pua 写任务说明书（背景/目标/范围）→ 你审核
   2️⃣ arch 写技术方案 + 测试方案 + 拆分子任务 → 你审核
   3️⃣ coder 逐个开发子任务
   4️⃣ arch 代码审核（不通过 → 回到3迭代）
   5️⃣ pua 功能验收
   6️⃣ 我向你汇报，你最终验收

   同意开始吗？需要调整哪步？"

Later → Planner: "同意"

═══ 阶段 2: pua 写任务说明书 ═══

Planner 准备上下文:
  - 收集：用户原始需求、web/ 目录结构、现有 API
  - 组装给 pua 的指令

Planner → pua (handoff):
  "任务：编写任务说明书
   用户需求：'在 web 驾驶舱上加工作流看板...'
   参考：web/ 目录有 cockpit 页面...
   产出：task-brief.md（背景/目标/范围/预期产出）
   如有疑问，标注在文档中。完成后通知我。"

pua 工作... 产出 task-brief.md
pua → Planner: "完成，有2个疑问需用户确认"

Planner 检查产出:
  ✅ 有背景/目标/范围
  ✅ 疑问已标注
  ✅ 质量合格

Planner → Later:
  "📄 pua 的说明书已完成 [摘要]
   有2个疑问：
   1. 看板是否需要实时刷新？
   2. 是否支持手动干预？
   请审核：通过/需要修改/回答疑问"

Later: "1. 不用实时，轮询就行
       2. 要手动干预
       补充：要能看到每个节点的产出文件"

Planner → pua: "用户反馈：[转发] 请更新 task-brief.md"
pua 更新 → Planner 检查 ✅
Planner → Later: "说明书已更新，确认通过？"
Later: "通过"

Planner: 节点1 ✅ → 进入节点2

═══ 阶段 3: arch 写技术方案 ═══

Planner → arch (handoff):
  "任务：基于说明书写技术方案
   输入：task-brief.md
   产出：tech-design.md + test-plan.md + subtasks.md
   约束：只做设计，不写代码"

arch 工作... 产出3个文件
Planner 检查 ✅
Planner → Later: "技术方案完成 [摘要]，请审核"
Later: "subtask 2 太大了，再拆细一点"
Planner → arch: "用户要求子任务2拆更细"
arch 更新 → Planner 检查 ✅ → Later 通过

Planner: 节点2 ✅ → 进入节点3

═══ 阶段 4: coder 开发（迭代）═══

Planner → coder (handoff, 子任务1):
  "任务：实现子任务 1/3
   输入：task-brief.md + tech-design.md
   验收标准：[具体标准]
   完成后运行测试。"

coder 开发... → Planner 检查产出

Planner → arch: "审核 coder 的代码 [diff]"
arch: "API 返回格式不对，缺错误处理"

❌ 迭代（第1次）：
Planner → coder: "arch 审核反馈：[转发]，请修复"
coder 修复 → Planner → arch 再审
arch: "✅ 通过"

✅ 子任务1完成 → 子任务2 → 子任务3（同样模式）

═══ 阶段 5: pua 验收 ═══

Planner → pua: "所有子任务已开发完成，对照 task-brief.md 验收功能"
pua 验收 → "功能符合说明书 ✅"

═══ 阶段 6: 用户验收 ═══

Planner → Later:
  "🎉 工作流完成！产出清单：
   - task-brief.md ✅
   - tech-design.md ✅
   - 代码实现 ✅（arch 已审核）
   - pua 已验收 ✅
   请最终验收。"
```

### 场景二：文档整理（轻量，仅 pua）

```
Later → Planner: "整理 AGENTS.md 规范文档"

Planner → Later:
  "📋 工作流：AGENTS.md 规范文档
   1️⃣ pua 调研现有用法 → 你审核
   2️⃣ pua 写规范文档 → 你审核
   只需 pua，无需技术方案。同意？"
Later: "同意"

Planner → pua: "调研所有 AGENTS.md 文件..."
pua → Planner: 完成 → 检查 ✅ → Later 审核通过
Planner → pua: "写正式规范..."
pua → Planner: 完成 → 检查 ✅ → Later 验收
Planner: "🎉 完成"
```

### 场景三：Bug 修复（紧急，coder + arch）

```
Later → Planner: "Telegram 消息超时了，查一下"

Planner → Later:
  "📋 工作流：Telegram 超时修复
   1️⃣ coder 排查定位 → 我向你汇报
   2️⃣ 你确认修复方案
   3️⃣ coder 修复 → arch 审核（迭代到通过）
   4️⃣ 你验收
   紧急任务，跳过 pua 写说明书。同意？"
Later: "赶紧查"

Planner → coder: "排查 Telegram 超时，相关文件: telegram.mjs..."
coder → Planner: "handlerTimeout 被覆盖了"
Planner 检查报告 ✅
Planner → Later: "根因: handlerTimeout 被覆盖。要修吗？"
Later: "修"

Planner → coder: "修复"
coder 修复 → Planner → arch 审核
  ❌ arch: "单测没覆盖"
  Planner → coder: "补单测" → arch 再审 ✅

Planner → Later: "✅ 修复完成，arch 已审核通过"
```

### 场景四：迭代失败处理

```
coder 的实现 arch 连续3次审核不通过：

Planner 判断: iteration_count >= 3 → 可能是上游方案问题

Planner → Later:
  "⚠️ 子任务3已迭代3次仍未通过。
   arch 的反馈: [核心问题]
   建议: 退回 arch 更新技术方案后再开发。
   同意退回？还是继续迭代？"

Later: "退回 arch 重新设计这部分"

Planner: rollback 到 tech_design 节点
Planner → arch: "子任务3方案需调整，问题是..."
arch 更新方案 → Planner 检查 → Later 审核 → 重新交给 coder
```

---

## 二、Planner 的行为模型

### 5 种动作

| 动作 | 方向 | 何时 |
|------|------|------|
| **设计工作流** | 内部 → 输出给用户 | 收到任务时 |
| **派发任务** | Planner → Muse | 节点开始时 |
| **检查产出** | 读取 → 内部判断 | Muse 完成后 |
| **汇报请示** | Planner → 用户 | 需要审核/决策时 |
| **中转反馈** | 用户 → Planner → Muse | 用户有修改意见时 |

### 用户的 4 种响应

| 响应 | Planner 行为 |
|------|-------------|
| "通过" | 推进到下一节点 |
| "要改: xxx" | 转发给当前 Muse → 迭代 |
| "退回" | rollback 到之前的节点 |
| "取消/暂停" | 暂停或终止工作流 |

### 迭代策略

```
节点内迭代:             节点间回退:             任务级重来:
coder → arch 审核      连续失败 → Planner      用户说"推翻重来"
  ❌ → coder 修复        判断需退回上游            → 回到节点1
  ❌ → coder 再修       → rollback 到 arch       或者终止当前工作流
  ✅ → 下一步            → 重新走后续流程          创建新的
```

### 关键原则

1. **Planner 是唯一的用户接口** — 用户不直接和 pua/arch/coder 交流
2. **每个节点必须"产出→检查→审核"** — 不允许跳过
3. **Planner 智能裁剪** — 根据任务复杂度决定需要哪些角色和步骤
4. **反馈必须闭环** — 每条用户反馈都必须确认已处理
5. **迭代是常态** — 不期望一次做对，支持节点内迭代和节点间回退

---

## 三、角色命名真相源

> pua = PM。系统内部统一使用 `pua`/`arch`/`coder`，不引入第二套命名。

| 对外面向用户 | 系统 role 名 | config.json role | 说明 |
|-------------|-------------|-----------------|------|
| PM / 项目经理 | pua | pua | 任务说明书、需求沟通、验收 |
| 架构师 | arch | arch | 技术方案、代码审核 |
| 开发者 | coder | coder | 编码实现 |
| 工作流指挥官 | planner | planner | 创建/驱动工作流 |

> Planner 在向用户展示时可以用中文名（"PM 写任务说明书"），但工作流 JSON 和 MCP 交互中一律使用 `pua`。

---

## 四、Planner 与 T39 的职责边界

> [!IMPORTANT]
> 这是最关键的设计决策：Planner 和现有 T39 引擎如何分工，避免双驱动。

### 职责分界

| 能力 | T39 引擎（底层） | Planner（上层） |
|------|-----------------|----------------|
| **工作流定义** | 解析 + 校验 JSON | **创建** JSON 定义 |
| **状态管理** | StateMachine 维护 current_node / history | 读取状态做决策 |
| **transition** | 执行 transition + actor 校验 | **决定何时** transition（检查产出后） |
| **工具拦截** | GateEnforcer 硬性拦截 | 不参与 |
| **Prompt 注入** | workflow-prompt hook 注入节点七要素 | **准备**给 Muse 的 handoff prompt |
| **产出管理** | Bridge 持久化 artifacts | **检查**产出质量 |
| **Handoff** | MemberClient 跨 Muse 通信 | **决定** handoff 给谁、带什么上下文 |
| **用户沟通** | Telegram /wf 命令 | **Planner 主动**汇报/请示 |
| **回退** | StateMachine.rollback()（T42 新增） | **决定**是否回退、回退到哪 |

### 执行模型

```
Planner 决策层:
  "pua 完成了 task-brief.md → 我来检查质量 → OK →
   需要用户审核 → 用户通过 → 调 workflow_transition('complete')"

T39 引擎层:
  收到 transition('complete') → 校验 actor → 移动 current_node →
  GateEnforcer 更新工具白名单 → workflow-prompt 注入新节点指令
```

### 谁调 transition？

**统一由 Planner 调**。被派发的 Muse（pua/arch/coder）**不再自己调 `workflow_transition()`**。

| 场景 | 之前（T39 Hook 驱动） | 现在（T42 Planner 驱动） |
|------|---------------------|------------------------|
| pua 写完文档 | pua 自己调 `workflow_transition('submit')` | pua 通知 Planner "写完了" → Planner 检查 → Planner 调 transition |
| 用户审核通过 | 用户 `/wf approve` → 直接 transition | 用户告诉 Planner "通过" → Planner 调 transition |
| coder 开发完 | coder 自己调 `workflow_transition('done')` | coder 通知 Planner → Planner 安排 arch 审核 → 审核通过 → Planner 调 transition |

> **好处**：所有 transition 经过 Planner 的质量检查，不会出现 Muse 跳步。
> **T39 hooks 仍然生效**：GateEnforcer 和 workflow-prompt 继续约束被派发 Muse 的工具权限和 prompt。

---

## 五、工作流 Schema 扩展

### T39 现有 Schema（不动）

```
participants[].role       → 参与者角色名（pua/arch/coder）
nodes[].type              → action/gate/handoff/decision/terminal
nodes[].participant       → 绑定到哪个角色
nodes[].transitions       → { event: { target, actor } }
nodes[].exit_criteria     → { artifacts: [] }
```

### T42 新增字段（扩展，不改已有）

以下字段需要同步扩展 `definition.mjs` 校验逻辑和 `StateMachine`：

```jsonc
// participants 扩展：添加 muse_member 绑定
"participants": [
  { "role": "pua", "muse_member": "pua" }
  //                  ↑ T42 新增：角色到 Muse 成员的映射
  //                    T39 只有 role，binding 在运行时由 workflow_init 做
  //                    T42 在定义层就声明，Planner 创建时填入
]

// nodes 扩展：添加 user_review 标记
"nodes": {
  "brief": {
    "user_review": true,
    //  ↑ T42 新增：该节点完成后 Planner 必须请用户审核
    //    T39 没有此字段，Planner 读取此字段决定行为

    "max_iterations": 3,
    //  ↑ T42 新增：节点内最大迭代次数
    //    超过阈值 Planner 建议回退上游

    "rollback_target": "brief",
    //  ↑ T42 新增：迭代失败时建议回退的目标节点

    ...T39 现有字段不变...
  }
}
```

### definition.mjs 需要的改动

```javascript
// 新增校验：
// 1. participants[].muse_member 如果存在，必须为字符串
// 2. nodes[].user_review 如果存在，必须为 boolean
// 3. nodes[].max_iterations 如果存在，必须为正整数
// 4. nodes[].rollback_target 如果存在，必须是已声明的节点 ID
```

---

## 六、Rollback 状态机语义

### StateMachine 新增 API

```javascript
class StateMachine {
  // 现有 API 不变...

  /**
   * 回退到之前的节点
   * @param {string} targetNodeId - 目标节点 ID（必须在 history 中出现过）
   * @param {string} actor - 触发者（必须是 'system' 或 'admin'）
   * @param {string} reason - 回退原因
   * @throws {TransitionError} 如果 targetNodeId 不在 history 中
   */
  rollback(targetNodeId, actor, reason) {
    // 1. 校验：targetNodeId 必须在 history 中出现过
    const visited = new Set(this.history.map(h => h.to).filter(Boolean))
    if (!visited.has(targetNodeId)) {
      throw new TransitionError(`不能回退到未访问过的节点 "${targetNodeId}"`)
    }

    // 2. 校验：actor 只能是 system 或 admin
    if (!['system', 'admin'].includes(actor)) {
      throw new TransitionError('rollback 只能由 system 或 admin 触发')
    }

    // 3. 执行回退
    const from = this.currentNodeId
    this.#state.current_node = targetNodeId
    this.#state.history.push({
      from, to: targetNodeId,
      event: 'rollback',
      actor,
      reason,
      ts: Date.now(),
    })

    // 4. 恢复 running 状态（如果之前 paused）
    if (this.#state.status === 'paused') {
      this.#state.status = 'running'
    }
  }
}
```

### Rollback 语义

| 问题 | 决策 |
|------|------|
| **Artifacts 怎么处理？** | 保留不删。回退后的节点可以读取之前的产出作为参考，产出新版本覆盖。 |
| **History 怎么处理？** | 追加 `event: 'rollback'` 记录，不删除历史。完整审计链。 |
| **Bindings 怎么处理？** | 不变。参与者绑定在实例生命周期内不变。 |
| **Handoff session？** | Planner 重新 handoff 给目标节点的参与者，创建新 session。 |
| **迭代计数？** | 回退后该节点的 iteration count 重置为 0（新一轮）。 |

---

## 七、Planner 成员创建

### create-member.sh 规范化

将现有 `init-member.sh` 重命名为 `create-member.sh`，规范化为标准创建流程：

```bash
# 用法
./create-member.sh <family> <member-name> <role>

# 示例
./create-member.sh later-muse-family planner planner
```

#### 默认值设计

| 字段 | 默认值 | 可覆盖 |
|------|--------|--------|
| model | `alibaba-coding-plan-cn/qwen3-coder-plus` | ✅ --model |
| small_model | `alibaba-coding-plan-cn/qwen3.5-plus` | ✅ --small-model |
| engine.port | 自动分配（base 4096 + index * 2） | ✅ --port |
| web.port | engine.port + 1 | 自动 |
| telegram.botToken | 空（必须用户填写） | ✅ --bot-token |
| telegram.chatId | 空（必须用户填写） | ✅ --chat-id |
| permission.bash | allow | ✅ |
| permission.edit | allow | ✅ |

#### 用户必填项

- `telegram.botToken` — 每个 Muse 需要自己的 Telegram Bot
- `telegram.chatId` — 目标对话 ID

#### 未来：nvwa 调用 create-member.sh

nvwa 通过 Telegram 收到创建 Muse 的指令后：
1. 读取 `create-member.sh --help` 了解参数
2. 向用户确认必填项（botToken、chatId）
3. 调用 `create-member.sh` 执行创建
4. 汇报创建结果

### Planner 具体配置

创建 planner 成员后，需要：

| 配置 | 说明 |
|------|------|
| config.json | role: planner, telegram.botToken: (用户提供) |
| opencode.json | model/permission/plugin/mcp (模板默认值) |
| AGENTS.md | 工作流指挥官人格（由 identity.mjs ROLE_DEFAULTS 生成） |

---

## 八、技术方案

### 需要新增的 MCP 工具

| 工具 | 说明 | 所在文件 |
|------|------|---------|
| `workflow_create` | 接收 JSON 定义 → 校验 → 创建实例 → 持久化 | `src/mcp/planner-tools.mjs` |
| `workflow_drive` | 准备 prompt + 上下文 → handoff 给目标 Muse | `src/mcp/planner-tools.mjs` |
| `workflow_inspect` | 返回工作流全貌（节点/状态/产出/历史） | `src/mcp/planner-tools.mjs` |
| `workflow_rollback` | 回退到之前的节点 | `src/mcp/planner-tools.mjs` |

### 架构分层

```
┌──────────────────────────────────────────────┐
│              Later (Telegram)                 │  ← 用户
├──────────────────────────────────────────────┤
│           Planner Muse (指挥官)               │  ← 中心调度
│  设计工作流 | 驱动节点 | 检查产出 | 用户沟通   │
│  ↓ 调用 MCP 工具                              │
│  workflow_create | workflow_drive             │
│  workflow_inspect | workflow_rollback          │
├──────────────────────────────────────────────┤
│           T39 工作流引擎（底层）               │  ← 状态管理
│  StateMachine | GateEnforcer | Bridge        │
│  (T42 扩展: rollback API + schema 新字段)     │
├──────────────────────────────────────────────┤
│           Family Registry + Handoff           │  ← 跨 Muse 通信
├──────────────────────────────────────────────┤
│    pua (PM)    │    arch      │    coder      │  ← 执行者
└──────────────────────────────────────────────┘
```

---

## 九、实施计划

### Phase 1: 基础设施

- [ ] 将 `init-member.sh` 重命名为 `create-member.sh`，添加 `--bot-token`/`--chat-id` 参数
- [ ] 用 `create-member.sh` 创建 planner 成员
- [ ] 编写 Planner 的 AGENTS.md（指挥官人格）
- [ ] 确保 pua/arch/coder 成员可启动
- [ ] 测试: `create-member.sh` 单元测试（参数解析、目录创建、端口分配）

### Phase 2: T39 引擎扩展

- [ ] `definition.mjs`: 新增 `muse_member`/`user_review`/`max_iterations`/`rollback_target` 校验
- [ ] `state-machine.mjs`: 新增 `rollback()` API
- [ ] `bridge.mjs`: 支持动态创建的工作流定义持久化
- [ ] 测试: rollback 状态机语义测试（回退到已访问节点 ✅ / 未访问节点 ❌ / history 追加）

### Phase 3: Planner MCP 工具

- [ ] `workflow_create` — 校验 JSON → 创建定义和实例 → 持久化
- [ ] `workflow_drive` — 读取当前节点 → 组装 prompt → handoff
- [ ] `workflow_inspect` — 返回全貌
- [ ] `workflow_rollback` — 调用 StateMachine.rollback()
- [ ] 测试: MCP 工具单元测试

### Phase 4: 端到端验证 + 迭代

- [ ] E2E: pua 写文档 → Planner 检查 → 用户通过（2节点跑通）
- [ ] E2E: 用户要求修改 → Planner 转发 → pua 返工 → 重新审核
- [ ] E2E: arch 审核不通过 → coder 返工（节点内迭代）
- [ ] E2E: 连续失败 → rollback 到上游（节点间回退）
- [ ] E2E: Planner 重启后恢复进度（持久化恢复）

---

## 十、文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| **基础设施** | | |
| `create-member.sh` | 重命名+增强 | 标准 Muse 成员创建脚本 |
| `create-member.test.sh` | 新增 | 创建脚本测试 |
| `families/.../members/planner/*` | 新增 | Planner 成员配置 |
| **T39 引擎扩展** | | |
| `src/workflow/definition.mjs` | 修改 | 新增字段校验 |
| `src/workflow/definition.test.mjs` | 修改 | 新字段测试 |
| `src/workflow/state-machine.mjs` | 修改 | rollback API |
| `src/workflow/state-machine.test.mjs` | 修改 | rollback 测试 |
| `src/workflow/bridge.mjs` | 修改 | 动态工作流持久化 |
| **Planner MCP 工具** | | |
| `src/mcp/planner-tools.mjs` | 新增 | workflow_create/drive/inspect/rollback |
| `src/mcp/planner-tools.test.mjs` | 新增 | 单元测试 |
| **E2E 测试** | | |
| `src/workflow/planner-e2e.test.mjs` | 新增 | 端到端场景测试 |
| **Skill** | | |
| `.agents/skills/workflow-management/` | 新增 | Planner 工作流管理技能 |

---

## 十一、测试策略

### 单元测试

| 文件 | 测试点 |
|------|--------|
| `create-member.test.sh` | 参数解析 / 目录结构生成 / 端口自动分配 / 重复创建拒绝 |
| `definition.test.mjs` | muse_member 校验 / user_review 校验 / max_iterations 校验 / rollback_target 必须是已声明节点 |
| `state-machine.test.mjs` | rollback 到已访问节点 → 成功 / rollback 到未访问节点 → 拒绝 / rollback 追加 history / rollback actor 只能 system/admin |
| `planner-tools.test.mjs` | create: 合法 JSON → 成功, 缺字段 → 拒绝 / drive: 正确组装 prompt / inspect: 返回全貌 / rollback: 委托 StateMachine |

### E2E 测试

| # | 场景 | 验证点 |
|---|------|--------|
| 1 | pua 写文档 → Planner 检查 → 用户通过 | 完整 2 节点流程跑通 |
| 2 | 用户要求修改 → 转发 → 返工 → 审核 | 反馈闭环 + 迭代 |
| 3 | arch 审核不通过 → coder 返工 | 节点内迭代 |
| 4 | 连续 3 次失败 → rollback | 节点间回退 |
| 5 | Planner 重启 → 恢复进度 | 持久化恢复 |
| 6 | create-member.sh → 启动新 Muse → Planner handoff | 成员创建到使用全链路 |
