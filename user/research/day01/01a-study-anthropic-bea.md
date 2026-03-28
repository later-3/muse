# 精读：Anthropic《Building Effective Agents》

> **来源：** https://www.anthropic.com/engineering/building-effective-agents  
> **作者：** Erik Schluntz & Barry Zhang (Anthropic 工程团队)  
> **发布：** 2024-12-19  
> **Sprint 1 · Day 1 · 类型：精读**  
> **一句话总结：** 最成功的 Agent 实现用简单可组合的模式，而非复杂框架。  
> *The most successful implementations use simple, composable patterns rather than complex frameworks.*

**相关文档：**
- 面试准备 + 项目分析 → [Part 2](./01b-study-anthropic-bea-projects.md)

---

## 一、⭐ 核心概念（Key Concepts）

> 按学习依赖顺序排列。先理解上面的，才能理解下面的。

| # | 英文术语 | 中文 | 一句话解释 | 重要度 |
|---|---------|------|-----------|-------|
| 1 | **LLM (Large Language Model)** | 大语言模型 | 基础能力引擎，一切 Agent 系统的动力源 | 前置知识 |
| 2 | ⭐ **Augmented LLM** | 增强型 LLM | LLM + 检索 + 工具 + 记忆 = Agent 系统的最小可用单元 | ⭐⭐⭐ |
| 3 | ⭐ **Agentic System** | 智能体系统 | 使用 LLM 做决策的系统的统称，包含 Workflow 和 Agent 两种 | ⭐⭐⭐ |
| 4 | ⭐ **Workflow** | 工作流 | LLM 通过**预定义代码路径**编排 — 开发者掌控流程 | ⭐⭐⭐ |
| 5 | ⭐ **Agent** | 智能体 | LLM **动态指挥**自己的流程和工具使用 — LLM 掌控流程 | ⭐⭐⭐ |
| 6 | **Prompt Chaining** | 提示链 | 任务分解为顺序步骤，每步 LLM 处理前一步输出 | ⭐⭐ |
| 7 | **Routing** | 路由 | 先分类输入，然后导向专门的处理链路 | ⭐⭐ |
| 8 | **Parallelization** | 并行化 | 多个 LLM 同时工作，结果由程序聚合 | ⭐⭐ |
| 9 | **Orchestrator-Workers** | 编排者-工人 | 中央 LLM 动态拆解任务 → 分派 worker → 综合结果 | ⭐⭐⭐ |
| 10 | **Evaluator-Optimizer** | 评估者-优化者 | 一个 LLM 生成，另一个评估反馈，循环迭代 | ⭐⭐ |
| 11 | ⭐ **ACI (Agent-Computer Interface)** | 智能体-计算机接口 | Agent 版的 UI/UX — 工具设计需要和 HCI 同等的投入 | ⭐⭐⭐ |
| 12 | **Gate** | 门控 | Prompt Chaining 中间的程序化检查点 | ⭐ |
| 13 | **Ground Truth** | 真实反馈 | Agent 每步必须从环境获取的客观事实（工具结果、测试结果） | ⭐⭐ |
| 14 | **Poka-yoke** | 防呆设计 | 日本丰田概念：通过设计让犯错变得不可能 | ⭐⭐ |
| 15 | **Sectioning** | 切片 | 并行化子变体：独立子任务同时跑 | ⭐ |
| 16 | **Voting** | 投票 | 并行化子变体：同一任务多次执行取共识 | ⭐ |
| 17 | **Guardrails** | 护栏 | 限制 Agent 行为边界的安全机制 | ⭐⭐ |
| 18 | **HCI (Human-Computer Interface)** | 人机接口 | 传统 UI/UX 设计领域 — ACI 的类比对象 | 前置知识 |

---

## 二、📖 原文精读

### 2.1 ⭐ 最重要的区分：Workflow vs Agent

> [!IMPORTANT]
> 这是全文**最核心的概念**。面试必问，设计必用。

**原文：**
> *"Workflows are systems where LLMs and tools are orchestrated through predefined code paths. Agents, on the other hand, are systems where LLMs dynamically direct their own processes and tool usage, maintaining control over how they accomplish tasks."*

**中文解读：**

| | **Workflow（工作流）** | **Agent（智能体）** |
|---|---|---|
| 控制权 | **开发者**定义路径，LLM 是执行者 | **LLM** 自己决定路径 |
| 可预测性 | 高 — 你知道它下一步走哪 | 低 — 它自己选路 |
| 灵活性 | 有限 — 路径写死 | 高 — 动态应变 |
| 成本 | 较低 | 较高（更多 LLM 调用） |
| 错误风险 | 可控 — 路径上加 Gate 检查 | 累积 — 一步错可能步步错 |
| 适合场景 | 任务定义明确、步骤固定 | 开放式问题、步骤不可预测 |

🔑 **关键洞察：Anthropic 把两者统称 Agentic System，但架构上严格区分。** 很多人说自己在做 "Agent"，其实在做 Workflow — 这没问题，Anthropic 的建议恰恰是 **先 Workflow，不够再升 Agent**。

### 2.2 ⭐ 渐进式复杂度原则

**原文：**
> *"We recommend finding the simplest solution possible, and only increasing complexity when needed."*

**这不只是一句鸡汤，而是文章的结构骨架：**

```
简 ←————————————————————————————————————→ 复

单次 LLM 调用 → Prompt Chaining → Routing → Parallelization 
    → Orchestrator-Workers → Evaluator-Optimizer → Agent
```

> [!TIP]
> **设计原则：** 永远从最左边开始。只有当你能证明简单方案不够用时，才往右移。这是避免过度工程（Over-engineering）的铁律。

### 2.3 基础积木：Augmented LLM

**原文：**
> *"The basic building block of agentic systems is an LLM enhanced with augmentations such as retrieval, tools, and memory."*

```
┌─────────────────────────────────┐
│        Augmented LLM            │
│                                 │
│   LLM ← Retrieval (检索)       │
│       ← Tools    (工具)        │
│       ← Memory   (记忆)        │
└─────────────────────────────────┘
```

两个关键实现建议（不展开，非重点）：
1. 为你的用例定制增强能力
2. 提供简洁、文档完善的接口给 LLM

---

### 2.4 ⭐ 五种编排模式详解

#### 模式 1：Prompt Chaining（提示链）

```
Input → LLM₁ → [Gate ✓/✗] → LLM₂ → [Gate ✓/✗] → LLM₃ → Output
```

**原文：**
> *"Prompt chaining decomposes a task into a sequence of steps, where each LLM call processes the output of the previous one. You can add programmatic checks (see 'gate') on any intermediate steps."*

**白话：** 流水线。第一个工人做完交给第二个，中间有质检员（Gate）。

**什么时候用：** 任务可以干净地拆成固定步骤  
**什么时候不用：** 步骤数不确定、需要动态决策

**例子：** 写营销文案 → 翻译成日文 → 校对

#### 模式 2：Routing（路由）

```
Input → [Classifier] ──→ 路线 A → Specialized LLM_A
                     ├──→ 路线 B → Specialized LLM_B
                     └──→ 路线 C → Specialized LLM_C
```

**白话：** 前台分诊。先判断你要看什么科，再送你去对应科室。

**什么时候用：** 明显有不同类别需要不同处理方式  
**效果好的原因：** 每条路线可以独立优化，互不干扰（**Separation of Concerns**）

**原文例子：**
> *"Routing easy/common questions to smaller models like Claude Haiku and hard/unusual questions to more capable models like Claude Sonnet."*

这就是**模型路由（Model Routing）** — 简单问题用便宜的小模型，复杂问题才调大模型。省钱 + 快。

#### 模式 3：Parallelization（并行化）

两种子变体：

| 子变体 | 做法 | 目的 | 英文 |
|--------|------|------|------|
| **Sectioning** | 拆成独立子任务并行 | 速度 | *"Breaking a task into independent subtasks run in parallel"* |
| **Voting** | 同一任务多次执行 | 可靠性 | *"Running the same task multiple times to get diverse outputs"* |

> [!IMPORTANT]
> **Sectioning 的杀手级应用 — Guardrails 分离：**
> 
> *"Implementing guardrails where one model instance processes user queries while another screens them for inappropriate content. This tends to perform better than having the same LLM call handle both."*
> 
> 一个 LLM 处理业务，另一个**同时**做安全过滤。比一个 LLM 同时干两件事效果好得多。

#### ⭐ 模式 4：Orchestrator-Workers（编排者-工人）

```
                    ┌──→ Worker LLM₁ ──┐
Input → Orchestrator ──→ Worker LLM₂ ──→ [Synthesize] → Output
                    └──→ Worker LLM₃ ──┘
```

**原文：**
> *"A central LLM dynamically breaks down tasks, delegates them to worker LLMs, and synthesizes their results. The key difference from parallelization is its flexibility — subtasks aren't pre-defined, but determined by the orchestrator based on the specific input."*

**白话：** 项目经理模式。PM 看完需求后自己决定开几个人、谁做什么、做完了汇总。

🔑 **和 Parallelization 的关键区别：** 并行化的子任务是**预定义的**（你写代码定好的），Orchestrator-Workers 的子任务是 **LLM 动态决定的**。

**例子：** 编码产品 — orchestrator 分析任务后决定要改哪几个文件、怎么改，然后分派 worker 并行修改。

#### 模式 5：Evaluator-Optimizer（评估者-优化者）

```
Generator LLM → Output → Evaluator LLM → Feedback
      ↑                                       |
      └─────────── Iterate（迭代）─────────────┘
```

**原文：**
> *"This workflow is particularly effective when we have clear evaluation criteria, and when iterative refinement provides measurable value."*

**适合的两个信号：**
1. 人类给反馈能明显改善输出
2. LLM 也能给出和人类一样有效的反馈

---

### 2.5 ⭐ Agent 的精确定义

**原文（重要，完整引用）：**
> *"Agents begin their work with either a command from, or interactive discussion with, the human user. Once the task is clear, agents plan and operate independently, potentially returning to the human for further information or judgement. During execution, it's crucial for the agents to gain 'ground truth' from the environment at each step (such as tool call results or code execution) to assess its progress. Agents can then pause for human feedback at checkpoints or when encountering blockers."*

**拆解为流程：**

```
人类命令/对话
    ↓
Agent 制定计划
    ↓
┌─→ 执行动作（调用工具）
│   ↓
│   观察环境反馈（Ground Truth）
│   ↓
│   评估进度
│   ↓
│   是否需要人类输入？ ──→ 是 → 暂停等待
│   ↓ 否
│   是否完成 / 达到最大迭代？ ──→ 是 → 结束
│   ↓ 否
└───┘
```

> [!IMPORTANT]
> **Ground Truth（真实反馈）是 Agent 和"自嗨循环"的本质区别。**
> 
> Agent 不是在脑子里空想——每一步都要从环境拿到**客观事实**（工具执行结果、测试输出、API 响应），然后基于事实决定下一步。没有 Ground Truth 的循环就是幻觉循环。

---

### 2.6 ⭐ ACI — Agent-Computer Interface

> [!IMPORTANT]
> Anthropic 在做 SWE-bench 时 **在工具优化上花的时间 > prompt 优化**。这颠覆了很多人"prompt 是关键"的认知。

**原文（核心类比）：**
> *"Think about how much effort goes into human-computer interfaces (HCI), and plan to invest just as much effort in creating good agent-computer interfaces (ACI)."*

**ACI 设计六原则：**

| # | 原则 | 英文关键词 | 解释 |
|---|------|-----------|------|
| 1 | 给足思考空间 | *"Give enough tokens to think"* | 不要一上来就要结构化输出 |
| 2 | 贴近自然格式 | *"Close to naturally occurring text"* | 工具 I/O 格式要像网上自然出现的文本 |
| 3 | 避免格式开销 | *"No formatting overhead"* | 不要让 LLM 数行号、转义 JSON 换行符 |
| 4 | 站在模型角度 | *"Put yourself in the model's shoes"* | 工具描述是否足够直观？ |
| 5 | 像写好文档 | *"Like writing a great docstring"* | 给工具写好文档，像给初级开发者写 docstring |
| 6 | 防呆设计 | *"Poka-yoke your tools"* | 改变参数设计使犯错变得不可能 |

**实战案例：绝对路径的故事** 🔑

> *"We found that the model would make mistakes with tools using relative filepaths after the agent had moved out of the root directory. To fix this, we changed the tool to always require absolute filepaths — and we found that the model used this method flawlessly."*

相对路径 → Agent 经常出错 → 改成**强制绝对路径** → 错误消失。

这就是 **Poka-yoke**：不是告诉 Agent "请用绝对路径"（prompt 层面），而是在工具设计层面**让它无法使用相对路径**。

---

### 2.7 三大设计原则总结

**原文：**
> *"1. Maintain simplicity in your agent's design."*
> *"2. Prioritize transparency by explicitly showing the agent's planning steps."*  
> *"3. Carefully craft your agent-computer interface (ACI) through thorough tool documentation and testing."*

| 原则 | 中文 | 一句话 |
|------|------|--------|
| **Simplicity** | 简单 | 先从最简方案开始，复杂度需要证明 |
| **Transparency** | 透明 | Agent 的每一步规划对外可见 |
| **ACI Craft** | 精心设计 ACI | 工具设计投入 ≥ prompt 投入 |

---

## 三、🏗️ Muse 深度思考

### 3.1 muse-harness (S2) = Orchestrator-Workers

**当前状态：** Muse 的 planner ↔ arch/coder/reviewer 架构**最直接地映射**到 Orchestrator-Workers 模式。

**深度问题：**
- planner 是否真正做到了"动态拆解"？
  - 如果 planner 总是走固定流程（先让 arch 分析 → 再让 coder 写 → 最后 reviewer 检查），那本质上是 **Prompt Chaining**，不是 Orchestrator-Workers
  - 真正的 Orchestrator-Workers 应该是：planner 看完任务后**自己决定**需要调用谁、调用几次、是否并行
- **Sprint 3 Spike 验证目标：** planner 能否根据不同任务动态选择不同的 worker 编排方案？

### 3.2 ACI 对 Muse MCP 工具的启发

**当前问题清单（Sprint 3 工具优化输入）：**

| 问题 | ACI 原则 | 行动 |
|------|---------|------|
| MCP 工具的 description 是否足够让 LLM 自然使用？ | 写好文档 | 审查所有工具描述 |
| 参数是否防呆？比如 member_id 是否有模糊空间？ | Poka-yoke | 强制使用精确 ID |
| 工具返回值是否太冗长？ | 避免格式开销 | 裁剪返回值 |
| 是否有"陷阱参数"让 LLM 容易犯错？ | 站在模型角度 | 用测试用例验证 |

### 3.3 Guardrails 分离对 S3 审批的启发

S3（高风险动作审批）可以参考 **Parallelization - Sectioning** 模式：
- 一个 LLM 执行代码变更
- **同时**另一个 LLM 做风险评估（而非串行）
- 两个结果汇总后提交给 planner / Later 审批

这比现有的"先做完再审"效率更高，也更能捕捉风险。

### 3.4 Evaluator-Optimizer 对 S2 的启发

muse-harness 可以引入迭代优化循环：
- coder 产出代码 → reviewer 评估 → 反馈 → coder 修改 → 再评估
- **退出条件：** reviewer 通过 **或** 达到最大迭代次数（Anthropic 建议的 stopping condition）
- 这比一次性 code review 质量更高

---

## 四、👤 人物与术语

### 关键人物

| 人物 | 身份 | 为什么重要 |
|------|------|-----------|
| **Erik Schluntz** | Anthropic 工程师，本文作者 | 直接参与 SWE-bench Agent 开发 |
| **Barry Zhang** | Anthropic 工程师，本文作者 | 客户合作经验丰富 |
| **Andrew Ng（吴恩达）** | DeepLearning.AI 创始人、斯坦福教授 | 提出 4 种 Agentic Design Patterns（Reflection, Tool Use, Planning, Multi-Agent），是这个领域的布道者 |
| **Harrison Chase** | LangChain / LangGraph 创始人 | 最早把 Agent 工具链产品化的人 |
| **Yohei Nakajima** | BabyAGI 作者 | 2023 年 Agent 热潮的点火者之一 |
| **Andrej Karpathy** | 前 Tesla AI 总监、OpenAI 早期成员 | 提出 "LLM OS" 概念 — LLM 作为操作系统内核 |

### Andrew Ng 的 4 种 Agentic Patterns（补充对比）

Andrew Ng 在 2024 年提出的分类体系，和 Anthropic 的 5 种模式有交集但不完全对应：

| Andrew Ng | 对应 Anthropic | 差异 |
|-----------|---------------|------|
| **Reflection（反思）** | Evaluator-Optimizer | Ng 更强调自我评估，Anthropic 强调双 LLM |
| **Tool Use（工具使用）** | Augmented LLM | 同一概念 |
| **Planning（规划）** | Agent 的规划阶段 | Ng 单独提出，Anthropic 融入 Agent 定义 |
| **Multi-Agent（多智能体）** | Orchestrator-Workers / Parallelization | Ng 更宽泛 |

---

## 五、❌ 常见误区

| # | 误区 | 正确理解 |
|---|------|---------|
| 1 | "Agent 比 Workflow 更高级" | ❌ Agent 不是 Workflow 的升级版。Workflow 可预测、可控、便宜。很多场景 Workflow 就是最优解 |
| 2 | "做 Agent 就要用框架" | ❌ Anthropic 明确建议从 LLM API 直接调用开始。框架可能遮蔽底层逻辑 |
| 3 | "Prompt 是 Agent 最重要的优化点" | ❌ ACI（工具设计）可能比 prompt 更重要。Anthropic SWE-bench 团队花更多时间在工具上 |
| 4 | "Orchestrator = Agent" | ❌ Orchestrator-Workers 仍然是 Workflow（有预定义的编排逻辑），只是子任务动态决定。真正的 Agent 是完全自主的循环 |
| 5 | "越多 Agent 越好" | ❌ 每增加一个 Agent 就增加成本和错误累积风险。要证明复杂度有回报 |

---

## 六、✅ 自检题

1. **用一句话区分 Workflow 和 Agent。**

<details><summary>参考答案</summary>
Workflow = 开发者预定义路径，LLM 按路走；Agent = LLM 自己决定路径。核心区别是"谁掌控流程"。
</details>

2. **Orchestrator-Workers 和 Parallelization 有什么区别？**

<details><summary>参考答案</summary>
Parallelization 的子任务是预定义的（代码写死），Orchestrator-Workers 的子任务是 orchestrator LLM 根据具体输入动态决定的。
</details>

3. **什么是 ACI？为什么 Anthropic 说它比 prompt 更重要？**

<details><summary>参考答案</summary>
ACI = Agent-Computer Interface，是工具给 Agent 的接口设计。Anthropic 在 SWE-bench 实践中发现，优化工具（文档、参数设计、防呆）比优化 prompt 效果更好。因为好的工具设计从根源上减少错误。
</details>

4. **举一个 Poka-yoke（防呆设计）在 Agent 工具中的例子。**

<details><summary>参考答案</summary>
Anthropic 发现 Agent 使用相对路径时经常出错。解决方案不是在 prompt 里说"请用绝对路径"，而是直接把工具改成只接受绝对路径 — 从接口层面让错误不可能发生。
</details>

5. **如果你要设计一个编码助手的 multi-agent 系统，你会选 Agent 还是 Orchestrator-Workers？为什么？**

<details><summary>参考答案</summary>
编码助手更适合 Orchestrator-Workers Workflow：中央 orchestrator 分析任务后动态决定要改哪些文件并分派 worker，但整体流程（分析→拆解→分派→综合）是预定义的。纯 Agent 模式的自主性在这里可能导致不可控的文件修改。Anthropic 的例子也把 coding products 归为 Orchestrator-Workers 场景。
</details>

---

## 七、📚 延伸阅读

| 优先级 | 资源 | 说明 |
|--------|------|------|
| 🔴 必读 | [Anthropic Cookbook: Agent Patterns](https://platform.claude.com/cookbook/patterns-agents-basic-workflows) | 本文的代码版 |
| 🔴 必读 | Andrew Ng: Agentic Design Patterns (DeepLearning.AI) | 4 种模式的视频/博客 |
| 🟡 推荐 | OpenAI Swarm 源码 | Sprint 1 Day 4 详读 |
| 🟡 推荐 | LangGraph 文档 | Sprint 1 Day 5 详读 |
| 🟢 选读 | Clowder AI 源码 | 多模型团队协作的另一种实现 |
| 🟢 选读 | Andrej Karpathy "LLM OS" 演讲 | 更宏观的视角 |

---

*精读完成于 Sprint 1 Day 1 · 2026-03-27*  
*→ 接下来读 [Part 2: 面试准备 + 开源项目分析](./01b-study-anthropic-bea-projects.md)*

---

## 📚 c 轨道：Anthropic Cookbook — basic_workflows 课程笔记

> **文件位置：** `make-muse/reference/anthropic-cookbook/patterns/agents/basic_workflows.ipynb`  
> **内容：** 3 种基础多 LLM 工作流的代码实现

### 实现了什么

Cookbook 用 ~50 行 Python 实现了 BEA 论文提到的 3 种基础 Workflow：

#### 1. Prompt Chaining（链式调用）

```python
def chain(input, prompts):
    """链式调用：每一步的输出是下一步的输入"""
    result = input
    for prompt in prompts:
        result = llm_call(f"{prompt}\nInput: {result}")
    return result
```

**用例：** 从产品公告中 ① 提取数据 → ② 分类 → ③ 格式化成表格。每步都是一次 LLM 调用。

**关键设计决策：** 每步之间设置 Gate（检查点），如果中间步骤失败可以提前停止。

#### 2. Parallelization（并行化）

```python
def parallel(input, prompts):
    """并行调用：多任务同时发送给不同 LLM"""
    with ThreadPoolExecutor() as pool:
        results = list(pool.map(
            lambda p: llm_call(f"{p}\nInput: {input}"), prompts
        ))
    return results
```

**用例：** 分析一个政策对「客户 / 员工 / 股东」三个利益相关方的影响 — 三路并行。

**关键洞察：** 并行不只是快。更重要的是**每个 LLM 只关注自己的视角**，减少了上下文干扰。

#### 3. Routing（路由分发）

```python
def route(input, routes: dict):
    """路由：先分类，再走对应的专家路径"""
    # Step 1: 用 LLM 判断输入属于哪个类别
    selector_prompt = f"Classify: {list(routes.keys())}"
    category = llm_call(selector_prompt)
    # Step 2: 用对应类别的专家 prompt 处理
    return llm_call(f"{routes[category]}\nInput: {input}")
```

**用例：** 客服系统 — 「账单/技术/退款」三类票据走不同处理流程。

### 💡 和 BEA 精读的对照

| BEA 概念 | Cookbook 实现 | 抽象层级 |
|---------|-------------|---------|
| Prompt Chaining | `chain()` 函数 | 最简实现 ~10 行 |
| 并行化 | `parallel()` + ThreadPool | 最简实现 ~8 行 |
| 路由 | `route()` + LLM 分类器 | 最简实现 ~10 行 |

### 🎯 Muse 启发

- **Muse 的 harness 流程本质上是一个 Chain**：planner → arch → coder → reviewer
- **并行化机会**：coder 和 reviewer 是否可以并行？arch 分析多个文件时是否可以并行？
- **路由就是 Muse 的场景分发**：判断用户意图（闲聊 vs 下任务 vs 审批）→ 走不同处理链路

---

## 📰 e 轨道：大佬追踪

### 姚顺雨 Shunyu Yao — ReAct (2022)

> **论文：** *ReAct: Synergizing Reasoning and Acting in Language Models*  
> **身份：** Princeton → OpenAI 研究员

#### 核心思想（一句话）

**让 LLM 在"想"和"做"之间交替执行** — 不是先想完再做，也不是只做不想，而是：想一步 → 做一步 → 观察结果 → 再想 → 再做。

#### ReAct 循环

```
Thought: 我需要查找 X 的信息    ← 推理（Reasoning）
Action:  search("X")              ← 行动（Acting）
Observation: X 是一个...          ← 世界反馈
Thought: 现在我知道了 X，但还需要 Y
Action:  search("Y")
Observation: ...
Thought: 综合 X 和 Y，答案是...
Action:  finish("答案")
```

#### 为什么重要

| 之前的方法 | 问题 | ReAct 怎么解决 |
|-----------|------|--------------|
| Chain-of-Thought (只想不做) | 幻觉！推理链基于模型自身知识 | 推理中间插入 Action 去查外部真实信息 |
| Action-only (只做不想) | 盲目行动，不会反思 | 每次行动前先 Thought，可以回溯 |

#### 关键数据

- HotpotQA：ReAct 比纯 CoT **减少了 6% 的幻觉错误**
- ALFWorld（交互任务）：ReAct **成功率 71%**，比模仿学习 baseline 高 34%

#### 🎯 Muse 启发

- **Muse 的每个 agent 内部就是 ReAct 模式**：OpenCode 底层的 Agentic Loop 就是 Thought → Tool Call → Observation 循环
- Muse 最可以从 ReAct 借鉴的是：**让 agent 在行动前显式输出 Thought**，方便 trace 和 debug
- 面试时被问到「什么是 Agent」，ReAct 是最经典的回答起点

---

### Lilian Weng — 《LLM Powered Autonomous Agents》(2023.06)

> **身份：** OpenAI VP of Research  
> **博客：** https://lilianweng.github.io/posts/2023-06-23-agent/

#### 核心框架（Agent 三要素）

Weng 把 Agent 系统分为 3 个核心组件：

```
┌─────────────────────────────────┐
│         🧠 LLM (大脑)           │
├─────────┬─────────┬─────────────┤
│ Planning│ Memory  │  Tool Use   │
│ 规划    │ 记忆    │  工具使用    │
└─────────┴─────────┴─────────────┘
```

| 组件 | 细分 | 代表技术 |
|------|------|---------|
| **Planning** | 任务分解 + 自我反思 | CoT, ToT, ReAct, Reflexion |
| **Memory** | 短期（上下文）+ 长期（外部存储） | RAG, 向量DB |
| **Tool Use** | 调用外部 API/工具 | Toolformer, HuggingGPT |

#### 关键观点

1. **Planning 不等于 Prompting** — 真正的规划需要分解(Decomposition) + 反思(Reflection) + 调整
2. **Memory 是 Agent 和 Chatbot 的本质区别** — Chatbot 没有跨 session 记忆
3. **Tool Use 扩展了 LLM 的能力边界** — 不再受限于训练数据

#### 🎯 和我们的对照

| Weng 框架 | Muse 对应 | 状态 |
|----------|----------|------|
| Planning | Planner agent + harness workflow | Sprint 6 实现 |
| Memory (短期) | OpenCode session context | ✅ 已有 |
| Memory (长期) | memory.mjs + MCP memory 工具 | 🟡 需 Refactor |
| Tool Use | MCP 工具服务器 | ✅ 已有 |
| Reflection | S2b 自开发闭环 | Sprint 7 实现 |

---

> **c/e 轨道完成于 Sprint 1 Day 1 · 2026-03-28**

