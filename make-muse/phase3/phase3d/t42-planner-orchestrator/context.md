# T42 上下文文档 — 为什么需要 Planner Orchestrator

> 给审核人员和执行者阅读，理解 T42 的背景、动机、目标。

---

## 背景

### T39 工作流引擎现状

T39 实现了一套基于 OpenCode Plugin Hooks 的工作流引擎：

- **StateMachine** — FSM 状态流转、actor 校验、exit_criteria
- **GateEnforcer** — 工具白名单 + bash 策略硬性拦截
- **Bridge** — 持久化（state.json → instances/archive）
- **WorkflowPrompt** — system.transform 节点指令注入
- **MCP 工具** — workflow_status/transition/emit_artifact

### Hook 驱动模型的局限

T39 的工作流是 **Hook 驱动** 的：

```
工作流 JSON → 插件加载 → 注入 system prompt 到每个 Muse
每个 Muse 自己调 workflow_transition() 前进
用户通过 Telegram /wf 命令参与审核
```

**问题**：
1. **无中心协调** — 没有人负责"接下来该做什么"，每个 Muse 自主决策，容易漂移
2. **工作流是预定义的** — 必须提前写好 JSON 文件，无法根据任务动态设计
3. **产出质量无人检查** — exit_criteria 只检查文件是否存在，不检查内容质量
4. **反馈循环复杂** — 用户反馈要经过多个系统环节才能传达给工作中的 Muse
5. **迭代难以管理** — 当 Arch 审核不通过需要 Coder 返工时，缺乏智能调度

### 真正需要什么

Later 需要一个**工作流指挥官**，就像一个项目经理：

- 理解任务 → 设计合适的工作流
- 逐步推动 → 给每个 Muse 准备精确的指令和上下文
- 检查质量 → 确保每步产出合格
- 管理沟通 → 作为用户的唯一接口
- 处理迭代 → 审核不通过就安排返工，直到通过

## 目标

### 主目标

> **创建 Planner Muse** — 一个专职工作流指挥官，负责创建工作流、驱动节点、检查产出、管理用户审核循环。

### 具体目标

1. **Planner 创建工作流** — 根据用户需求动态设计工作流节点和参与者
2. **Planner 驱动工作流** — 逐节点推动，为每个角色准备 prompt 和上下文
3. **Planner 检查产出** — 每步完成后验证产出质量，不合格要求返工
4. **Planner 管理审核** — 作为用户唯一沟通接口，中转反馈，管理迭代循环
5. **迭代直到完成** — 子任务/节点/整体都可以迭代，直到质量达标

### 与 T39 的关系

T42 **基于 T39 引擎**，不替代它：
- StateMachine、GateEnforcer、Bridge 继续使用
- Planner 通过 MCP 工具操作工作流引擎（创建/查询/流转）
- Hook 机制（prompt 注入、工具拦截）继续为被派发的 Muse 生效
- **变化**：驱动者从"每个 Muse 自己"变成"Planner 统一驱动"

## 依赖

| 依赖 | 状态 | 说明 |
|------|------|------|
| T39 工作流引擎 | ✅ 已实现 | StateMachine/GateEnforcer/Bridge |
| Family Registry | ✅ 已实现 | Muse 成员发现 + Handoff |
| Muse Home 隔离 | ✅ 已实现 | members/ 目录 + shared/ + 静态 opencode.json |
| pua Muse | ✅ 存在 | test-pua 在 registry 中，需正式化 |
| arch Muse | ✅ 存在 | arch 在 registry 中，需正式化 |
| coder Muse | ✅ 存在 | test-coder 在 registry 中，需正式化 |
| create-member.sh | ⚠️ 需规范化 | 现有 init-member.sh 需重命名 + 增强 |
