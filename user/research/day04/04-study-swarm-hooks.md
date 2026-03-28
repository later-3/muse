# Day 04：Swarm 源码走读 + Handoff 协议设计 + OpenCode Hook 系统

> **Sprint 1 · Day 4 · 类型：源码拆解 + Muse 设计 + OpenCode Hook**  
> **学习目标：**  
> ① 读懂 Swarm 的核心 100 行代码  
> ② 设计 Muse Handoff 协议草案  
> ③ 掌握 OpenCode 46+ Hook 机制

---

## 📖 Step 1: Swarm 源码走读

> **仓库位置：** `make-muse/reference/swarm/` (待 clone)  
> **代码量：** 核心只有 ~100 行 Python  
> **设计哲学：** "教育性质的框架 — 不适合生产，但设计思想极其精炼"

### Swarm 的核心：`run()` 循环

```python
# swarm/core.py — 简化后的核心循环
class Swarm:
    def run(self, agent, messages, context_variables={}, max_turns=float("inf")):
        """Swarm 的心脏 — 一个 ReAct 循环"""
        active_agent = agent
        history = list(messages)
        
        while len(history) - len(messages) < max_turns:
            # 1. 调 LLM
            response = self.get_chat_completion(
                agent=active_agent,
                history=history,
                context_variables=context_variables,
            )
            message = response.choices[0].message
            history.append(message)
            
            # 2. 没有 tool_calls → 对话结束
            if not message.tool_calls:
                break
            
            # 3. 执行每个 tool_call
            for tool_call in message.tool_calls:
                result = self.handle_tool_call(
                    tool_call, active_agent.functions, context_variables
                )
                
                # 4. 关键！如果 tool 返回的是 Agent → Handoff！
                if isinstance(result, Agent):
                    active_agent = result  # 切换 agent！
                    # 注入新 agent 的 system prompt
                
                history.append(tool_result_message(result))
        
        return Response(messages=history, agent=active_agent)
```

### 🔑 Swarm 的 4 个核心设计决策

| 决策 | 具体实现 | 为什么这样设计 |
|------|---------|-------------|
| **Handoff = 返回 Agent** | `return billing_agent` | 不需要额外协议，函数返回值就是一切 |
| **Agent = instructions + functions** | 两个属性就够了 | 最小化 Agent 定义，没有多余抽象 |
| **上下文通过 `context_variables` 传递** | 字典在所有 Agent 间共享 | 避免了复杂的消息传递协议 |
| **没有 DAG / Graph** | 纯粹的循环 | "Routines and handoffs" — 不需要状态机 |

### Agent 类的极简设计

```python
class Agent:
    name: str = "Agent"                    # 名字
    model: str = "gpt-4"                   # 模型
    instructions: str | Callable = "..."   # prompt（可以是函数！）
    functions: list = []                   # 可用工具
    tool_choice: str = None                # 工具选择策略
    parallel_tool_calls: bool = True       # 是否允许并行调用
```

**instructions 可以是函数！** 这意味着 prompt 可以动态生成：

```python
def dynamic_instructions(context_variables):
    user_name = context_variables.get("user_name", "用户")
    return f"你是 {user_name} 的私人助理，语气要友好。"

agent = Agent(
    name="助理",
    instructions=dynamic_instructions,  # 每次调用动态生成
)
```

### Handoff 实现的极简性

```python
# 这就是一个完整的 Handoff 工具。没了。
def transfer_to_billing():
    """转交给账单专家"""
    return billing_agent

def transfer_to_tech():
    """转交给技术支持"""
    return tech_agent

# Agent 把这些函数当做工具
triage_agent = Agent(
    name="分诊",
    functions=[transfer_to_billing, transfer_to_tech],
)
```

### 🎯 Muse vs Swarm 对比

| 维度 | Swarm | Muse |
|------|-------|------|
| **Agent 定义** | Python 类 (2 属性) | AGENTS.md + config.json |
| **Handoff 方式** | 函数返回 Agent | MCP tool → HTTP POST |
| **通信协议** | 共享 context_variables | MCP notify_planner |
| **Agent 发现** | 代码导入 | Family Registry |
| **状态管理** | 无 (stateless) | Workflow 状态机 |
| **进程模型** | 单进程 | 多进程 (OpenCode 实例) |

**Muse 可以借鉴的：**
1. **instructions 可以是函数** → Muse 的 prompt 也可以根据 context 动态注入
2. **context_variables 共享** → Muse 的 workflow context 就是这个概念
3. **极简思想** → Muse 的 Handoff 协议不需要太复杂

---

## 🎯 Step 2: Muse Handoff 协议草案

### 基于 Swarm + Muse 现状的设计

```typescript
// Muse Handoff 协议 v0.1
interface HandoffRequest {
  instance_id: string         // 工作流实例 ID
  from_role: string           // 谁发起的 handoff （如 planner）
  to_role: string             // 分派给谁 （如 coder）
  task: {
    objective: string         // 一句话目标
    context: string           // 上游产出的摘要
    constraints: string[]     // 约束条件
    artifacts: string[]       // 引用的文件
  }
  timeout_ms: number          // 超时时间（Swarm 没有，Muse 必须有）
}

interface HandoffResponse {
  instance_id: string
  from_role: string
  status: 'done' | 'blocked' | 'failed' | 'timeout'
  summary: string             // 一句话总结
  artifact?: string           // 产出文件
  feedback?: string           // blocked 时的反馈
}
```

**vs 当前实现：**
- ✅ 已有: instance_id, role, status, summary, artifact
- 🔴 缺失: from_role, task 结构化, timeout, constraints
- 🟡 改进: `role` → 加 enum

---

## 🔧 OpenCode 机制：Hook 系统详解 (46+ Hooks)

> **参考：** `learn-opencode/docs/5-advanced/12c-hooks.md`

### Hook 的本质

> "Hook 是 OpenCode 的扩展接口 — 你可以在事件发生时执行逻辑，或在关键流程中拦截并修改数据。"

### 两种 Hook 类型

```
事件 Hook → 被动监听，不修改数据 → 日志 / 通知 / 审计
功能 Hook → 主动拦截，可修改数据 → 参数改写 / 权限控制 / 工具拦截
```

### 10 个最重要的 Hook

| Hook | 触发时机 | 能做什么 | Muse 的对应 |
|------|---------|---------|-----------|
| `event` | 所有事件 | 日志/通知 | Muse Plugin event-logger ✅ |
| `tool.execute.before` | 工具执行前 | **拦截/修改参数** | Muse Plugin tool-audit ✅ |
| `tool.execute.after` | 工具执行后 | 记录结果 | Muse Plugin event-logger ✅ |
| `chat.params` | LLM 调用前 | **修改 temperature** | Muse 没有 🔴 |
| `permission.ask` | 权限请求 | **自动批准/拒绝** | S3 审批 的基础！ |
| `tool.definition` | 工具注册 | **修改工具描述** | ACI 改进的途径！ |
| `session.compacting` | 上下文压缩 | 注入关键信息 | Muse 需要！|
| `shell.env` | Shell 执行前 | 注入环境变量 | Muse start.sh ✅ |
| `session.idle` | 会话完成 | 发通知 | Muse 的 callback |
| `chat.message` | 消息接收 | 记录/修改 | Muse system-prompt hook ✅ |

### 对 Muse 最有价值的 3 个 Hook 启发

**1. `permission.ask` → 这就是 S3 的实现基础！**
```typescript
// OpenCode 的做法
"permission.ask": async (input, output) => {
  if (input.tool === "bash" && input.metadata?.command.includes("rm -rf")) {
    output.status = "deny"  // 自动拒绝危险命令
    return
  }
  output.status = "ask"  // 其他情况问人
}
```

**2. `tool.definition` → 可以动态改 ACI！**
```typescript
// 不用改源码就能改工具描述
"tool.definition": async (input, output) => {
  if (input.toolID === "handoff_to_member") {
    output.description += "\n\n注意: role 参数只能是 pua/arch/coder/reviewer"
  }
}
```

**3. `chat.params` → 不同角色用不同 temperature**
```typescript
// Muse 可以让 Planner 更有创意，Coder 更确定性
"chat.params": async (input, output) => {
  if (input.agent === "planner") output.temperature = 0.7
  if (input.agent === "coder") output.temperature = 0.1
}
```

---

## ✏️ Step 3: 沉淀

### 吸收检验

1. Swarm 的 Agent 只有几个属性？(instructions + functions + name + model)
2. Swarm 的 Handoff 怎么实现？(函数返回 Agent 对象)
3. OpenCode 的 Hook 分几种？(事件 Hook 被动 + 功能 Hook 主动)
4. Muse S3 审批最像 OpenCode 的哪个 Hook？(`permission.ask`)

---

*Day 04 完成于 Sprint 1 · 2026-03-28*
