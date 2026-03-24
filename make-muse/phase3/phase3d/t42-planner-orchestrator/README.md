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

**参与者**：Later（用户）、Planner、PM、Arch、Coder

```
═══ 阶段 0: 用户提需求 ═══

Later → Planner (Telegram):
  "在 web 驾驶舱上加一个工作流看板，能看到所有工作流、
   节点状态、历史记录"

═══ 阶段 1: Planner 设计工作流 ═══

Planner 内部:
  - 分析：前端开发任务，需要 PM 明确需求 + Arch 做方案 + Coder 实现
  - 设计工作流节点

Planner → Later:
  "📋 我为这个任务设计了工作流：

   1️⃣ PM 写任务说明书（背景/目标/范围）→ 你审核
   2️⃣ Arch 写技术方案 + 测试方案 + 拆分子任务 → 你审核
   3️⃣ Coder 逐个开发子任务
   4️⃣ Arch 代码审核（不通过 → 回到3迭代）
   5️⃣ PM 功能验收
   6️⃣ 我向你汇报，你最终验收

   同意开始吗？需要调整哪步？"

Later → Planner: "同意"

═══ 阶段 2: PM 写任务说明书 ═══

Planner 准备上下文:
  - 收集：用户原始需求、web/ 目录结构、现有 API
  - 组装给 PM 的指令

Planner → PM (handoff):
  "任务：编写任务说明书
   用户需求：'在 web 驾驶舱上加工作流看板...'
   参考：web/ 目录有 cockpit 页面...
   产出：task-brief.md（背景/目标/范围/预期产出）
   如有疑问，标注在文档中。完成后通知我。"

PM 工作... 产出 task-brief.md
PM → Planner: "完成，有2个疑问需用户确认"

Planner 检查产出:
  ✅ 有背景/目标/范围
  ✅ 疑问已标注
  ✅ 质量合格

Planner → Later:
  "📄 PM 的说明书已完成 [摘要]
   PM 有2个疑问：
   1. 看板是否需要实时刷新？
   2. 是否支持手动干预？
   请审核：通过/需要修改/回答疑问"

Later: "1. 不用实时，轮询就行
       2. 要手动干预
       补充：要能看到每个节点的产出文件"

Planner → PM: "用户反馈：[转发] 请更新 task-brief.md"
PM 更新 → Planner 检查 ✅
Planner → Later: "说明书已更新，确认通过？"
Later: "通过"

Planner: 节点1 ✅ → 进入节点2

═══ 阶段 3: Arch 写技术方案 ═══

Planner → Arch (handoff):
  "任务：基于说明书写技术方案
   输入：task-brief.md
   产出：tech-design.md + test-plan.md + subtasks.md
   约束：只做设计，不写代码"

Arch 工作... 产出3个文件
Planner 检查 ✅
Planner → Later: "技术方案完成 [摘要]，请审核"
Later: "subtask 2 太大了，再拆细一点"
Planner → Arch: "用户要求子任务2拆更细"
Arch 更新 → Planner 检查 ✅ → Later 通过

Planner: 节点2 ✅ → 进入节点3

═══ 阶段 4: Coder 开发（迭代）═══

Planner → Coder (handoff, 子任务1):
  "任务：实现子任务 1/3
   输入：task-brief.md + tech-design.md
   验收标准：[具体标准]
   完成后运行测试。"

Coder 开发... → Planner 检查产出

Planner → Arch: "审核 Coder 的代码 [diff]"
Arch: "API 返回格式不对，缺错误处理"

❌ 迭代：
Planner → Coder: "Arch 审核反馈：[转发]，请修复"
Coder 修复 → Planner → Arch 再审
Arch: "✅ 通过"

✅ 子任务1完成 → 子任务2 → 子任务3（同样模式）

═══ 阶段 5: PM 验收 ═══

Planner → PM: "所有子任务已开发完成，对照 task-brief.md 验收功能"
PM 验收 → "功能符合说明书 ✅"

═══ 阶段 6: 用户验收 ═══

Planner → Later:
  "🎉 工作流完成！产出清单：
   - task-brief.md ✅
   - tech-design.md ✅
   - 代码实现 ✅（Arch 已审核）
   - PM 已验收 ✅
   请最终验收。"
```

### 场景二：文档整理（轻量，仅 PM）

```
Later → Planner: "整理 AGENTS.md 规范文档"

Planner → Later:
  "📋 工作流：AGENTS.md 规范文档
   1️⃣ PM 调研现有用法 → 你审核
   2️⃣ PM 写规范文档 → 你审核
   只需 PM，无需技术方案。同意？"

Later: "同意"

Planner → PM: "调研所有 AGENTS.md 文件..."
PM → Planner: 完成 → Planner 检查 ✅ → Later 审核通过
Planner → PM: "写正式规范..."
PM → Planner: 完成 → Planner 检查 ✅ → Later 验收
Planner: "🎉 完成"
```

### 场景三：Bug 修复（紧急，Coder + Arch）

```
Later → Planner: "Telegram 消息超时了，查一下"

Planner → Later:
  "📋 工作流：Telegram 超时修复
   1️⃣ Coder 排查定位 → 我向你汇报
   2️⃣ 你确认修复方案
   3️⃣ Coder 修复 → Arch 审核（迭代到通过）
   4️⃣ 你验收
   紧急任务，跳过 PM 写说明书。同意？"

Later: "赶紧查"

Planner → Coder: "排查 Telegram 超时，相关文件: telegram.mjs..."
Coder → Planner: "handlerTimeout 被覆盖了"
Planner 检查报告 ✅
Planner → Later: "根因: handlerTimeout 配置被覆盖。要修吗？"
Later: "修"

Planner → Coder: "修复" → Arch 审核
  ❌ Arch: "单测没覆盖"
  Planner → Coder: "补单测" → Arch 再审 ✅

Planner → Later: "✅ 修复完成，Arch 已审核通过"
```

### 场景四：迭代失败处理

```
开发过程中，Coder 的实现 Arch 连续3次审核不通过：

Planner 判断: 可能是技术方案有问题

Planner → Later:
  "⚠️ 子任务3已迭代3次仍未通过审核。
   Arch 的反馈: [核心问题]
   建议: 退回 Arch 更新技术方案后再开发。
   同意退回？还是继续迭代？"

Later: "退回 Arch 重新设计这部分"

Planner: 回退工作流到 tech_design 节点
Planner → Arch: "子任务3的技术方案需要调整，问题是..."
Arch 更新方案 → Planner 检查 → Later 审核 → 重新交给 Coder
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
| "退回" | 回退到之前的节点 |
| "取消/暂停" | 暂停或终止工作流 |

### 迭代策略

```
节点内迭代:             节点间回退:             任务级重来:
Coder → Arch 审核      连续失败 → Planner      用户说"推翻重来"
  ❌ → Coder 修复        判断需退回上游            → 回到节点1
  ❌ → Coder 再修       → 退回 Arch 改方案        或者终止当前工作流
  ✅ → 下一步            → 重新走后续流程          创建新的
```

### 关键原则

1. **Planner 是唯一的用户接口** — 用户不直接和 PM/Arch/Coder 交流
2. **每个节点必须"产出→检查→审核"** — 不允许跳过
3. **Planner 智能裁剪** — 根据任务复杂度决定需要哪些角色和步骤
4. **反馈必须闭环** — 每条用户反馈都必须确认已处理
5. **迭代是常态** — 不期望一次做对，支持节点内迭代和节点间回退

---

## 三、技术方案

### Planner 的 Muse 配置

| 配置 | 值 | 说明 |
|------|-----|------|
| role | planner | 工作流指挥官 |
| telegram.botToken | `8699721978:AAGpsl...` | 自有 Telegram Bot |
| model | 高质量推理模型 | 需要理解需求、做质量判断 |
| skills | workflow-management | 知道怎么设计/驱动工作流 |
| MCP tools | memory + workflow + planner专用 | 记忆 + 工作流控制 + 任务派发 |
| permissions | read + workflow_control | 不直接改代码，只看和调度 |

### 需要新增的 MCP 工具

| 工具 | 说明 | 现有/新增 |
|------|------|----------|
| `workflow_create` | 创建工作流定义 + 实例 | **新增** |
| `workflow_drive` | 推进节点（准备 prompt → handoff） | **新增** |
| `workflow_inspect` | 查看工作流全貌（节点/状态/产出） | **新增** |
| `workflow_rollback` | 回退到之前的节点 | **新增** |
| `workflow_status` | 查看当前状态 | 已有 |
| `workflow_transition` | 触发状态流转 | 已有 |
| `workflow_emit_artifact` | 写产出文件 | 已有 |
| `handoff_to_member` | 向其他 Muse 派发任务 | 基于现有 MemberClient |

### 工作流定义格式

沿用 T39 的 JSON 格式，Planner 动态创建：

```json
{
  "id": "dev-web-workflow-board",
  "name": "Web 驾驶舱工作流看板开发",
  "version": "1.0",
  "created_by": "planner",
  "initial": "pm_brief",
  
  "participants": [
    { "role": "pm", "muse_member": "pua" },
    { "role": "arch", "muse_member": "arch" },
    { "role": "coder", "muse_member": "coder" }
  ],

  "nodes": {
    "pm_brief": {
      "type": "action",
      "participant": "pm",
      "objective": "编写任务说明书",
      "output": { "artifact": "task-brief.md", "required": true },
      "exit_criteria": { "artifacts": ["task-brief.md"] },
      "review": { "required": true, "reviewer": "user" },
      "transitions": {
        "complete": { "target": "tech_design" },
        "iterate": { "target": "pm_brief" }
      }
    },
    "tech_design": {
      "type": "action",
      "participant": "arch",
      "objective": "技术方案 + 测试方案 + 子任务拆分",
      "input": { "artifacts": ["task-brief.md"] },
      "output": { "artifact": "tech-design.md", "required": true },
      "review": { "required": true, "reviewer": "user" },
      "transitions": {
        "complete": { "target": "coding" },
        "iterate": { "target": "tech_design" }
      }
    },
    "coding": {
      "type": "action",
      "participant": "coder",
      "objective": "按子任务开发",
      "input": { "artifacts": ["task-brief.md", "tech-design.md"] },
      "transitions": {
        "submit_review": { "target": "code_review" }
      }
    },
    "code_review": {
      "type": "action",
      "participant": "arch",
      "objective": "代码审核",
      "transitions": {
        "approved": { "target": "pm_acceptance" },
        "rejected": { "target": "coding" }
      }
    },
    "pm_acceptance": {
      "type": "action",
      "participant": "pm",
      "objective": "功能验收：对照 task-brief.md 确认功能完整",
      "transitions": {
        "accepted": { "target": "end" },
        "rejected": { "target": "coding" }
      }
    },
    "end": {
      "type": "terminal"
    }
  }
}
```

> **注意**：新增 `review` 字段表示该节点完成后需要用户审核。Planner 读取此字段决定是否向用户请示。`iterate` transition 允许节点内迭代。

### 架构分层

```
┌──────────────────────────────────────────────┐
│              Later (Telegram)                 │  ← 用户
├──────────────────────────────────────────────┤
│           Planner Muse (指挥官)               │  ← 中心调度
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │  设计工  │ │  驱动工  │ │  检查产出    │ │
│  │  作流    │ │  作流    │ │  + 用户沟通  │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
├──────────────────────────────────────────────┤
│           T39 工作流引擎                      │  ← 状态管理
│  StateMachine | GateEnforcer | Bridge        │
├──────────────────────────────────────────────┤
│           Family Registry + Handoff           │  ← 跨 Muse 通信
├──────────────────────────────────────────────┤
│    PM (pua)    │    Arch     │    Coder       │  ← 执行者
└──────────────────────────────────────────────┘
```

---

## 四、实施计划

### Phase 1: 创建 Planner 成员 + 基础跑通

- [ ] 用 `init-member.sh` 创建 planner 成员
- [ ] 配置 Telegram Bot Token: `8699721978:AAGpslBs3k3y1k7iMrvOgYje703jt7NKnD0`
- [ ] 编写 Planner 的 AGENTS.md（指挥官人格）
- [ ] 确保 PM/Arch/Coder 成员可创建和启动

### Phase 2: Planner MCP 工具开发

- [ ] `workflow_create` — 接收 JSON 定义 → 创建实例，持久化到 family/workflow/
- [ ] `workflow_drive` — 准备 prompt → handoff 给目标 Muse
- [ ] `workflow_inspect` — 返回工作流全貌（所有节点状态/产出）
- [ ] `workflow_rollback` — 回退节点（支持迭代）
- [ ] `handoff_to_member` — 基于 MemberClient 的任务派发

### Phase 3: 端到端验证

- [ ] 手动创建一个简单的 2 节点工作流（PM 写文档 → 用户审核）
- [ ] Planner 驱动完整流程：创建 → 派发 → 检查 → 汇报
- [ ] 验证迭代场景：用户要求修改 → 转发 → 返工 → 重新审核

### Phase 4: 迭代与健壮性

- [ ] 实现迭代计数 + 阈值判断（连续失败 → 建议回退上游）
- [ ] 实现工作流暂停/恢复（用户说"晚点再说"）
- [ ] 工作流状态持久化（Planner 重启后恢复进度）
- [ ] Web 驾驶舱展示工作流看板（这本身就是第一个实际任务）

---

## 五、文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| **成员配置** | | |
| `families/.../members/planner/config.json` | 新增 | Planner 业务配置 |
| `families/.../members/planner/opencode.json` | 新增 | OpenCode 配置 |
| `families/.../members/planner/AGENTS.md` | 新增 | 指挥官人格 |
| **MCP 工具** | | |
| `src/mcp/planner-tools.mjs` | 新增 | workflow_create/drive/inspect/rollback |
| `src/mcp/planner-tools.test.mjs` | 新增 | 单元测试 |
| **工作流引擎扩展** | | |
| `src/workflow/state-machine.mjs` | 修改 | 支持 rollback 操作 |
| `src/workflow/bridge.mjs` | 修改 | 支持 Planner 创建的动态工作流 |
| **Skill** | | |
| `.agents/skills/workflow-management/` | 新增 | Planner 的工作流管理技能文档 |

---

## 六、测试策略

### 单元测试

| 模块 | 测试点 |
|------|--------|
| `workflow_create` | 合法 JSON → 创建成功；缺必填字段 → 拒绝 |
| `workflow_drive` | 正确组装 prompt + 上下文 → handoff 成功 |
| `workflow_rollback` | 回退到之前节点；不能回退到未来节点 |
| `workflow_inspect` | 返回所有节点状态和产出清单 |

### 端到端测试

| # | 场景 | 验证点 |
|---|------|--------|
| 1 | PM 写文档 → 用户通过 | 完整流程跑通 |
| 2 | 用户要求修改 → 迭代 | 反馈传达 + 文档更新 |
| 3 | Arch 审核不通过 → Coder 返工 | 节点内迭代 |
| 4 | 连续失败 → 回退上游 | 节点间回退 |
| 5 | Planner 重启 → 恢复进度 | 持久化恢复 |
