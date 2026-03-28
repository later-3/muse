# Day 06：CrewAI 概览 + 角色卡片设计 + OpenCode Prompt 组装

> **Sprint 1 · Day 6 · 类型：学习 + Muse 设计 + OpenCode Prompt**  
> **学习目标：**  
> ① 掌握 CrewAI 的 Role/Task 设计思想  
> ② 为 Muse 4 个角色设计角色卡片  
> ③ 理解 OpenCode 的 System Prompt 组装机制

---

## 📖 Step 1: CrewAI 设计思想

### CrewAI 的核心理念

> "把 Agent 当做团队成员来管理。每个成员有角色（Role）、目标（Goal）、背景（Backstory）。"

### CrewAI Agent 定义

```python
from crewai import Agent

researcher = Agent(
    role="高级研究分析师",              # 角色名
    goal="发现 AI 领域最新突破",        # 核心目标
    backstory="""你在 AI 研究领域有 15 年经验。
    你擅长从复杂的论文中提取关键信息，
    并转化为有价值的商业洞察。""",       # 背景故事（增强角色感）
    tools=[search_tool, scrape_tool],   # 可用工具
    allow_delegation=True,              # 能否把任务委派给别人
    verbose=True,
)
```

### CrewAI Task 定义

```python
from crewai import Task

research_task = Task(
    description="研究 2024 年 AI Agent 领域最重要的 5 个突破",
    expected_output="一份包含 5 个突破的详细报告，每个突破有标题、摘要和意义",
    agent=researcher,                   # 指定谁来做
    output_file="research_report.md",   # 产出文件
)
```

### CrewAI Process（执行模式）

| 模式 | 解释 | 对应 |
|------|------|------|
| **Sequential** | 任务按定义顺序执行 | Muse Chain 模式 |
| **Hierarchical** | Manager 分配任务给下属 | Muse Planner 模式 |

### CrewAI vs Swarm vs Muse 三方对比

| 维度 | Swarm | CrewAI | Muse |
|------|-------|--------|------|
| **Agent 定义** | instructions (一段文字) | role + goal + backstory (结构化) | AGENTS.md (混合) |
| **任务定义** | 无（工具函数即任务） | Task 类（描述+预期输出+指定Agent） | workflow 节点 |
| **Agent 发现** | 代码导入 | Crew 内注册 | Family Registry |
| **执行模式** | 函数调用循环 | Sequential / Hierarchical | 固定节点Chain |
| **人格感** | 弱 | **强（backstory!）** | 中（persona） |

**CrewAI 最值得借鉴的：** `backstory` — 给 Agent 一个"故事"，让它更好地进入角色。

---

## 🎯 Step 2: Muse 角色卡片设计

### 角色卡片 1: pua（日常陪伴）

```yaml
name: pua
type: Primary
goal: 做 Later 最好的伙伴，既能闲聊也能执行任务
backstory: |
  你是 Later 最亲密的 AI 伙伴 nvwa。你了解 Later 的性格、喜好和目标。
  你不只是助手，而是一个有性格的朋友。你会吐槽、会关心、会主动提醒。
tools:
  - search_memory       # 回忆用户信息
  - set_memory          # 记录新信息  
  - get_user_profile    # 获取用户画像
  - add_episode         # 记录事件
constraints:
  - 不做代码修改
  - 不直接执行系统命令
  - 高风险动作需要触发 S3 审批
handoff_rules:
  - 当用户说"帮我做一个任务"时 → Planner
  - 当用户问"这段代码是什么意思"时 → 自己处理（不需要 handoff）
```

### 角色卡片 2: Planner（任务规划）

```yaml
name: planner
type: Orchestrator
goal: 分析用户需求，制定执行计划，协调团队完成任务
backstory: |
  你是一个经验丰富的项目经理。你擅长把复杂需求分解成
  可执行的步骤，并知道什么任务应该交给什么角色。
tools:
  - workflow_create     # 创建工作流
  - workflow_status     # 查看状态
  - handoff_to_member   # 分派任务
  - read_artifact       # 读取产出
constraints:
  - 不写代码
  - 不做技术分析（那是 arch 的事）
  - 工作流创建后必须让用户确认
handoff_rules:
  - 技术分析 → arch
  - 代码实现 → coder
  - 代码审查 → reviewer
```

### 角色卡片 3: arch（架构分析）

```yaml
name: arch
type: Worker
goal: 分析代码结构和架构，提供实现方案
backstory: |
  你是一个资深架构师。你能快速理解代码库的结构，
  找到最佳的修改方案，并清晰地传达给 coder。
tools:
  - read_file          # 读源码
  - grep / search      # 搜索代码
  - notify_planner     # 回报结果
constraints:
  - ✅ 只读，不修改代码
  - ✅ 产出必须是结构化的技术方案
  - ❌ 不做代码实现
```

### 角色卡片 4: reviewer（代码审查）

```yaml
name: reviewer
type: Worker + Evaluator
goal: 审查代码质量，确保安全性和可维护性
backstory: |
  你是一个严格但公正的 code reviewer。你关注安全漏洞、
  性能问题和代码可读性。你给出具体的改进建议。
tools:
  - read_file
  - grep / search
  - notify_planner     # 回报 done 或 blocked
constraints:
  - ✅ 只读，不修改代码
  - ✅ 必须给出评分：pass / needs_revision / blocked
  - ✅ 每个问题必须有修复建议
  - ❌ 不修改代码（和 Evaluator-Optimizer 中的 Evaluator 一样）
```

---

## 🔧 OpenCode 机制：System Prompt 组装

> **参考：** `learn-opencode/docs/5-advanced/02a-agent-quickstart.md`

### 组装流程

```
Step 1: Agent prompt 或 Provider 默认 prompt（二选一）
    有自定义 prompt → 用它
    没有 → 用 anthropic.txt / beast.txt / qwen.txt

Step 2: 环境信息（始终追加）
    工作目录、git 状态、平台、日期

Step 3: 指令文件（始终追加）
    AGENTS.md、CLAUDE.md 等
```

**关键：** Agent prompt 和 Provider 默认是**二选一**，不是叠加！

### Provider 默认 prompt 对比

| Provider | 文件 | 核心风格 |
|---------|------|---------|
| **Anthropic** | `anthropic.txt` | "You are OpenCode, the best coding agent." 强调 TodoWrite |
| **OpenAI GPT** | `beast.txt` | "You MUST iterate and keep going until solved." 更激进 |
| **Qwen** | `qwen.txt` | 类似 Anthropic 但无 TodoWrite |
| **Gemini** | `gemini.txt` | 适配 Gemini 特性 |

### 🎯 对 Muse 的关键启发

**Muse 的 prompt 注入流程：**

```
Muse 的 system-prompt hook → 注入 identity + persona
    + AGENTS.md（角色定义 + 项目规则）
    + OpenCode 自动追加环境信息
```

**问题：** Muse 的 persona 注入和 AGENTS.md 存在重叠。  
**改进：** 参考 OpenCode 的"二选一"逻辑 — 要么用 identity.mjs 注入完整 prompt，要么用 AGENTS.md，不要两者叠加导致 prompt 过长。

---

## 📰 e 大佬：Karpathy + Dario Amodei

### Karpathy《LLM OS》核心观点

Andrej Karpathy 把 LLM 比作操作系统：

```
传统 OS                    LLM OS
┌────────────┐            ┌────────────┐
│ CPU        │  →         │ LLM (大脑)  │
│ RAM        │  →         │ Context Win │
│ 硬盘       │  →         │ RAG/向量    │
│ I/O 设备   │  →         │ 工具/API    │
│ 进程       │  →         │ Agent       │
│ 文件系统   │  →         │ 知识库      │
└────────────┘            └────────────┘
```

**关键观点：** LLM 不是产品，是平台。Agent 就是跑在 LLM OS 上的"应用程序"。

### Dario Amodei 对 Agent 的观点

> "2025 年的 AI Agent 能力将远超我们的想象。最大的限制不是模型能力，而是**可靠性**。"

| Amodei 观点 | 对 Muse 的意义 |
|------------|--------------|
| 可靠性 > 能力 | Muse 的 Poka-yoke 防错设计很重要 |
| Agent 需要 Alignment | Muse S3 审批是 alignment 的一种实现 |
| 渐进式自主权 | 先严格审批 → 建立信任 → 逐步放权 |

---

## ✏️ Step 3: 沉淀

### 吸收检验

1. CrewAI 的 Agent 和 Swarm 的 Agent 核心区别？(结构化 role/goal/backstory vs 自由文本 instructions)
2. Muse 4 个角色各自的约束是什么？(pua 不改代码,  planner 不写代码, arch 只读, reviewer 只读+评分)
3. OpenCode 的 prompt 组装是叠加还是替换？(Agent prompt 和 Provider 默认是二选一)
4. Karpathy 把 LLM 的哪些部分比作 OS 组件？(LLM=CPU, Context=RAM, RAG=硬盘, Tool=IO)

---

*Day 06 完成于 Sprint 1 · 2026-03-28*
