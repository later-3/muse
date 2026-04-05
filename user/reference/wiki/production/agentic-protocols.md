# Agentic Protocols

> **一句话定义**: Agentic Protocols (如 MCP 和 A2A) 是让 Agent 之间、Agent 与工具之间实现标准化通信的协议层——解决的是"不同厂商的 Agent 怎么互操作"的问题。

## 核心原理

### 为什么需要协议标准

没有协议标准，每个 Agent 框架都用自己的方式连接工具和其他 Agent，导致：
- 工具需要为每个框架写不同的接口
- Agent 之间无法跨框架通信
- 集成成本随 N×M 增长（N 个 Agent 框架 × M 个工具）

### MCP (Model Context Protocol)

MCP 是 Anthropic 提出的开放协议，定义了 Agent 与工具/资源之间的标准接口：

```
Agent (MCP Client)          MCP Server
+------------------+        +------------------+
| 需要调用工具      | ----→  | 暴露工具能力      |
| 需要读取资源      | ----→  | 提供资源内容      |
| 需要 prompt 模板  | ----→  | 提供标准 prompt   |
+------------------+        +------------------+

MCP 传输层: stdio | HTTP+SSE
```

**MCP 的三个核心能力**：

| 能力 | 说明 | 示例 |
|------|------|------|
| **Tools** | Agent 可调用的函数 | 搜索、文件读写、数据库查询 |
| **Resources** | Agent 可读取的数据 | 文件内容、API 响应、配置 |
| **Prompts** | 预定义的 prompt 模板 | 代码审查模板、翻译模板 |

**与 Tool Use 的关系**：MCP 不替代 [[tool-use-mcp]] 中的 dispatch map，而是在其上加了一层标准化协议。一个 MCP Server 可以暴露多个工具，任何支持 MCP 的 Agent 都可以使用。

### A2A (Agent-to-Agent Protocol)

Google 提出的 Agent 间通信协议，解决多 Agent 协作的互操作性：

```
Agent A (A2A Client)         Agent B (A2A Server)
+------------------+         +------------------+
| "帮我查航班"      | ──Task要求──→ | 处理查询          |
|                  | ←──状态更新── | 返回结果          |
|                  | ←──Artifact── | 结构化数据        |
+------------------+         +------------------+
```

**A2A vs MCP**：

| 维度 | MCP | A2A |
|------|-----|-----|
| **通信方向** | Agent ↔ Tool | Agent ↔ Agent |
| **协议焦点** | 工具发现与调用 | 任务委托与协作 |
| **核心单元** | Tool / Resource / Prompt | Task / Artifact / Message |
| **比喻** | USB 接口标准 | 公司间合同标准 |
| **互补关系** | Agent 获取能力 | Agent 分配任务 |

### learn-claude-code 的 Team Protocols (s10)

s10 定义了一种轻量级但严密的 Agent 间协议：

```python
# 协议请求格式
{
    "type": "request",
    "request_id": "req_abc123",
    "from": "agent_A",
    "to": "agent_B",
    "action": "shutdown",
    "params": {"reason": "task_complete"}
}

# 协议响应格式
{
    "type": "response",
    "request_id": "req_abc123",  # 关联原始请求
    "from": "agent_B",
    "status": "approved",        # approved | rejected | pending
    "result": {}
}
```

**FSM (有限状态机) 保证协议正确性**：
```
idle → request_sent → response_received → idle
                   ↓ timeout
              → error_recovery → idle
```

### Swarm 的 Handoff 协议

OpenAI Swarm 定义了最简洁的 Agent 间切换协议：

```python
# Handoff = 函数返回另一个 Agent
def transfer_to_triage():
    """Transfer to triage agent"""
    return triage_agent

# 在 Agent 的 functions 列表中声明
sales_agent = Agent(
    name="Sales",
    functions=[transfer_to_triage, transfer_to_refund]
)
```

**Handoff 的核心**：Agent 切换就是函数调用的返回值，没有额外的协议开销。

### 协议层的选择指南

| 场景 | 推荐协议 | 理由 |
|------|---------|------|
| 单 Agent + 多工具 | MCP | 工具标准化接口 |
| Agent 间简单切换 | Swarm Handoff | 最低开销 |
| Agent 间结构化协作 | s10 Team Protocol | FSM 保证正确性 |
| 跨框架 Agent 协作 | A2A | 行业互操作标准 |
| 需要人类审批的流程 | Human-in-the-Loop | 安全关键任务 |

## 来源覆盖

| 来源 | 章节 | 覆盖深度 | 关键贡献 |
|------|------|---------|---------|
| [ai-agents-for-beginners](../repos/ai-agents-for-beginners/11-agentic-protocols/) | L11: Protocols | ⭐⭐⭐ | MCP + A2A 协议对比 |
| [learn-claude-code](../repos/learn-claude-code/docs/en/s10-team-protocols.md) | s10: Team Protocols | ⭐⭐⭐ | FSM + request_id 协议 |
| [swarm](../repos/swarm/) | README | ⭐⭐ | Handoff 最简协议 |
| [anthropic-cookbook](../repos/anthropic-cookbook/) | MCP 示例 | ⭐ | MCP 实际用例 |

## 概念间关系

- **前置概念**: [[tool-use-mcp]] (MCP 是 Tool Use 的标准化) / [[multi-agent]] (协议支撑多 Agent)
- **相关概念**: [[harness-architecture]] (s10 协议是 Harness 层的一部分)
- **安全概念**: [[observability]] (协议消息提供审计轨迹)

## 开放问题

1. **协议碎片化**：MCP (Anthropic) vs A2A (Google) vs Swarm (OpenAI)，行业能统一吗？
2. **协议开销**：标准化协议引入的序列化/反序列化开销，对延迟敏感场景是否可接受？
3. **安全**：跨 Agent 协议如何防止中间人攻击和消息篡改？
4. **版本兼容**：协议升级时如何保持向后兼容？
