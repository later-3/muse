# 来源注册表

> 追踪 wiki 文章与原始数据的对应关系。每个条目记录仓库的核心信息和在 wiki 中的覆盖情况。

## 仓库索引

### ⭐⭐⭐ 核心来源

| 仓库 | 作者/组织 | 语言 | 文件数 | Wiki 覆盖 |
|------|----------|------|--------|----------|
| **learn-claude-code** | Anthropic 社区 | EN | 10,487 | s01→agent-def / s02→tool-use / s05→prompt / s06→context / s09-10→multi-agent |
| **ai-agents-for-beginners** | Microsoft | EN | 4,744 | L01→agent-def / L04→tool-use / L08→multi-agent / L12→context / L13→memory |
| **LLMs-from-scratch** | Sebastian Raschka | EN | 259 | 📋 foundations/ (第二批) |
| **anthropic-cookbook** | Anthropic | EN | 206 | tool_use→tool-use / patterns→prompt / capabilities→memory |

### ⭐⭐ 重要来源

| 仓库 | 作者/组织 | 语言 | 文件数 | Wiki 覆盖 |
|------|----------|------|--------|----------|
| **hello-agents** | DataWhale | ZH | 655 | ch1→agent-def / ch8→memory / ch9→context / ch10→tool-use |
| **swarm** | OpenAI | EN | 70 | README→agent-def+tool-use+multi-agent |
| **Prompt-Engineering-Guide** | DAIR.AI | EN | 31 | 全书→prompt-engineering |
| **minbpe** | Karpathy | EN | 11 | 📋 foundations/tokenization (第二批) |
| **nanoGPT** | Karpathy | EN | 21 | 📋 foundations/transformer (第二批) |

### ⭐ 补充来源

| 仓库 | 作者/组织 | 语言 | 文件数 | Wiki 覆盖 |
|------|----------|------|--------|----------|
| **open-r1** | HuggingFace | EN | 44 | 📋 foundations/reasoning (第二批) |
| **huggingface-course** | HuggingFace | EN | 85 | 📋 foundations/ (第二批) |
| **introtodeeplearning** | MIT | EN | 38 | 📋 foundations/ (第二批) |
| **llm-agents-mooc** | UC Berkeley | EN | 2 | 📋 (大纲参考) |

## 验证项目（make-muse/reference/）

| 项目 | 角色 | Wiki 覆盖 |
|------|------|----------|
| **OpenCode** | Harness 层参考实现 | agent-def / tool-use / context (已引用) |
| **OpenClaw** | 个人 AI 助手参考 | 📋 production/ (第三批) |
| **ZeroClaw** | 轻量级运行时参考 | 📋 production/ (第三批) |

## 覆盖率矩阵

```
                 agent-def  tool-use  prompt  multi-agent  context  memory
learn-claude      ███        ███       ██      ███          ███      ░░
ai-agents         ███        ███       ██      ███          ███      ███
hello-agents      ███        ██        ░░      ░░           ██       ███
swarm             ██         ██        ██      ███          ░░       ░░
prompt-guide      ░░         ░░        ███     ░░           ░░       ░░
anthropic-cook    ██         ███       ██      ░░           ░░       █░

███ = 主要来源  ██ = 补充来源  ░░ = 未覆盖
```

## 来源映射明细

### learn-claude-code → wiki

| 来源章节 | Wiki 文章 | 提取内容 |
|---------|----------|---------|
| s01: The Agent Loop | [agent-definition](skills/agent-definition.md) | 30 行最简 Agent 实现 |
| s02: Tool Use | [tool-use-mcp](skills/tool-use-mcp.md) | dispatch map + safe_path |
| s05: Skills | [prompt-engineering](skills/prompt-engineering.md) | 两层 Prompt 架构 |
| s06: Context Compact | [context-engineering](skills/context-engineering.md) | 三层压缩策略 |
| s09: Agent Teams | [multi-agent](skills/multi-agent.md) | Team 模式 + MessageBus |
| s10: Team Protocols | [multi-agent](skills/multi-agent.md) | 协议 FSM + request_id |

### ai-agents-for-beginners → wiki

| 来源章节 | Wiki 文章 | 提取内容 |
|---------|----------|---------|
| L01: Intro | [agent-definition](skills/agent-definition.md) | 四组件模型 + 类型谱系 |
| L03: Design Principles | [prompt-engineering](skills/prompt-engineering.md) | 透明性/控制/一致性 |
| L04: Tool Use | [tool-use-mcp](skills/tool-use-mcp.md) | Function Calling 三要素 |
| L08: Multi-Agent | [multi-agent](skills/multi-agent.md) | 建筑构件 + 模式分类 |
| L12: Context | [context-engineering](skills/context-engineering.md) | 五类型 + 四失败模式 |
| L13: Memory | [memory](skills/memory.md) | 六类型 + 自改进模式 |
