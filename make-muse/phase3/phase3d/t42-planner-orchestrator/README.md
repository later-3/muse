# T42 Planner Orchestrator — 架构设计

> Planner 是工作流指挥官：创建工作流、驱动节点、检查产出、管理迭代、汇报用户。

---

## 一、核心范式

```
Hook 驱动（T39）：                     Planner 驱动（T42）：
工作流 JSON 预定义                      Planner 根据任务动态设计工作流
Plugin hook 注入 prompt                Planner 为每个 Muse 准备精确指令
各 Muse 自己调 transition()            Planner 检查产出 → 决定是否推进
分散式，无人负责全局                    Planner 是唯一指挥官和用户接口
```

---

## 二、交互全景

### 场景一：开发任务（全链路，含迭代）

**参与者**：Later（用户）、Planner、pua(PM)、arch、coder

```
═══ 阶段 0: 用户提需求 ═══

Later → Planner: "在 web 驾驶舱上加工作流看板"

═══ 阶段 1: Planner 设计工作流 ═══

Planner → Later:
  "📋 工作流设计：
   1️⃣ pua 写说明书 → 你审核
   2️⃣ arch 技术方案 + 任务拆分 → 你审核
   3️⃣ coder 开发 → arch 代码审核（迭代到通过）
   4️⃣ pua 功能验收 → 你最终验收
   同意？"
Later: "同意"

═══ 阶段 2: pua 写说明书 ═══

Planner → pua (handoff): "写任务说明书，用户需求: ..."
pua 产出 task-brief.md → 通知 Planner "写完了"
  （注意：pua 不调 transition，只通知 Planner）
Planner 检查 ✅ → Planner → Later "请审核"
Later: "补充需求 xxx" → Planner → pua 修改 → 再检查 → Later 通过
Planner 调 transition → 节点1 ✅

═══ 阶段 3: arch 技术方案 ═══

（同样模式：Planner handoff → arch 工作 → Planner 检查 → Later 审核）

═══ 阶段 4: coder 开发 + arch 审核（迭代）═══

Planner → coder: "实现子任务1"
coder 开发 → 通知 Planner
Planner → arch: "审核代码"
arch: "返回格式不对" → Planner → coder "修复" → arch 再审 → ✅
（迭代直到通过，Planner 统一调度）

═══ 阶段 5-6: 验收 ═══

Planner → pua 验收 → Planner → Later 最终验收 → 🎉
```

### 场景二：文档任务（轻量，仅 pua）/ 场景三：Bug 修复（紧急，跳过 pua）

_（交互模式同上，Planner 根据任务复杂度智能裁剪参与者和步骤）_

### 场景四：迭代失败处理

```
coder 连续 3 次审核未通过 → Planner 判断上游方案可能有问题
Planner → Later: "⚠️ 建议退回 arch 重新设计。同意？"
Later: "退回" → Planner rollback → arch 更新方案 → 重走后续流程
```

---

## 三、Planner 与 T39 的职责边界

> [!IMPORTANT]
> 这是 T42 最关键的设计：避免双驱动。

### 3.1 planner-mode 标识

工作流定义新增 **`driver`** 字段：

```jsonc
{
  "id": "dev-web-board",
  "driver": "planner",   // ← T42 新增：工作流由 planner 驱动
  // "driver" 缺省 = "self"（T39 兼容模式，各 Muse 自驱动）
  ...
}
```

**`driver` 控制两件事**：
1. `workflow-prompt.mjs` 的注入行为
2. `workflow_transition` 的调用权限

### 3.2 workflow-prompt 行为分叉

| driver | wait_for_user | workflow-prompt 注入给 active Muse 的指令 |
|--------|--------------|------------------------------------------|
| `"self"` | false | "完成后**立即调用 workflow_transition** 推进" |
| `"self"` | true | "向用户展示内容，等待用户 Telegram 回复，再调 transition" |
| `"planner"` | false | "按步骤完成工作，**通知 Planner 你完成了**，不要调 transition" |
| `"planner"` | true | "按步骤完成工作，**通知 Planner 你完成了**，不要调 transition，不要直接联系用户" |

> **硬规则**：`driver=planner` 时，**无论 `wait_for_user` 是否为 true**，prompt 统一改写为"通知 Planner"。
> `wait_for_user` 在 planner 模式下的含义变为：Planner 读取此标记后决定向用户请示，而不是 active Muse 直接和用户交互。

```javascript
// workflow-prompt.mjs 改动（伪代码）
const isPlannerMode = sm.definition.driver === 'planner'

if (isPlannerMode) {
  // ★ planner 模式：统一行为，不区分 wait_for_user
  sections.push('## 执行规则')
  sections.push('- 按步骤指引完成工作')
  sections.push('- 完成后通知 Planner，说明产出和结果')
  sections.push('- ⛔ 不要调用 workflow_transition，由 Planner 统一推进')
  sections.push('- ⛔ 不要直接通过 Telegram 联系用户，由 Planner 中转')
} else if (node.wait_for_user) {
  // T39 原逻辑: 等待用户
} else {
  // T39 原逻辑: 自主执行 + 调 transition
}
```

### 3.3 admin override 运行时合同

当前 `StateMachine.transition()` 的 actor 校验是**严格相等**：

```javascript
// state-machine.mjs:110 (现状)
if (transitionDef.actor && transitionDef.actor !== actor) {
  throw new TransitionError(...)
}
```

这意味着 `actor: 'admin'` 调用 `actor: 'agent'` 的 transition 会被拒绝。

**T42 改动**：admin 可以 override 任何 actor 约束（1 行改动）：

```diff
// state-machine.mjs:110
- if (transitionDef.actor && transitionDef.actor !== actor) {
+ if (transitionDef.actor && transitionDef.actor !== actor && actor !== 'admin') {
    throw new TransitionError(...)
  }
```

**语义**：
- `actor: 'agent'` → 只有 agent 能触发（T39 不变）
- `actor: 'user'` → 只有 user 能触发（T39 不变）
- `actor: 'admin'` → **可以触发任何 transition**，无视 transitionDef.actor 约束
- `actor: 'system'` → 只能触发 system 或无约束的 transition（T39 不变）

> `admin` 已在 `ACTOR_TYPES` 中（`definition.mjs:19`），不需要新增枚举值。

### 3.4 transition 权限模型

| 主体 | T39 模式 (driver=self) | T42 模式 (driver=planner) |
|------|----------------------|--------------------------|
| **active Muse** | ✅ 可调 transition（actor=agent） | ❌ 被 GateEnforcer 拦截 transition 工具 |
| **Planner** | — | ✅ 通过 `workflow_admin_transition`（actor=admin, override） |
| **用户** | ✅ /wf approve（actor=user） | ✅ 通过 Planner 中转（Planner admin 代调） |

**实现方式**：新增 `workflow_admin_transition` MCP 工具：

```javascript
// planner-tools.mjs
export async function handleAdminTransition(args) {
  const { instance_id, event, reason } = args
  // 1. 按 instance_id 找 SM（不依赖 session 绑定）
  const sm = registry.getByInstanceId(instance_id)
  // 2. 以 'admin' actor 执行 — admin override 跳过 actor 校验
  const result = sm.transition(event, 'admin')
  // 3. 持久化 + handoff 逻辑...
  return result
}
```

> **注意**：需要在 `WorkflowRegistry` 新增 `getByInstanceId(id)` 方法（当前只有 `getBySession`），以及在 `StateMachine.transition` 中允许 `actor: 'admin'`（当前已支持，`TransitionDef.actor` 已包含 `admin` 在 `ACTOR_TYPES` 中）。

### 3.4 两种模式完全兼容

```
driver=self  → T39 原样工作，不改一行代码
driver=planner → workflow-prompt 改指令 + GateEnforcer 拦截 transition 工具 + Planner 通过 admin 工具驱动
```

---

## 四、muse_member 真相源

### 决策：不进 Schema，运行时绑定

`muse_member` **不放进工作流定义 JSON**。原因：
- 定义层声明 role（`pua`/`arch`/`coder`）= 逻辑角色
- 运行时 Planner 查询 Family Registry 解析 role → 真实 member name

```
定义层:  participants: [{ role: "pua" }, { role: "arch" }]
                              ↓
Planner 运行时:  查 family registry
                 role:pua → member:test-pua (engine: 127.0.0.1:4098)
                 role:arch → member:arch (engine: 127.0.0.1:4101)
                              ↓
绑定:  创建 workflow instance 时，Planner 传入 bindings
```

**Registry 已有的数据**（`registry.json`）：
```json
{
  "test-pua": { "role": "pua", "engine": "http://127.0.0.1:4098" },
  "arch":     { "role": "arch", "engine": "http://127.0.0.1:4101" },
  "test-coder": { "role": "coder", "engine": "http://127.0.0.1:4102" }
}
```

Planner 通过 role 反查 member name，避免定义层和运行时两套真相源。

---

## 五、user_review 与 wait_for_user

### 决策：不新增 schema 字段

`user_review` **不放进 Schema**，而是 **Planner 的行为逻辑**：

| 机制 | 归属 | driver=self | driver=planner |
|------|------|------------|----------------|
| `wait_for_user` | T39 Schema | prompt 注入"等待用户 Telegram 回复" | **prompt 改写为"通知 Planner"** |
| user_review | Planner 逻辑 | 不存在 | Planner 自己决定何时请用户审核 |

**规则**：
- `driver=planner` 时，`wait_for_user` 的 prompt 被改写（见 3.2 节），active Muse **不直接和用户交互**
- Planner 读取 `wait_for_user` 标记作为「此节点需要用户审核」的**提示**，但 Planner 也可以在任何节点自主决定请用户审核
- 不引入新 Schema 字段，不和 `wait_for_user` 重叠

---

## 六、Planner 设计哲学

### 6.1 什么是好的 Muse

一个 Muse 的质量取决于 5 层设计：

| 层 | 决定 | 说明 |
|----|------|------|
| **身份** (AGENTS.md) | 我是谁 | 人格、使命、安全边界。决定 AI 的"灵魂" |
| **工具** (MCP) | 我能做什么 | 结构化能力。tool = 可靠的行动通道 |
| **知识** (knowledge/) | 我知道什么 | 领域知识、规则、案例。减少发现成本 |
| **技能** (skills/) | 我怎么做 | 特定任务的 SOP。把模式固化为可复用流程 |
| **约束** (GateEnforcer) | 我不能做什么 | 硬性边界。不依赖 AI 自律 |

### 6.2 Planner 的五层设计

#### 身份 (AGENTS.md)

```markdown
你是 Planner，Muse 家族的工作流指挥官。

## 使命
- 理解用户需求，设计合适的工作流
- 驱动工作流到完成，保证每步产出质量
- 作为用户唯一的沟通接口

## 行为原则
- 从不亲自写代码或修改文件
- 从不跳过质量检查
- 从不替用户做决定
- 遇到不确定时，问用户而不是猜

## 安全边界
- 禁止: 执行任何 bash 命令
- 禁止: 编辑任何源代码文件
- 禁止: 跳过用户审核环节
```

#### 工具 (MCP)

| 工具 | 说明 | 为什么 Planner 需要 |
|------|------|-------------------|
| `workflow_create` | 创建工作流定义 + 实例 | 核心职责：设计工作流 |
| `workflow_admin_transition` | admin 级 transition | 统一驱动，不依赖 session 绑定 |
| `workflow_inspect` | 查看工作流全貌 | 检查进度和产出 |
| `workflow_rollback` | 回退节点 | 管理迭代失败 |
| `handoff_to_member` | 向 Muse 派发任务 | 基于 MemberClient，带 prompt + 上下文 |
| `read_artifact` | 读取工作流产出文件 | 检查产出质量 |
| `memory` | set_memory / search_memory | 记住工作流经验和用户偏好 |

**Planner 没有的工具**：
- ❌ `bash` — 不执行任何命令
- ❌ `edit`/`write` — 不修改代码
- ❌ `workflow_transition` — 用 admin_transition 代替
- ❌ `workflow_emit_artifact` — 不产出产物，由执行者产出

#### 知识 (knowledge/)

```
members/planner/knowledge/
├── INDEX.md                     ← 知识导航
├── workflow-patterns.md         ← 工作流模式库（开发/文档/bug修复模板）
├── quality-checklist.md         ← 产出质量检查标准
├── safety-rules.md              ← 安全红线规则
├── family-members.md            ← 家族成员能力画像
└── iteration-playbook.md        ← 迭代处理策略
```

**关键知识包内容**：

**quality-checklist.md** — Planner 检查产出的标准：

```markdown
## 任务说明书 (task-brief.md)
- [ ] 有明确的背景、目标、范围
- [ ] 有预期产出清单
- [ ] 疑问点已标注
- [ ] 不包含技术实现细节（那是 arch 的事）

## 技术方案 (tech-design.md)
- [ ] 基于 task-brief 的目标
- [ ] 有架构设计和组件拆分
- [ ] 有测试策略
- [ ] 子任务有明确的输入/输出/验收标准

## 代码实现
- [ ] 只修改了子任务允许的文件
- [ ] 测试通过
- [ ] 无占位符或 TODO
```

**safety-rules.md** — 安全红线：

```markdown
## 硬性拦截（Planner 必须阻止）
- rm -rf / rm -r 任何目录
- 修改 AGENTS.md（身份文件）
- 修改 config.json / opencode.json（配置文件）
- 删除 memory.db 或其他数据文件
- 访问 .env / token / secret 相关文件

## 警告确认（Planner 需要向用户确认）
- 修改 package.json 依赖
- 创建超过 5 个新文件
- 修改超过 10 个文件
- 任何涉及网络请求的代码
```

**family-members.md** — Planner 需要知道每个成员的能力：

```markdown
| 成员 | 角色 | 擅长 | 不擅长 |
|------|------|------|--------|
| test-pua | pua(PM) | 需求分析、文档编写、用户沟通 | 写代码、技术设计 |
| arch | arch | 架构设计、代码审核、技术决策 | 需求沟通、编码实现 |
| test-coder | coder | 编码实现、测试编写 | 需求分析、架构设计 |
```

#### 技能 (skills/)

```
.agents/skills/workflow-management/SKILL.md
```

核心内容：
- 如何设计工作流（根据任务类型选择模板）
- 如何组装 handoff prompt（上下文准备原则）
- 如何检查产出质量（检查清单使用方法）
- 如何处理迭代失败（何时请用户决策、何时自动重试）
- 如何向用户汇报（摘要格式、频率）

#### 约束 (OpenCode 权限)

```json
// planner opencode.json
{
  "permission": {
    "bash": "deny",
    "edit": "deny",
    "read": "allow",
    "glob": "allow",
    "grep": "allow",
    "webfetch": "deny",
    "websearch": "deny"
  }
}
```

> Planner 只能**读**，不能**写**。所有改动通过 handoff 给执行者完成。

### 6.3 Planner 的上下文管理原则

Planner 为每个节点准备 handoff prompt 时，遵循 **最小充分上下文原则**：

| 层 | 内容 | 说明 |
|----|------|------|
| **任务层** | 用户原始需求 + 工作流目标 | 让执行者理解全局 |
| **节点层** | 本节点的 objective + instructions + constraints | 让执行者知道该做什么 |
| **输入层** | 上游产出文件路径/内容摘要 | 让执行者有依据 |
| **反馈层** | 之前迭代的反馈（如果有） | 避免重复犯错 |
| **边界层** | 不能做什么 | 安全红线 |

**不给的**：
- 其他节点的内部状态（执行者不需要知道整个工作流的细节）
- 其他 Muse 的产出（除非是当前节点的输入）
- 用户的历史对话（隐私边界）

---

## 七、角色命名真相源

系统内部统一使用 `pua`/`arch`/`coder`/`planner`，不引入第二套命名。

| 面向用户 | 系统 role | 当前 member name | 说明 |
|---------|----------|-----------------|------|
| PM | pua | test-pua | 需求/文档/验收 |
| 架构师 | arch | arch | 方案/审核 |
| 开发者 | coder | test-coder | 编码/测试 |
| 指挥官 | planner | planner(待创建) | 工作流 |

> Planner 在向用户展示时可以用中文名，但 JSON 和 MCP 中一律用系统 role 名。
> member name 和 role 的映射通过 family registry 查询，不硬编码。

---

## 八、Rollback 状态机语义

### StateMachine.rollback() API

```javascript
rollback(targetNodeId, actor, reason) {
  // 校验：targetNodeId 必须在 history 中出现过
  // 校验：actor 只能是 system 或 admin
  // 执行：current_node → targetNodeId, history 追加 rollback 记录
  // artifacts 保留不删（新版本覆盖旧版本）
  // 迭代计数重置
}
```

| 问题 | 决策 |
|------|------|
| Artifacts | 保留。回退后产出新版本覆盖。 |
| History | 追加 `event: 'rollback'`，不删历史。 |
| Bindings | 不变。 |
| Handoff session | Planner 重新 handoff，新 session。 |

---

## 九、Planner 成员创建

### create-member.sh 规范

将 `init-member.sh` 重命名为 `create-member.sh`：

```bash
./create-member.sh <family> <member-name> <role> [选项]

# 选项
--bot-token <token>     # Telegram Bot Token (必填项，无默认值)
--chat-id <id>          # Telegram Chat ID (必填项，无默认值)
--model <model>         # 模型 (默认: alibaba-coding-plan-cn/qwen3-coder-plus)
--port <port>           # engine 端口 (默认: 自动分配)
```

| 字段 | 默认值 | 必填 |
|------|--------|------|
| model | `alibaba-coding-plan-cn/qwen3-coder-plus` | 否 |
| engine.port | 自动分配 | 否 |
| telegram.botToken | — | **是** |
| telegram.chatId | — | **是** |

**未来**：nvwa 通过 Skill 调用 `create-member.sh`，提前收集用户的必填参数。

---

## 十、实施计划

### Phase 1: T39 引擎扩展（基础设施）

- [ ] `definition.mjs`: 新增 `driver` 字段校验（`"self"` | `"planner"`，默认 `"self"`）
- [ ] `definition.mjs`: 新增 `max_iterations`/`rollback_target` 校验
- [ ] `state-machine.mjs`: 新增 `rollback()` API
- [ ] `registry.mjs`: 新增 `getByInstanceId()` 方法
- [ ] `workflow-prompt.mjs`: `driver=planner` 时改注入指令（"通知 Planner" 替代 "调 transition"）
- [ ] `gate-enforcer.mjs`: `driver=planner` 时拦截执行者的 `workflow_transition` 工具
- [ ] 测试: rollback / driver 分叉 / gate 拦截

### Phase 2: Planner 成员创建

- [ ] 重命名 `init-member.sh` → `create-member.sh`，增加 `--bot-token`/`--chat-id` 参数
- [ ] `create-member.sh later-muse-family planner planner --bot-token ... --chat-id ...`
- [ ] 编写 Planner AGENTS.md（指挥官人格）
- [ ] 准备 Planner knowledge/ 知识包
- [ ] 测试: create-member.sh 参数解析 / 目录结构 / 端口分配 / 重复创建拒绝

### Phase 3: Planner MCP 工具

- [ ] `workflow_create` — 校验 JSON + 通过 registry 解析 role→member → 创建实例
- [ ] `workflow_admin_transition` — admin 级 transition（按 instance_id，不按 session）
- [ ] `workflow_inspect` — 返回工作流全貌
- [ ] `workflow_rollback` — 委托 StateMachine.rollback()
- [ ] `handoff_to_member` — 组装 prompt + MemberClient 派发
- [ ] `read_artifact` — 读取工作流产出文件
- [ ] 测试: 各工具单元测试

### Phase 4: 端到端验证

- [ ] E2E: 2 节点跑通（pua 写文档 → Planner 检查 → 用户通过）
- [ ] E2E: 用户修改反馈 → 迭代
- [ ] E2E: arch 审核不通过 → coder 返工（节点内迭代）
- [ ] E2E: 连续失败 → rollback（节点间回退）
- [ ] E2E: Planner 重启后恢复进度
- [ ] E2E: create-member.sh → 启动 → Planner handoff 全链路

---

## 十一、文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| **T39 扩展** | | |
| `src/workflow/definition.mjs` | 修改 | +driver/max_iterations/rollback_target 校验 |
| `src/workflow/state-machine.mjs` | 修改 | +rollback() API |
| `src/workflow/registry.mjs` | 修改 | +getByInstanceId() |
| `src/plugin/hooks/workflow-prompt.mjs` | 修改 | driver=planner 分叉 |
| `src/workflow/gate-enforcer.mjs` | 修改 | driver=planner 拦截 transition 工具 |
| **Planner 成员** | | |
| `create-member.sh` | 重命名+增强 | +--bot-token/--chat-id 参数 |
| `families/.../members/planner/*` | 新增 | config/opencode/AGENTS/knowledge |
| **MCP 工具** | | |
| `src/mcp/planner-tools.mjs` | 新增 | create/admin_transition/inspect/rollback/handoff |
| `src/mcp/planner-tools.test.mjs` | 新增 | 单元测试 |
| **E2E** | | |
| `src/workflow/planner-e2e.test.mjs` | 新增 | 端到端场景测试 |
| **Skill** | | |
| `.agents/skills/workflow-management/` | 新增 | Planner 工作流管理技能 |
| **Knowledge（Planner 家目录下）** | | |
| `families/.../members/planner/knowledge/quality-checklist.md` | 新增 | 产出质量检查标准 |
| `families/.../members/planner/knowledge/safety-rules.md` | 新增 | 安全红线规则 |
| `families/.../members/planner/knowledge/family-members.md` | 新增 | 家族成员能力画像 |
| `families/.../members/planner/knowledge/iteration-playbook.md` | 新增 | 迭代处理策略 |

---

## 十二、测试策略

### 单元测试

| 文件 | 测试点 |
|------|--------|
| `definition.test.mjs` | driver 校验 / max_iterations 校验 / rollback_target 必须是已声明节点 |
| `state-machine.test.mjs` | rollback / **admin override**（actor=admin 可触发 actor=agent 的 transition） |
| `registry.test.mjs` | getByInstanceId 正确返回 / 不存在返回 null |
| `workflow-prompt.test.mjs` | driver=self → "调 transition" / driver=planner → "通知 planner" / **driver=planner+wait_for_user → "通知 planner, 不联系用户"** |
| `gate-enforcer.test.mjs` | driver=planner → 拦截执行者 transition / driver=self → 放行 |
| `planner-tools.test.mjs` | create/admin_transition/inspect/rollback 各工具单元测试 |
| `create-member.test.sh` | 参数解析 / 目录生成 / 端口分配 / 重复创建拒绝 |

### E2E 测试

| # | 场景 | 验证点 |
|---|------|--------|
| 1 | pua 写文档 → Planner admin_transition → 进入下一节点 | **admin override 跑通** |
| 2 | 用户要求修改 → Planner 转发 → pua 返工 | 反馈闭环 |
| 3 | arch 审核不通过 → coder 返工 | 节点内迭代 |
| 4 | 连续 3 次失败 → rollback | 节点间回退 |
| 5 | Planner 重启 → 恢复进度 | 持久化恢复 |
| 6 | create-member → 启动 → handoff | 全链路 |
| 7 | driver=planner + 执行者调 transition → 被拦截 | 双驱动防护 |
| 8 | driver=planner + wait_for_user 节点 → prompt 不含"联系用户" | wait_for_user 改写 |

---

## 十三、子任务拆分

### T42-1: T39 引擎扩展 — admin override + driver 字段

| # | 子任务 | 改动文件 | 测试 |
|---|--------|---------|------|
| 1.1 | `StateMachine.transition()` admin override | `state-machine.mjs:110` | actor=admin 可触发 agent/user transition |
| 1.2 | `definition.mjs` 新增 `driver` 字段校验 | `definition.mjs` | driver=self/planner 合法，其他拒绝 |
| 1.3 | `definition.mjs` 新增 `max_iterations`/`rollback_target` 校验 | `definition.mjs` | 正整数 / 必须是已声明节点 |
| 1.4 | `StateMachine.rollback()` API | `state-machine.mjs` | 回退已访问 ✅ / 未访问 ❌ / history 追加 |
| 1.5 | `WorkflowRegistry.getByInstanceId()` | `registry.mjs` | 找到 ✅ / 找不到 null |

### T42-2: workflow-prompt planner-mode 分叉

| # | 子任务 | 改动文件 | 测试 |
|---|--------|---------|------|
| 2.1 | driver=planner 时注入"通知 Planner" | `workflow-prompt.mjs` | 不含 workflow_transition 指令 |
| 2.2 | driver=planner + wait_for_user → 同样"通知 Planner" | `workflow-prompt.mjs` | 不含"联系用户/Telegram" |
| 2.3 | GateEnforcer: driver=planner 拦截执行者 transition 工具 | `gate-enforcer.mjs` | 调 transition → 被拦截 |

### T42-3: create-member.sh 规范化

| # | 子任务 | 改动文件 | 测试 |
|---|--------|---------|------|
| 3.1 | 重命名 init-member.sh → create-member.sh | — | — |
| 3.2 | 增加 --bot-token / --chat-id 参数 | `create-member.sh` | 参数解析正确 |
| 3.3 | 必填项缺失时报错退出 | `create-member.sh` | 无 token → exit 1 |
| 3.4 | 创建 planner 成员 | 运行脚本 | 目录结构 + 配置文件生成 |

### T42-4: Planner MCP 工具

| # | 子任务 | 改动文件 | 测试 |
|---|--------|---------|------|
| 4.1 | `workflow_create` — 校验 + 创建实例 + role→member 解析 | `planner-tools.mjs` | 合法 JSON ✅ / 缺字段 ❌ |
| 4.2 | `workflow_admin_transition` — admin 级 transition | `planner-tools.mjs` | 触发 agent transition ✅ |
| 4.3 | `workflow_inspect` — 工作流全貌 | `planner-tools.mjs` | 返回所有节点状态 |
| 4.4 | `workflow_rollback` — 委托 SM.rollback() | `planner-tools.mjs` | 回退成功 ✅ |
| 4.5 | `handoff_to_member` + `read_artifact` | `planner-tools.mjs` | prompt 组装 + 文件读取 |

### T42-5: Planner 成员配置 + 知识包

| # | 子任务 | 文件 |
|---|--------|------|
| 5.1 | Planner AGENTS.md（指挥官人格） | `members/planner/AGENTS.md` |
| 5.2 | knowledge/quality-checklist.md | Planner 知识包 |
| 5.3 | knowledge/safety-rules.md | Planner 知识包 |
| 5.4 | knowledge/family-members.md | Planner 知识包 |
| 5.5 | knowledge/iteration-playbook.md | Planner 知识包 |
| 5.6 | workflow-management Skill | `.agents/skills/workflow-management/` |

### T42-6: 端到端验证

| # | 子任务 | 场景 |
|---|--------|------|
| 6.1 | 2 节点跑通 | pua 写文档 → admin_transition → 完成 |
| 6.2 | 迭代 | 用户修改 → 转发 → 返工 |
| 6.3 | 双驱动防护 | 执行者调 transition → 被拦截 |
| 6.4 | rollback | 连续失败 → 回退 |
| 6.5 | 持久化 | Planner 重启 → 恢复进度 |
