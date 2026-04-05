# Context Engineering

> **一句话定义**: Context Engineering 是管理 Agent 上下文窗口中动态信息流的系统性实践 — 确保 Agent 在正确的时间拥有正确的信息，同时不超出上下文窗口限制。

## 核心原理

### Prompt Engineering ≠ Context Engineering

| 维度 | Prompt Engineering | Context Engineering |
|------|-------------------|-------------------|
| **范围** | 单次静态指令 | 动态信息流管理 |
| **变化** | 一次写好，少量调优 | 每轮对话都在变化 |
| **目标** | 引导模型行为 | 确保模型有完成任务的信息 |
| **类比** | 写菜谱 | 管理厨房里的食材供应链 |

ai-agents-for-beginners L12 定义：
> "Context Engineering is the practice of making sure the AI Agent has the right information to complete the next step of the task."

### 上下文的五种类型

| 类型 | 定义 | 生命周期 |
|------|------|---------|
| **Instructions** | 规则 — system prompt + few-shot examples + tool descriptions | 整个会话 |
| **Knowledge** | 事实 — RAG 检索的文档、长期记忆 | 按需加载 |
| **Tools** | 工具定义 + 工具执行返回的结果 | 工具调用时 |
| **Conversation History** | 对话历史 — user/assistant 消息 | 持续增长 |
| **User Preferences** | 用户偏好 — 从多次交互中习得 | 跨会话 |

### 三层压缩策略

learn-claude-code s06 设计了渐进式压缩方案：

```
每个 turn:
[Layer 1: micro_compact]        (静默, 每轮执行)
  替换 >3 轮前的 tool_result
  为 "[Previous: used {tool_name}]"
        |
        v
[Check: tokens > 50000?]
   |               |
   no              yes
   |               |
   v               v
continue    [Layer 2: auto_compact]
              保存完整 transcript 到磁盘
              LLM 总结对话
              用 [summary] 替换所有消息
                    |
                    v
            [Layer 3: compact tool]
              模型主动调用 compact
              同样的总结流程
```

**核心代码**：

```python
def micro_compact(messages: list) -> list:
    """Layer 1: 静默替换旧的 tool 结果"""
    tool_results = []
    for i, msg in enumerate(messages):
        if msg["role"] == "user" and isinstance(msg.get("content"), list):
            for j, part in enumerate(msg["content"]):
                if isinstance(part, dict) and part.get("type") == "tool_result":
                    tool_results.append((i, j, part))
    if len(tool_results) <= KEEP_RECENT:
        return messages
    for _, _, part in tool_results[:-KEEP_RECENT]:
        if len(part.get("content", "")) > 100:
            part["content"] = f"[Previous: used {tool_name}]"
    return messages

def auto_compact(messages: list) -> list:
    """Layer 2: 超过阈值时保存 transcript + LLM 总结"""
    # 保存到磁盘 (不丢失任何信息)
    transcript_path = TRANSCRIPT_DIR / f"transcript_{int(time.time())}.jsonl"
    with open(transcript_path, "w") as f:
        for msg in messages:
            f.write(json.dumps(msg, default=str) + "\n")
    # LLM 总结
    response = client.messages.create(
        model=MODEL,
        messages=[{"role": "user", "content":
            "Summarize this conversation for continuity..."
            + json.dumps(messages, default=str)[:80000]}],
        max_tokens=2000,
    )
    return [
        {"role": "user", "content": f"[Compressed]\n\n{response.content[0].text}"},
    ]
```

**关键设计原则**：
- **信息不丢失** — transcript 保存到磁盘，只是从上下文窗口移出
- **渐进式** — Layer 1 最温和（替换旧结果），Layer 2 最激进（总结全部）
- **模型可控** — Layer 3 让模型自己决定何时压缩

### 上下文管理的六种策略

ai-agents-for-beginners L12 归纳的实用策略：

| 策略 | 定义 | 实现方式 |
|------|------|---------|
| **Agent Scratchpad** | 单次会话的临时笔记本 | 外部文件/运行时对象，非上下文窗口 |
| **Memories** | 跨会话持久化信息 | 向量数据库 / 知识图谱 |
| **Compressing Context** | 上下文窗口接近极限时压缩 | 总结 / 裁剪 / 只保留最新 |
| **Multi-Agent Systems** | 每个 Agent 独立上下文窗口 | 上下文隔离 + 选择性共享 |
| **Sandbox Environments** | 大量数据处理放沙箱 | 只读结果，不把过程放上下文 |
| **Runtime State Objects** | 复杂任务的状态容器 | 每个子任务步骤独立存储结果 |

### 四种上下文失败模式

| 失败模式 | 症状 | 解决方案 |
|---------|------|---------|
| **Context Poisoning** | 幻觉被反复引用 | 验证信息 + 隔离错误线程 |
| **Context Distraction** | 关注历史而非当前任务 | 定期总结 + 重置焦点 |
| **Context Confusion** | 工具太多，模型选错 | 动态工具加载（RAG over tools） |
| **Context Clash** | 矛盾信息共存 | 剪枝旧信息 + 离线 scratchpad |

## 来源覆盖

| 来源 | 章节/位置 | 覆盖深度 | 关键贡献 |
|------|----------|---------|---------|
| [learn-claude-code](../repos/learn-claude-code/docs/en/s06-context-compact.md) | s06: Context Compact | ⭐⭐⭐ | 三层压缩策略完整代码 |
| [ai-agents-for-beginners](../repos/ai-agents-for-beginners/12-context-engineering/README.md) | L12: Context Engineering | ⭐⭐⭐ | 概念定义 + 五类型 + 四失败模式 |
| [hello-agents](../repos/hello-agents/docs/chapter9/) | 第九章: 上下文工程 | ⭐⭐ | 中文视角的上下文理解 |
| [learn-claude-code](../repos/learn-claude-code/docs/en/s05-skill-loading.md) | s05: Skills | ⭐⭐ | 两层注入（system prompt vs tool_result） |
| OpenCode | context compaction | ⭐⭐ | 生产级压缩实现参考 |

## 概念间关系

- **前置概念**: [[prompt-engineering]] (静态指令 → 动态管理) / [[tool-use-mcp]] (工具结果是上下文的主要来源)
- **后续概念**: [[memory]] (跨会话的上下文持久化)
- **相关概念**: [[multi-agent]] (每个 Agent 的上下文如何隔离和共享)
- **实现参考**: OpenCode 的 preemptive compaction (后台压缩)

## Muse 对应实践

| Muse 组件 | 对应概念 | 实现状态 |
|-----------|---------|---------|
| OpenCode 集成 | Context compaction | ✅ 已实现（借助 OpenCode） |
| `src/core/memory/` | 跨会话记忆 | 🟡 基础实现 |
| MCP 工具结果管理 | Tool result lifecycle | ✅ 已实现 |
| Transcript 持久化 | 对话历史归档 | ❌ 待实现 |
| Runtime scratchpad | 任务级临时状态 | ❌ 待实现 |

## 开放问题

1. **最优压缩策略**：什么时候该用 micro_compact vs auto_compact？阈值 50000 tokens 是否适用于所有模型？
2. **信息恢复**：压缩后如果需要回溯怎么办？transcript 文件怎么高效检索？
3. **多模态上下文**：图片和文件占用大量 token，如何高效管理？
4. **上下文窗口的未来**：随着模型上下文窗口越来越大（1M+），压缩是否还必要？答案：是的，因为"更大 ≠ 更好" — context distraction 在大窗口中更严重
