# D22 — Multi-Agent (1/2)

> **日期：** 2026-04-29（Tue）
> **路线图位置：** Week 4 · Day 22 · Multi-Agent（第 1 天，共 2 天）
> **定位：** 🟨 理解级（今天 1.5h = 45min 理论 + 45min 实践）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **什么时候需要 Multi-Agent？** 单 Agent 的极限在哪里？
2. **Multi-Agent 有哪些协作模式？** Manager-Workers / Pipeline / Debate / Swarm
3. **OpenAI 的 Swarm 框架是怎么设计的？** 为什么它强调"轻量+可控"？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（Multi-Agent 原理） | 40min | [ ] |
| 2 | 📖 看 → `reference/repos/swarm/README.md` | 10min | [ ] |
| 3 | 📂 oc11 面试故事（STAR 格式练习） | 40min | [ ] |
| 4 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 李宏毅 [Agent 互動](https://youtu.be/...) + OpenAI Swarm + CrewAI/AutoGen 文档中提炼。
> Multi-Agent 是 Agent 工程的进阶话题 — 理解何时用、怎么用比到处搞多 Agent 更重要。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **Multi-Agent System** | 多个 Agent 协同完成任务 | 一个团队里多个专家各司其职 | 共识算法 |
| **Swarm** | OpenAI 的轻量级 Multi-Agent 框架 | 最简单的多 Agent 实现 — Agent 之间可以"交接" | 和 LangGraph 的对比 |
| **Handoff** | 一个 Agent 把控制权转交给另一个 | "这个问题我不擅长，让技术专家来" | 状态传递的细节 |
| **Shared Context** | 多个 Agent 共享同一个对话历史 | 团队成员都能看到同一个白板 | 上下文隔离 |
| **Agent Specialization** | 每个 Agent 专注特定领域 | 医生看病、律师打官司、各有专长 | 动态角色分配 |

### 为什么需要 Multi-Agent？

[Fact] 单 Agent 的三个极限：

**极限 1：System Prompt 过载**
```
一个 Agent 同时要:
- 当客服（温暖耐心）
- 当程序员（精确严谨）
- 当分析师（全局思维）

→ System Prompt 矛盾 → 行为混乱
```

**极限 2：工具过多**
```
一个 Agent 配 50+ 工具 → LLM 选择困难
D11 学过: 5-15 个工具是最佳区间
→ 超过需要分组 → 分组 = 分 Agent
```

**极限 3：任务复杂度**
```
复杂项目需要:
  1. 规划整体方案 (需要全局视野)
  2. 执行各个子任务 (需要专业技能)
  3. 评审结果质量 (需要批判思维)

一个 Agent 同时扮演三个角色 → 效果差
```

**结论：** Multi-Agent 不是为了"酷"，是单 Agent 遇到极限时的解决方案。

### Multi-Agent 的四种协作模式

[Fact] 李宏毅在 LH26_02b 中引用并系统化了多种协作模式：

#### 模式 1：Manager-Workers（经理-员工）

```
         ┌────────────┐
         │  Manager    │ ← 规划、分配、汇总
         │  (规划者)    │
         └──┬───┬───┬──┘
            │   │   │
     ┌──────▼┐ ┌▼────┐ ┌▼──────┐
     │Worker1│ │W2   │ │W3     │ ← 各自执行子任务
     │(搜索) │ │(编码)│ │(分析) │
     └───────┘ └─────┘ └───────┘
```

**适用场景：** 复杂项目分解 — 对应 BEA 的 Orchestrator-Workers
**真实案例：** Devin（AI 编程）= Manager 分析需求 + Workers 编写代码/运行测试

#### 模式 2：Pipeline（流水线）

```
Agent A → Agent B → Agent C → Final Output
(翻译)    (校对)    (格式化)
```

**适用场景：** 固定步骤的加工链 — 对应 BEA 的 Prompt Chaining
**真实案例：** 内容生成管线 — 写稿 Agent → 审稿 Agent → 发布 Agent

#### 模式 3：Debate（辩论）

```
Agent A ←──→ Agent B
(正方)         (反方)
       ↗
   Judge
  (裁判)
```

[Fact] 李宏毅在 LH26_02b 中介绍：

> "讓不同的 Agent 互相辯論，可以提升回答的品質。因為每個 Agent 都會盡量找出對方的漏洞。"

**适用场景：** 需要多角度分析、减少偏见
**真实案例：** 代码审查 — 开发 Agent 写代码 + 审查 Agent 找 Bug

#### 模式 4：Swarm（群体智能）

```
Agent A ←→ Agent B ←→ Agent C
    ↕           ↕           ↕
Agent D ←→ Agent E ←→ Agent F
```

**适用场景：** 去中心化协作，每个 Agent 能将任务"交接"给最合适的 Agent
**真实案例：** 客服系统 — 客户开始聊 → 通用 Agent → Handoff → 退款专家 Agent

### OpenAI Swarm — "轻量级 Multi-Agent"

[Fact] Swarm 的核心设计理念：**可控 > 智能**

```python
# Swarm 的核心概念只有两个:

# 1. Agent = System Prompt + Tools
sales_agent = Agent(
    name="Sales",
    instructions="你是销售顾问...",
    functions=[check_inventory, create_order]
)

# 2. Handoff = 一个 Agent 转交给另一个
def transfer_to_support():
    """当客户有技术问题时，转交给技术支持"""
    return support_agent  # 就是返回另一个 Agent！

sales_agent.functions.append(transfer_to_support)
```

**Swarm 的设计决策：**

| 决策 | Swarm 的选择 | 为什么 |
|------|-------------|-------|
| 状态管理 | 无状态（Context 传递） | 简单、可预测 |
| 通信方式 | 函数调用（Handoff） | 不需要消息总线 |
| Agent 发现 | 硬编码（函数列表） | 开发者完全控制 |
| 复杂度 | 极简（~200 行核心代码） | 教学级，易理解 |

**Swarm 的核心代码结构：**
```python
def run(agent, messages):
    while True:
        # 1. 调用当前 Agent 的 LLM
        response = call_llm(agent.instructions, agent.functions, messages)
        
        # 2. 处理工具调用
        for tool_call in response.tool_calls:
            result = execute(tool_call)
            
            # 3. 如果工具返回的是另一个 Agent → Handoff!
            if isinstance(result, Agent):
                agent = result      # 切换到新 Agent
                continue
            
            messages.append(tool_result(result))
        
        # 4. 没有工具调用 → 返回最终回答
        if not response.tool_calls:
            return response
```

### Multi-Agent vs 单 Agent + Routing

[Fact] 一个关键区别要想清楚：

```
单 Agent + Routing (D12 BEA 的 Routing 模式):
  用户消息 → [分类器] → 切换 System Prompt
  只有一个 Agent，但根据分类换不同"人设"

Multi-Agent (真正多 Agent):
  用户消息 → Agent A → Handoff → Agent B
  多个独立 Agent，各有自己的 System Prompt + 工具集
```

| 维度 | 单 Agent + Routing | Multi-Agent |
|------|-------------------|-------------|
| 复杂度 | 低 | 高 |
| 工具隔离 | 共享所有工具 | 每个 Agent 独立工具 |
| 上下文 | 共享同一个 Context | 可以隔离 Context |
| 适用 | 角色差异小 | 角色差异大、工具集不同 |
| Anthropic 建议 | 优先用这个 | 只有当 Routing 不够时 |

### Agent 对工作的影响

[Fact] 李宏毅在 LH26_02c 中讨论了 Agent 对未来工作的影响：

> "Agent 不會完全取代人類。但會改變工作方式 — 從'自己做所有事'變成'管理 Agent 做事'。"

关键洞察：
- **短期**：Agent 做重复性工作（搜索、整理、数据处理）
- **中期**：Agent 做专业性工作（代码审查、文档分析）
- **长期**：人的角色 → 规划、评审、决策（管理 Agent 团队）

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "讓不同的 Agent 互相辯論可以提升回答品質。" — 李宏毅 LH26_02b | 多角度检验 = 减少错误和偏见 |
| "Swarm focuses on making agent coordination lightweight and controllable." — OpenAI Swarm README | Swarm 追求轻量可控，不追求花哨 |
| "Agent 不會取代人類，但會改變工作方式。" — 李宏毅 LH26_02c | 未来是"人管理 Agent"，不是"Agent 取代人" |

### 🎤 面试追问链

```
Q1: 什么时候应该用 Multi-Agent 而不是单 Agent？
→ 你答: 三种信号：1)System Prompt 矛盾(角色冲突) 2)工具超过15个(选择困难) 3)任务需要不同角色(规划+执行+评审)
  Q1.1: Multi-Agent 有哪些协作模式？
  → 你答: 4种：Manager-Workers(分工)/Pipeline(流水线)/Debate(辩论)/Swarm(群体交接)
    Q1.1.1: Swarm 的 Handoff 是怎么实现的？
    → 你答: 极简 — 工具函数返回另一个Agent对象，框架自动切换。无状态，Context直接传递。~200行核心代码。

Q2: Multi-Agent 和单Agent+Routing有什么区别？
→ 你答: Routing是一个Agent切换System Prompt(共享工具和Context)。Multi-Agent是多个独立Agent(独立工具集，可隔离Context)。Anthropic建议优先用Routing。
```

### 这几个概念不要混

- **Multi-Agent ≠ 多轮对话**：Multi-Agent 是多个 Agent 协作，多轮是一个 Agent 多次交互
- **Handoff ≠ Routing**：Handoff 是 Agent 间的控制权转交（双向），Routing 是入口的一次性分流（单向）
- **Swarm ≠ Swarm Intelligence**：OpenAI Swarm 是框架名，Swarm Intelligence 是仿生学概念（蚁群算法等）
- **Manager ≠ Orchestrator**：概念类似但 Manager 更强调"人性化管理"，Orchestrator 更技术化

### 关键概念清单

- [ ] **单 Agent 的三个极限**：Prompt 过载 / 工具过多 / 角色冲突
- [ ] **4 种协作模式**：Manager-Workers / Pipeline / Debate / Swarm
- [ ] **Swarm 的核心概念**：Agent = Prompt + Tools, Handoff = 返回另一个 Agent
- [ ] **Multi-Agent vs Routing**：独立 Agent vs 切换 Prompt
- [ ] **Anthropic 原则**：优先单 Agent + Routing，确实不够才 Multi-Agent
- [ ] **Agent 对工作的影响**：从"做事"变成"管理 Agent 做事"

---

## 🔧 实践任务：oc11 面试故事（STAR 格式）

> 📂 已有文件，去看 → `unit01-agent-core/oc-tasks/L5-synthesize/oc11-interview-stories.md`

**USOLB 标注：** `[S] 源码` `[B] 编译`

**任务说明：**
1. 用 STAR 格式（Situation → Task → Action → Result）整理你学到的 Agent 知识
2. 把"我学了 Agent 开发"转化为面试可用的项目故事
3. 连接 Muse 项目经验：你在造一个 Agent，不只是"学"

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| OpenAI Swarm | `reference/repos/swarm/` | README + examples/ |
| 李宏毅 Agent 互動 | LH26_02b | 4种协作模式 |
| CrewAI 文档 | https://docs.crewai.com/ | 另一种 Multi-Agent 框架 |

### 补充资源 — 李宏毅知识包

- [LH26_02b_agent_interaction — Agent 互动模式](../../reference/courses/lee-hongyi/knowledge/LH26_02b_agent_interaction.md)
  - 核心价值：协作/辩论/投票模式 + 质量提升实验
- [LH26_02c_agent_work_impact — Agent 对工作的影响](../../reference/courses/lee-hongyi/knowledge/LH26_02c_agent_work_impact.md)
  - 核心价值：Agent社会学视角 + 人类未来角色定位

---

## 🧠 与 Muse/项目 的映射

- **本地代码实际做的事：**
  - `src/core/orchestrator.mjs` — Muse 当前是单 Agent 循环。名字叫 orchestrator 但尚未实现多 Agent
  - `src/mcp/callback-tools.mjs` — 已有 Planner→Executor 的回调雏形 = Handoff 的原型
- **远端模型/外部系统做的事：**
  - 多 Agent 系统中每个 Agent 可以用不同模型（规划用 o1，执行用 4o-mini）
- **未来可以做的事：**
  - Muse 进化路线：单Agent → Planner+Executor 双Agent → 多专家Agent
  - 参考 Swarm 的 Handoff 模式，实现轻量级的 Agent 交接

---

## ✅ 自检清单

- [ ] **能列出单 Agent 的三个极限**
- [ ] **能列出 4 种协作模式**：各一个真实案例
- [ ] **能描述 Swarm 的 Handoff 机制**
- [ ] **能区分 Multi-Agent 和 Routing**
- [ ] **知道什么时候该/不该用 Multi-Agent**
- [ ] **完成 oc11 STAR 面试故事**

### 面试题积累（2 题）

**Q1: 什么时候应该用 Multi-Agent 而不是单 Agent？**

> 你的回答：___
>
> 参考：三种信号：1)角色矛盾(客服+程序员=行为混乱) 2)工具>15个 3)需要规划+执行+评审分离。Anthropic原则：先试单Agent+Routing。

**Q2: 请比较 OpenAI Swarm 和传统的 Manager-Workers 模式。**

> 你的回答：___
>
> 参考：Swarm=去中心化（Agent间Handoff，无中央Manager），极简（~200行），无状态。Manager-Workers=中心化（Manager分配），适合需要全局协调的复杂任务。Swarm适合客服等"接力赛"场景。

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
