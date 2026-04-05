# 可观测性与评估

> **一句话定义**: 可观测性 (Observability) 让 Agent 从"黑盒"变成"玻璃盒"——追踪每一步决策、每次工具调用、每个 token 消耗，配合系统评估以实现持续改进。

## 核心原理

### 为什么 Agent 需要可观测性

ai-agents-for-beginners L10 总结了四个核心理由：

| 理由 | 说明 |
|------|------|
| **调试与根因分析** | Agent 失败时定位问题源：是 prompt 问题、工具失败、还是模型幻觉？ |
| **延迟与成本管理** | 精确追踪每次 LLM 调用的 token 消耗和延迟 |
| **信任、安全与合规** | 提供 Agent 行为的审计轨迹，检测 prompt 注入和 PII 泄露 |
| **持续改进循环** | 线上数据反馈 → 离线测试集更新 → Agent 迭代 |

### Trace 与 Span

Agent 运行的标准表示方式（OpenTelemetry 标准）：

```
Trace (一次完整任务)
├── Span: user_message_received    (1ms)
├── Span: llm_call_1               (800ms, 500 tokens)
│   └── Span: tool_call: search    (200ms)
├── Span: llm_call_2               (600ms, 300 tokens)
│   └── Span: tool_call: write     (50ms)
└── Span: response_sent            (1ms)
    Total: 1.6s, 800 tokens, $0.002
```

**工具支持**：Langfuse、Microsoft Foundry 等平台将 Agent 运行表示为 trace tree。

### 代码级 Instrumentation

两种方式添加可观测性：

**自动化 (框架集成)**：
```python
from agent_framework.observability import get_tracer, get_meter
tracer = get_tracer()
meter = get_meter()
with tracer.start_as_current_span("agent_run"):
    # Agent 执行自动被追踪
    pass
```

**手动 Span 创建**：
```python
from langfuse import get_client
langfuse = get_client()
span = langfuse.start_span(name="my-span")
# ... 自定义业务逻辑 ...
span.end()
```

手动 Span 允许附加自定义属性（user_id, session_id, model_version），对调试至关重要。

### 关键指标

| 指标 | 说明 | 监控策略 |
|------|------|---------|
| **延迟** | 总响应时间 + 各 Span 耗时 | 告警阈值 + 模型切换策略 |
| **成本** | token 消耗 × 单价 | 预算告警 + 路由优化 |
| **错误率** | API 错误 / 工具失败次数 | fallback 机制 + 重试 |
| **用户显式反馈** | 👍/👎, ⭐评分, 文本评论 | 持续负面反馈 → 告警 |
| **用户隐式反馈** | 重问率、重试次数、重新表述 | 高重问率 = Agent 不好用 |
| **准确性** | 任务完成率 / 答案正确率 | 自动化评估 + LLM-as-judge |

### 评估体系

两类评估相辅相成：

**离线评估 (Offline)**
- 使用标准测试集（已知正确答案）
- 开发阶段 + CI/CD 管线
- 优势：可重复、有 ground truth
- 风险：测试集过时
- 实践：小型 smoke test + 大型评估集组合

**在线评估 (Online)**
- 监控真实用户交互
- 收集隐式/显式反馈
- A/B 测试新旧版本
- 优势：捕捉意外场景和 model drift
- 风险：标注困难

**持续改进循环**：
```
离线评估 → 部署 → 在线监控 → 收集失败案例
    ↑                              ↓
    ← 加入离线测试集 ← 分析 ←──────┘
```

### 成本控制策略

| 策略 | 实现方式 |
|------|---------|
| **分层模型 (SLM)** | 简单任务用小模型，复杂推理用大模型 |
| **Router 路由** | 用便宜模型/函数判断复杂度，路由到合适模型 |
| **缓存响应** | 识别相似请求，直接返回缓存结果 |
| **限制并发** | 防止攻击或 bug 导致的无限 API 循环 |

### 安全与信任 (L06)

ai-agents-for-beginners L06 定义了五类威胁：

| 威胁 | 攻击方式 | 缓解措施 |
|------|---------|---------|
| **指令篡改** | Prompt injection 修改 Agent 目标 | 输入过滤 + 对话轮次限制 |
| **关键系统访问** | 通过 Agent 间接访问敏感系统 | 最小权限 + 认证 + 加密通信 |
| **资源过载** | 通过 Agent 大量请求后端服务 | 请求频率限制 |
| **知识库投毒** | 污染 RAG 数据源 | 定期数据审计 + 访问控制 |
| **级联故障** | 一个工具失败导致连锁崩溃 | 沙箱隔离 + fallback + 重试 |

**Human-in-the-Loop** — 关键缓解模式：
```python
response = provider.create_response(
    input="执行敏感操作",
    instructions="Ask for user approval before finalizing.",
)
user_input = input("Do you approve? (APPROVE/REJECT): ")
```

### 常见生产问题速查

| 问题 | 解决方案 |
|------|---------|
| Agent 行为不一致 | 细化 prompt + 拆分子任务 |
| Agent 陷入循环 | 明确终止条件 + 最大轮数限制 |
| 工具调用失败 | 独立测试工具 + 优化工具描述 |
| 多 Agent 不协调 | 每个 Agent 的 prompt 明确且不重叠 |

## 来源覆盖

| 来源 | 章节 | 覆盖深度 | 关键贡献 |
|------|------|---------|---------|
| [ai-agents-for-beginners](../repos/ai-agents-for-beginners/10-ai-agents-production/) | L10: Production | ⭐⭐⭐ | Trace/Span + 评估 + 成本控制 |
| [ai-agents-for-beginners](../repos/ai-agents-for-beginners/06-building-trustworthy-agents/) | L06: Trustworthy | ⭐⭐⭐ | 五类威胁 + Human-in-the-Loop |
| [learn-claude-code](../repos/learn-claude-code/) | s08 Background | ⭐ | 后台结果注入 = 事件追踪模式 |

## 概念间关系

- **前置概念**: [[agent-definition]] / [[tool-use-mcp]] (被观测的对象)
- **相关概念**: [[harness-architecture]] (Harness 层提供 instrumentation 点)
- **下游概念**: [[identity-persona]] (行为监控需要明确 Agent 边界)

## 开放问题

1. **评估基准**：Agent 的"正确性"没有统一标准。如何为特定领域设计评估 benchmark？
2. **可观测性开销**：详细 tracing 本身消耗性能和存储。如何在信息量和开销之间取平衡？
3. **隐私**：trace 中包含用户对话内容。如何在保持可观测性的同时保护隐私？
4. **自动评估可靠性**：LLM-as-judge 的一致性如何保证？评估模型本身的偏见怎么办？
