# Swarm 源码走读 + Handoff 机制 + OpenCode Hook 系统

> **来源：** [G6] `repos/swarm/swarm/core.py` (~100 行核心代码)
> **补充：** OpenCode 46+ Hook 机制 + Muse Handoff 协议草案
> **上游：** 02a Orchestrator-Workers（先理解高级编排模式）
> **下游：** 02c Agent 评估 → unit03 状态+记忆
> **OC 关联：** oc14 (Cline 拆解) / oc15 (Muse Harness 审计)

---

## ⚡ 3 分钟速读版

```
一句话: Swarm 核心只有 ~100 行 Python，Handoff = 工具函数返回 Agent 对象
4 个设计决策: Handoff=返回Agent / Agent=2属性 / 共享context_variables / 无状态机
Muse vs Swarm: 进程模型(多进程 vs 单进程) + 通信(MCP vs 共享变量) + 状态(有 vs 无)
OpenCode Hook: 事件Hook(被动监听) + 功能Hook(主动拦截)，最重要3个: permission.ask / tool.definition / chat.params
```

---

## §1 Swarm 的核心：`run()` 循环

> **仓库位置：** `repos/swarm/swarm/core.py`
> **设计哲学：** 教育性质的框架 — 不适合生产，但设计思想极其精炼

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
                
                history.append(tool_result_message(result))
        
        return Response(messages=history, agent=active_agent)
```

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

**instructions 可以是函数！** Prompt 可以动态生成：

```python
def dynamic_instructions(context_variables):
    user_name = context_variables.get("user_name", "用户")
    return f"你是 {user_name} 的私人助理，语气要友好。"

agent = Agent(name="助理", instructions=dynamic_instructions)
```

### Handoff 实现的极简性

```python
# 一个完整的 Handoff 工具。没了。
def transfer_to_billing():
    """转交给账单专家"""
    return billing_agent

triage_agent = Agent(
    name="分诊",
    functions=[transfer_to_billing, transfer_to_tech],
)
```

---

## §2 Swarm 的 4 个核心设计决策

| 决策 | 具体实现 | 为什么这样设计 |
|------|---------|-------------|
| **Handoff = 返回 Agent** | `return billing_agent` | 不需要额外协议，函数返回值就是一切 |
| **Agent = instructions + functions** | 两个属性就够了 | 最小化 Agent 定义，没有多余抽象 |
| **上下文通过 `context_variables` 传递** | 字典在所有 Agent 间共享 | 避免了复杂的消息传递协议 |
| **没有 DAG / Graph** | 纯粹的循环 | "Routines and handoffs" — 不需要状态机 |

---

## §3 Muse vs Swarm 对比

| 维度 | Swarm | Muse |
|------|-------|------|
| **Agent 定义** | Python 类 (2 属性) | AGENTS.md + config.json |
| **Handoff 方式** | 函数返回 Agent | MCP tool → HTTP POST |
| **通信协议** | 共享 context_variables | MCP notify_planner |
| **Agent 发现** | 代码导入 | Family Registry |
| **状态管理** | 无 (stateless) | Workflow 状态机 |
| **进程模型** | 单进程 | 多进程 (OpenCode 实例) |

**Muse 可以借鉴的 3 点：**
1. **instructions 可以是函数** → Muse 的 prompt 也可以根据 context 动态注入
2. **context_variables 共享** → Muse 的 workflow context 就是这个概念
3. **极简思想** → Muse 的 Handoff 协议不需要太复杂

### Muse Handoff 协议草案

```typescript
interface HandoffRequest {
  instance_id: string         // 工作流实例 ID
  from_role: string           // 谁发起的 handoff
  to_role: string             // 分派给谁
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
  summary: string
  artifact?: string
  feedback?: string           // blocked 时的反馈
}
```

---

## §4 OpenCode Hook 系统 (46+ Hooks)

### 两种 Hook 类型

```
事件 Hook → 被动监听，不修改数据 → 日志 / 通知 / 审计
功能 Hook → 主动拦截，可修改数据 → 参数改写 / 权限控制 / 工具拦截
```

### 10 个最重要的 Hook

| Hook | 触发时机 | 能做什么 | Muse 对应 |
|------|---------|---------|---------| 
| `event` | 所有事件 | 日志/通知 | Muse Plugin event-logger ✅ |
| `tool.execute.before` | 工具执行前 | **拦截/修改参数** | Muse Plugin tool-audit ✅ |
| `tool.execute.after` | 工具执行后 | 记录结果 | Muse Plugin event-logger ✅ |
| `chat.params` | LLM 调用前 | **修改 temperature** | Muse 没有 🔴 |
| `permission.ask` | 权限请求 | **自动批准/拒绝** | S3 审批的基础！ |
| `tool.definition` | 工具注册 | **修改工具描述** | ACI 改进的途径！ |
| `session.compacting` | 上下文压缩 | 注入关键信息 | Muse 需要！|
| `shell.env` | Shell 执行前 | 注入环境变量 | Muse start.sh ✅ |
| `session.idle` | 会话完成 | 发通知 | Muse 的 callback |
| `chat.message` | 消息接收 | 记录/修改 | Muse system-prompt hook ✅ |

### 对 Muse 最有价值的 3 个 Hook

**1. `permission.ask` → S3 审批基础**
```typescript
"permission.ask": async (input, output) => {
  if (input.tool === "bash" && input.metadata?.command.includes("rm -rf")) {
    output.status = "deny"  // 自动拒绝危险命令
  }
}
```

**2. `tool.definition` → 动态改 ACI**
```typescript
"tool.definition": async (input, output) => {
  if (input.toolID === "handoff_to_member") {
    output.description += "\n\n注意: role 参数只能是 pua/arch/coder/reviewer"
  }
}
```

**3. `chat.params` → 不同角色不同 temperature**
```typescript
"chat.params": async (input, output) => {
  if (input.agent === "planner") output.temperature = 0.7
  if (input.agent === "coder") output.temperature = 0.1
}
```

---

## §5 💼 面试必答

1. **Swarm 的 Agent 只有几个属性？** → instructions + functions + name + model
2. **Swarm 的 Handoff 怎么实现？** → 函数返回 Agent 对象
3. **OpenCode 的 Hook 分几种？** → 事件 Hook 被动 + 功能 Hook 主动
4. **Muse S3 审批最像 OpenCode 的哪个 Hook？** → `permission.ask`

---

## §6 ✅ 自检题

- [ ] 能写出 Swarm run() 循环的伪代码
- [ ] 能说出 Muse vs Swarm 的 6 个维度差异
- [ ] 能解释 permission.ask Hook 如何实现 S3 审批

---

*内容合并自 Day04 Swarm走读 + Handoff设计 + OpenCode Hook*
*→ 接下来读 [02c: Agent 评估](./02c-agent-evaluation.md)*
