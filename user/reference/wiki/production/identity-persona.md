# Identity 与 Persona

> **一句话定义**: Identity 是 Agent 的"人格操作系统"——通过数据驱动的 schema 定义 Agent 是谁、怎么说话、什么能做什么不能做，让同一个 LLM 表现出完全不同的人格。

## 核心原理

### 为什么需要 Identity

没有 Identity 的 Agent 只是一个通用的"助手"。有了 Identity，它可以是项目经理、架构师、代码实现者 — 各有不同的性格、风格和行为边界。

### System Prompt 分层架构

ai-agents-for-beginners L06 提出了系统消息框架 (System Message Framework) — 分步构建 Agent 人格：

```
Step 1: Meta Prompt
  → "你是一个专家级的 AI Agent 助手创建者..."

Step 2: Basic Prompt (输入)
  → "你是一个旅行代理，擅长预订航班..."

Step 3: LLM 生成结构化 System Prompt (输出)
  → Company / Role / Objectives / Key Responsibilities /
     Tone and Style / User Interaction Instructions

Step 4: 迭代优化
  → 修改 Basic Prompt → 重新生成 → 对比评估
```

**关键洞察**：用 LLM 生成 System Prompt，比人工写更结构化、更全面。

### 结构化 Identity Schema

从 ai-agents-for-beginners L06 和 learn-claude-code s05 综合提炼的 Identity 数据模型（编辑综合，非单一来源的直接提取）：

```json
{
  "identity": {
    "name": "Agent 名字",
    "role": "角色定义",
    "bio": "一句话描述"
  },
  "psychology": {
    "mbti": "INTJ",
    "traits": {
      "humor": 0.3,
      "warmth": 0.4,
      "initiative": 0.8,
      "precision": 0.95
    }
  },
  "linguistics": {
    "style": "严谨直接",
    "formality": "casual-professional",
    "catchphrases": ["好的，我来梳理一下"],
    "language": "zh-CN"
  },
  "motivations": {
    "core_drive": "把模糊想法变成清晰任务",
    "values": ["严谨", "清晰", "交付"]
  },
  "boundaries": {
    "never_do": ["假装是人类", "泄露隐私"],
    "always_do": ["不清楚先问", "输出结构化文档"]
  }
}
```

### 四层 System Prompt 生成

从 Identity Schema 自动生成四层结构化 System Prompt：

| 层次 | 内容 | 示例 |
|------|------|------|
| **Layer 1: Role** | 谁 | "你是阿奇，首席架构师，精通 Agent 设计" |
| **Layer 2: Style** | 怎么说话 | "MBTI: INTJ / 理性精准 / 口头禅: 让我看一下代码" |
| **Layer 3: Rules** | 必须做什么 | "使命: 确保设计清晰 / 必须: 先读代码再设计" |
| **Layer 4: Safety** | 禁止什么 | "禁止: 假装是人类 / 禁止: 修改代码" |

### 多角色 Identity

同一框架支持多种角色的 Agent：

| 角色 | 性格侧重 | 行为重点 |
|------|---------|---------|
| **项目经理** | initiative=0.8, precision=0.9 | 需求理解 + 任务整理 |
| **架构师** | precision=0.95, humor=0.3 | 方案设计 + 代码检视 |
| **代码实现者** | precision=0.9, verbosity=0.3 | 编码 + 测试 + 交付 |
| **审查员** | precision=0.98, warmth=0.3 | 合规审查 + 质量验证 |

**关键约束**：每个角色有明确的 `never_do` 边界 — 架构师**不写代码**，审查员**不修改方案**。

### Persona 与 AGENTS.md

learn-claude-code s05 的 Skill Loading 模式适用于 Persona：

```
AGENTS.md (项目根目录)
├── <!-- PERSONA_START -->
│   ├── # Agent 名字 — 身份描述
│   ├── ## 身份
│   ├── ## 性格
│   ├── ## 行为规则
│   └── ## 安全边界
├── <!-- PERSONA_END -->
└── (项目规则保持不变)
```

**受控区块合并**：
- 找到 PERSONA_START/END 标记 → 替换人格区块
- 没有标记 → 在文件开头插入
- 项目规则段落**完全保留不动**

### Persona Memory 与长期一致性

结合 [[memory]] 的 Persona Memory 类型，Identity 需要长期一致：

- **角色设定**：持久不变（除非管理员修改）
- **个性特征**：通过 traits 数值控制，0-1 连续范围
- **语言习惯**：口头禅、说话风格随时间可微调
- **行为边界**：never_do 是硬约束，不可覆盖

### Boundaries 的层级合并

安全边界支持多层继承：

```
Layer 1: 家族级规则 (shared/rules.json)
  → never_do: ["泄露隐私", "执行危险命令"]  ← 硬约束，所有成员继承

Layer 2: 角色级规则 (role defaults)
  → never_do: ["修改代码"]  ← 架构师专属

Layer 3: 成员级覆盖 (boundaries.json)
  → always_do: ["对照 Blueprint 验证"]  ← 可覆盖

合并规则:
  - never_do: 并集 (只能追加，不能删除上级红线)
  - always_do: 下级替换上级
```

## 来源覆盖

| 来源 | 章节 | 覆盖深度 | 关键贡献 |
|------|------|---------|---------|
| [ai-agents-for-beginners](../../repos/ai-agents-for-beginners/06-building-trustworthy-agents/README.md) | L06: Trustworthy | ⭐⭐⭐ | System Message Framework |
| [learn-claude-code](../../repos/learn-claude-code/docs/en/s05-skill-loading.md) | s05: Skill Loading | ⭐⭐ | AGENTS.md 模式 + 两层 prompt |
| [ai-agents-for-beginners](../../repos/ai-agents-for-beginners/13-agent-memory/README.md) | L13: Memory | ⭐ | Persona Memory 类型 |

## 概念间关系

- **前置概念**: [[prompt-engineering]] (System Prompt 是 Identity 的表达) / [[memory]] (Persona Memory)
- **相关概念**: [[multi-agent]] (不同角色的 Agent 协作) / [[observability]] (监控 Identity 一致性)
- **基础概念**: [[agent-definition]] (Identity 让通用 Agent 变成专用 Agent)

## 开放问题

1. **人格漂移**：长对话中 Agent 是否会"忘记"自己的角色？如何检测和修复？
2. **traits 的粒度**：0-1 的数值对模型行为的控制精度如何？是否需要更多维度？
3. **文化适配**：同一个 Agent 面对不同文化背景的用户，应该如何调整说话风格？
4. **多角色切换**：一个 Agent 能否根据场景动态切换角色？切换规则是什么？
