# Prompt Engineering

> **一句话定义**: Prompt Engineering 是设计和优化输入给 LLM 的文本（指令、示例、约束），以引导模型产生期望行为的技术。它是 Context Engineering 的子集，聚焦于**静态指令层**。

## 核心原理

### Prompt 的分层架构

learn-claude-code s05 揭示了一个关键设计：**Prompt 不是单层的，而是分层加载的**。

```
Layer 1: System Prompt (always present, ~100 tokens per skill)
+--------------------------------------+
| You are a coding agent.              |
| Skills available:                    |
|   - git: Git workflow helpers        |
|   - test: Testing best practices     |
+--------------------------------------+

Layer 2: On-Demand Content (via tool_result, ~2000 tokens)
+--------------------------------------+
| <skill name="git">                   |
|   Full git workflow instructions...  |
|   Step 1: ...                        |
| </skill>                             |
+--------------------------------------+
```

**核心洞察**：
- Layer 1 放**名称和描述**（便宜） — 让模型知道什么技能可用
- Layer 2 放**完整内容**（按需） — 只在模型主动请求时加载
- 10 个 Skill × 2000 tokens = 20,000 tokens → 浪费！改成按需加载后只需 ~1000 tokens

### 六大 Prompt 技术

来自 Prompt-Engineering-Guide 的核心分类：

| 技术 | 定义 | 适用场景 |
|------|------|---------|
| **Zero-shot** | 直接给指令，不给示例 | 简单任务、强模型 |
| **Few-shot** | 给 2-5 个示例 | 格式化输出、分类 |
| **Chain-of-Thought (CoT)** | 要求模型"一步步思考" | 推理、数学、逻辑 |
| **ReAct** | 交替 Reasoning + Action | Agent 任务 |
| **Self-Consistency** | 多次采样取多数结果 | 提高准确性 |
| **Tree-of-Thought** | 探索多个推理路径 | 复杂规划 |

### System Prompt 的设计原则

综合多个来源的最佳实践：

**结构化**（ai-agents-for-beginners L03）：
```
Identity → Role → Constraints → Tools → Format
```

**透明性原则**：
1. 告知用户 AI 参与了
2. 说明 AI 如何工作（包括过去的行为）
3. 提供反馈和修改系统的途径

**控制权原则**：
1. 可定制化/个性化
2. 用户有偏好设置
3. 用户控制系统属性（包括"遗忘"的能力）

### Prompt 与 Agent 行为的关系

Swarm 的设计直接将 prompt 和 Agent 行为绑定：

```python
# instructions 直接成为 system prompt
agent = Agent(
    instructions="Only speak in Haikus."
)

# 动态 instructions — 根据上下文变化
def instructions(context_variables):
    user_name = context_variables["user_name"]
    return f"Help the user, {user_name}, do whatever they want."
```

**Swarm 的关键设计**：Agent 切换 = system prompt 切换。Handoff 时，新 Agent 的 instructions 替换旧的，但 chat history 保留。

### Skill 加载模式

learn-claude-code s05 的 Skill 系统是 Prompt Engineering 的高级应用：

```python
class SkillLoader:
    def __init__(self, skills_dir: Path):
        self.skills = {}
        for f in sorted(skills_dir.rglob("SKILL.md")):
            text = f.read_text()
            meta, body = self._parse_frontmatter(text)
            name = meta.get("name", f.parent.name)
            self.skills[name] = {"meta": meta, "body": body}
```

每个 Skill 是一个目录，包含 `SKILL.md`（YAML frontmatter + markdown 正文）：
```
skills/
  pdf/
    SKILL.md       # name: pdf / description: Process PDF files
  code-review/
    SKILL.md       # name: code-review / description: Review code
```

**本质**：把 Prompt 变成**可管理的文件系统资产**，而不是硬编码在代码中。

## 来源覆盖

| 来源 | 章节/位置 | 覆盖深度 | 关键贡献 |
|------|----------|---------|---------|
| [learn-claude-code](../repos/learn-claude-code/docs/en/s05-skill-loading.md) | s05: Skills | ⭐⭐⭐ | 两层 Prompt 架构 + Skill 文件系统 |
| [Prompt-Engineering-Guide](../repos/Prompt-Engineering-Guide/) | 全书 | ⭐⭐⭐ | 六大技术分类 + 完整参考 |
| [ai-agents-for-beginners](../repos/ai-agents-for-beginners/03-agentic-design-patterns/README.md) | L03: Design Principles | ⭐⭐ | 透明性/控制/一致性三原则 |
| [swarm](../repos/swarm/README.md) | README: Instructions | ⭐⭐ | 动态 instructions + handoff prompt 切换 |
| [anthropic-cookbook](../repos/anthropic-cookbook/patterns/) | patterns/ | ⭐⭐ | 生产级 prompt patterns |

## 关键代码片段

### 两层注入（learn-claude-code s05）
```python
# Layer 1: system prompt — 技能目录
SYSTEM = f"""You are a coding agent at {WORKDIR}.
Skills available:
{SKILL_LOADER.get_descriptions()}"""   # ~100 tokens/skill

# Layer 2: tool handler — 按需加载全文
TOOL_HANDLERS = {
    "load_skill": lambda **kw: SKILL_LOADER.get_content(kw["name"]),
}
# 模型调用 load_skill("git") → 2000 tokens 的完整指令注入为 tool_result
```

## 概念间关系

- **前置概念**: [[agent-definition]] (理解循环和消息流)
- **后续概念**: [[context-engineering]] (从静态 prompt 到动态上下文管理)
- **相关概念**: [[tool-use-mcp]] (工具描述也是 prompt 的一部分) / [[memory]] (长期记忆作为 prompt context)

## Muse 对应实践

| Muse 组件 | 对应概念 | 实现状态 |
|-----------|---------|---------|
| `src/core/identity/` | System Prompt (Identity/Persona) | ✅ 已实现 |
| `.agents/skills/` | Skill 文件系统 | ✅ 已实现 |
| `AGENTS.md` | 根级别 Prompt | ✅ 已实现 |
| Skill Loader | 按需加载机制 | ✅ 已实现 |
| 动态 persona | 基于 context_variables 调整 | 🟡 部分实现 |

## 开放问题

1. **Prompt 的可测试性**：如何对 system prompt 做回归测试？改一个词可能改变整个模型行为
2. **Prompt 的版本控制**：Skill 文件的变更如何追踪和回滚？
3. **多模型适配**：同一个 prompt 在 Claude vs GPT vs Gemini 上表现可能完全不同，如何做适配？
