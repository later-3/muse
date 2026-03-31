# s06: Context Compact — 三层压缩策略

> **一句话:** LLM 上下文窗口有限，用三层压缩让 Agent 能"无限"对话
> **源码:** `reference/repos/learn-claude-code/agents/s06_context_compact.py` (255 行)
> **Muse 对应:** OpenCode 内部 compaction 机制

---

## 核心代码 (50 行)

```python
THRESHOLD = 50000   # token 阈值
KEEP_RECENT = 3     # 保留最近 3 个工具结果
PRESERVE_RESULT_TOOLS = {"read_file"}  # 读文件结果永远保留

# ═══ Layer 1: micro_compact ═══ (每轮静默执行)
# 把旧的工具结果替换成占位符，节省 token
def micro_compact(messages: list) -> list:
    # 找到所有 tool_result
    tool_results = [(msg_idx, part_idx, part) for ...]
    
    # 保留最近 3 个，其余替换
    to_clear = tool_results[:-KEEP_RECENT]
    for _, _, result in to_clear:
        tool_name = tool_name_map.get(result["tool_use_id"], "unknown")
        if tool_name in PRESERVE_RESULT_TOOLS:  # read_file 不压!
            continue
        result["content"] = f"[Previous: used {tool_name}]"  # ← 替换
    return messages

# ═══ Layer 2: auto_compact ═══ (超阈值自动触发)
# 整个对话存档 → LLM 总结 → 替换全部历史
def auto_compact(messages: list) -> list:
    # 存档到 .transcripts/ (不丢数据)
    with open(transcript_path, "w") as f:
        for msg in messages:
            f.write(json.dumps(msg) + "\n")
    
    # 让 LLM 自己总结
    response = client.messages.create(
        messages=[{"role": "user", "content": 
            "Summarize this conversation: 1) accomplished, "
            "2) current state, 3) key decisions\n\n" + text}],
    )
    summary = response.content[0].text
    
    # 替换全部历史 → 只剩一条
    return [{"role": "user", "content": 
             f"[Compressed. Transcript: {path}]\n\n{summary}"}]

# ═══ Layer 3: compact 工具 ═══ (模型主动触发)
# 模型调 compact 工具 → 立即执行 auto_compact
TOOLS = [..., 
    {"name": "compact", 
     "description": "Trigger manual conversation compression."}]

# 在 agent_loop 里:
def agent_loop(messages):
    while True:
        micro_compact(messages)                    # ← Layer 1: 每轮
        if estimate_tokens(messages) > THRESHOLD:  # ← Layer 2: 超限
            messages[:] = auto_compact(messages)
        # ... 正常 loop ...
        if manual_compact:                         # ← Layer 3: 手动
            messages[:] = auto_compact(messages)
```

## 架构图

```
每一轮 LLM 调用:

  messages ──→ [Layer 1: micro_compact]
                  │ 把旧 tool_result 替换成一行占位符
                  │ 保留 read_file 结果 (因为是参考材料)
                  ▼
             token > 50000?
              │           │
             no          yes
              │           │
              ▼           ▼
           正常调      [Layer 2: auto_compact]
            LLM           │ 存档到 .transcripts/
                          │ LLM 总结对话
                          │ 替换全部 messages → 1 条
                          ▼
                       继续工作
                          
  模型也可以主动调 compact 工具 → [Layer 3]
```

## 关键洞察

| 概念 | 说明 |
|------|------|
| **三层递进** | micro(每轮静默) → auto(超限) → manual(主动)，越来越激进 |
| **read_file 豁免** | 文件内容是参考材料，压缩了就要重读，不如保留 |
| **存档不丢** | auto_compact 前先存 JSONL 到磁盘，可以回溯 |
| **LLM 自己总结** | 不用人工写规则，让模型决定保留什么 |
| **4 chars ≈ 1 token** | `estimate_tokens = len(str(messages)) // 4` 粗略但够用 |

## Muse 映射

| learn-claude-code | Muse/OpenCode |
|-------------------|---------------|
| Layer 1 micro_compact | OpenCode 的 preemptive compaction |
| Layer 2 auto_compact (50k) | OpenCode 达到模型 context limit 时 compact |
| Layer 3 compact 工具 | OpenCode `/compact` 命令 |
| `.transcripts/` 存档 | OpenCode session 历史 |
| `estimate_tokens()` | OpenCode 精确 token 计数 |

> **关键差异:** 他们手写三层压缩，OpenCode 内置了更精确的实现

## 面试能讲

> **Q: AI Agent 如何处理超长对话？**
> 
> A: 核心是分层压缩。我研究了 Claude Code 的实现：三层策略 — 第一层每轮静默替换旧工具结果为占位符 (但保留 read_file 因为是参考材料)；第二层超过 50k token 时，存档完整对话到磁盘，然后让 LLM 自己总结對话，只保留一条摘要消息；第三层是模型可以主动调 compact 工具。关键设计是"存档不丢" — 压缩前把完整对话写到 JSONL 文件，保证可回溯。OpenCode 也有类似机制，只是阈值和计算方式不同。
