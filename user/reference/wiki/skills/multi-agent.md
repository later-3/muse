# Multi-Agent 编排

> **一句话定义**: Multi-Agent 是多个 Agent 各自拥有独立的指令、工具和上下文窗口，通过通信协议协作完成复杂任务的模式。

## 核心原理

### 为什么需要 Multi-Agent？

单 Agent 在三种场景下会遇到瓶颈（ai-agents-for-beginners L08）：

| 场景 | 问题 | Multi-Agent 方案 |
|------|------|-----------------|
| **大工作量** | 任务太多，一个 Agent 处理不完 | 并行分配给多个 Agent |
| **高复杂度** | 子任务需要不同专业能力 | 每个 Agent 专注一个领域 |
| **多样专长** | 单一 prompt 无法覆盖所有领域知识 | 每个 Agent 有独立 instructions |

**核心优势**：
- **专业化** — 每个 Agent 只做一件事，做到极致
- **可扩展** — 加 Agent 而不是加工具
- **容错性** — 一个 Agent 失败不影响其他

### 三种编排模式

#### 1. Handoff 模式 (Swarm)

最轻量的 Multi-Agent 实现 — **返回 Agent 对象即完成交接**：

```python
sales_agent = Agent(name="Sales Agent")

def transfer_to_sales():
    return sales_agent  # 返回 Agent = 控制权转移

agent_a = Agent(functions=[transfer_to_sales])
```

**Swarm 的运行循环**：
```
1. Get completion from current Agent
2. Execute tool calls
3. Switch Agent if necessary (handoff)
4. Update context_variables
5. If no new function calls → return
```

**关键设计**：
- Agent 切换时，system prompt 变为新 Agent 的 instructions
- Chat history 保留（上下文不丢失）
- 完全无状态 — 每次 `client.run()` 都从头开始

#### 2. Team 模式 (learn-claude-code s09)

有状态的多 Agent 协作 — **持久化 Agent + 异步消息总线**：

```
Teammate lifecycle:
  spawn -> WORKING -> IDLE -> WORKING -> ... -> SHUTDOWN

Communication:
  .team/
    config.json         ← team roster + statuses
    inbox/
      alice.jsonl       ← append-only, drain-on-read
      bob.jsonl
      lead.jsonl
```

**核心机制**：
- **TeammateManager** 维护团队花名册 (config.json)
- **MessageBus** 基于 JSONL 文件的异步消息传递
  - `send()` → 追加 JSON 行到收件人的 inbox
  - `read_inbox()` → 读取所有消息并清空
- 每个 Teammate 在独立线程中运行自己的 agent loop
- Teammate 每次 LLM 调用前先检查 inbox

```python
def _teammate_loop(self, name, role, prompt):
    messages = [{"role": "user", "content": prompt}]
    for _ in range(50):
        inbox = BUS.read_inbox(name)  # 检查消息
        if inbox != "[]":
            messages.append({"role": "user",
                "content": f"<inbox>{inbox}</inbox>"})
        response = client.messages.create(...)
        if response.stop_reason != "tool_use":
            break
        # execute tools...
    self._find_member(name)["status"] = "idle"
```

#### 3. 协议模式 (learn-claude-code s10)

在 Team 基础上增加 **结构化协商协议**：

```
Shutdown Protocol            Plan Approval Protocol
==================           ======================
Lead             Teammate    Teammate           Lead
  |--shutdown_req-->|           |--plan_req------>|
  | {req_id:"abc"}  |           | {req_id:"xyz"}  |
  |<--shutdown_resp-|           |<--plan_resp-----|
  | {req_id:"abc",  |           | {req_id:"xyz",  |
  |  approve:true}  |           |  approve:true}  |
```

**共享有限状态机**：
```
[pending] --approve--> [approved]
[pending] --reject---> [rejected]
```

**关键创新**：`request_id` 关联机制 — 使异步消息有了因果追踪能力。

### Multi-Agent 的建筑构件

| 构件 | 定义 | 来源 |
|------|------|------|
| **Agent Communication** | Agent 间信息共享的协议 | ai-agents L08 |
| **Coordination Mechanisms** | 协调行动以满足约束的机制 | ai-agents L08 |
| **Agent Architecture** | Agent 内部决策和学习结构 | ai-agents L08 |
| **Visibility** | 观测多 Agent 交互的能力 | ai-agents L08 |
| **Human in the Loop** | 何时请求人类干预 | ai-agents L08 |
| **Message Bus** | 异步消息传递通道 | learn-claude-code s09 |
| **Protocol FSM** | 请求-响应状态机 | learn-claude-code s10 |

### Multi-Agent 模式对比

| 模式 | 通信 | 状态 | 适用场景 |
|------|------|------|---------|
| **Handoff (Swarm)** | 同步，控制权转移 | 无状态 | 客服路由、简单分工 |
| **Team (s09)** | 异步 JSONL 邮箱 | 有状态 | 长期协作、并行开发 |
| **Protocol (s10)** | 请求-响应握手 | 有状态 + FSM | 需要审批/确认的流程 |
| **Group Chat** | 广播到群组 | 对话历史 | 头脑风暴、协作讨论 |
| **Pipeline** | 顺序传递 | 中间结果 | 数据处理、工作流 |

## 来源覆盖

| 来源 | 章节/位置 | 覆盖深度 | 关键贡献 |
|------|----------|---------|---------|
| [learn-claude-code](../../repos/learn-claude-code/docs/en/s09-agent-teams.md) | s09: Agent Teams | ⭐⭐⭐ | Team 模式完整实现 |
| [learn-claude-code](../../repos/learn-claude-code/docs/en/s10-team-protocols.md) | s10: Team Protocols | ⭐⭐⭐ | 协议 FSM + request_id 关联 |
| [ai-agents-for-beginners](../../repos/ai-agents-for-beginners/08-multi-agent/README.md) | L08: Multi-Agent | ⭐⭐⭐ | 建筑构件 + 模式分类 |
| [swarm](../../repos/swarm/README.md) | 完整 README | ⭐⭐⭐ | Handoff 模式 + 极简实现 |
| [hello-agents](../../repos/hello-agents/docs/chapter10/) | 第十章: 通信协议 | ⭐⭐ | MCP / A2A / ANP 协议 |

## 关键代码片段

### Handoff 的极简实现 (Swarm)
```python
agent_a = Agent(
    name="Agent A",
    instructions="You are a helpful agent.",
    functions=[transfer_to_agent_b],  # 返回 Agent = handoff
)
agent_b = Agent(
    name="Agent B",
    instructions="Only speak in Haikus.",
)
response = client.run(agent=agent_a, messages=[...])
# client.run 内部自动处理 Agent 切换
```

### Message Bus 的核心实现 (learn-claude-code s09)
```python
class MessageBus:
    def send(self, sender, to, content, msg_type="message"):
        msg = {"type": msg_type, "from": sender,
               "content": content, "timestamp": time.time()}
        with open(self.dir / f"{to}.jsonl", "a") as f:
            f.write(json.dumps(msg) + "\n")

    def read_inbox(self, name):
        path = self.dir / f"{name}.jsonl"
        msgs = [json.loads(l) for l in path.read_text().strip().splitlines()]
        path.write_text("")  # drain on read
        return json.dumps(msgs, indent=2)
```

## 概念间关系

- **前置概念**: [[agent-definition]] (理解单 Agent 循环) → [[tool-use-mcp]] (Agent 的能力扩展)
- **后续概念**: [[context-engineering]] (多 Agent 的上下文隔离) / [[memory]] (跨 Agent 的记忆共享)
- **相关概念**: [[prompt-engineering]] (每个 Agent 有独立的 instructions)
- **高阶实践**: [[agentic-protocols]] (不同框架的 Multi-Agent 协议对比)

## Muse 对应实践

| Muse 组件 | 对应概念 | 实现状态 |
|-----------|---------|---------|
| `src/core/orchestrator/` | Planner-Executor 模式 | ✅ 已实现 |
| `notify_planner` | 异步回调 (类似 MessageBus) | ✅ 已实现 |
| Telegram + OpenCode | 多通道 Multi-Agent | ✅ 已实现 |
| `src/daemon/cerebellum/` | 后台自主 Agent | ✅ 已实现 |
| Team protocols | 请求-响应协议 | ❌ 待实现 |
| Sisyphus (OpenCode) | 高级编排协议 | 📚 参考实现 |

## 开放问题

1. **Token 成本**：每个 Agent 有独立上下文窗口 → N 个 Agent = N 倍 token 消耗。如何优化共享上下文？
2. **死锁和活锁**：Agent 间消息循环可能导致无限来回。如何设置 max_turns / timeout？
3. **观测性**：如何实时可视化多 Agent 的交互流？Muse 的 Web Cockpit 可以做这个
4. **一致性**：多个 Agent 并发修改同一资源（文件、数据库）时如何保证一致性？
