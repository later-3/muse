# Orchestrator-Workers 深入 + 跨厂商 Agent 模式

> **来源：** [W5] BEA §模式4-5 + [G5] `repos/anthropic-cookbook/patterns/agents/orchestrator_workers.ipynb`
> **补充：** OpenAI Agents SDK + Google ADK 8 模式 + [C6] Andrew Ng 4 Agentic Patterns
> **上游：** 01a BEA 精读（先理解 5 种基础模式）
> **下游：** 02b Swarm 走读 → 02c Agent 评估
> **OC 关联：** oc10 (Orch-Workers 实现) / oc12 (Cookbook Orchestrator)

---

## ⚡ 3 分钟速读版

```
一句话: Orchestrator-Worker = LLM 动态拆解任务 + 并行执行 + 汇总结果
和 Chain/Parallel 的区别: 子任务是 LLM 决定的，不是代码预定义的
Evaluator-Optimizer: 两个 LLM 互相对抗迭代，直到质量达标
三大厂对比: Anthropic(简单可组合) vs OpenAI(Handoff是函数) vs Google(8种标准模式)
Andrew Ng 四模式: Reflection + Tool Use + Planning + Multi-Agent
```

---

## §1 Orchestrator-Worker 模式详解

01a 学了 Chain / Parallel / Route 三种基础模式。现在进入高级模式。

**Orchestrator-Worker = 一个"大脑" + 多个"工人"**

```
用户需求 → [Orchestrator] → 分析需求 → 决定需要哪些子任务
                ↓
         ┌──────┼───────┐
         ↓      ↓       ↓
      [Worker1] [Worker2] [Worker3]    ← 各自独立执行
         ↓      ↓       ↓
         └──────┼───────┘
                ↓
         [Orchestrator] → 汇总结果 → 输出
```

### 和 Chain/Parallel 的核心区别

| 维度 | Chain | Parallel | Orchestrator-Worker |
|------|-------|----------|-------------------|
| **谁决定子任务？** | 代码预定义 | 代码预定义 | **LLM 动态决定** |
| **子任务数量** | 固定 | 固定 | **不固定，LLM 判断** |
| **适用场景** | 步骤明确 | 子任务已知 | **需求模糊，需要分析** |

**关键区别：** Chain/Parallel 的步骤是你写在代码里的。Orchestrator-Worker 的步骤是 LLM 自己决定的。

### Cookbook 代码剖析

> **文件：** `repos/anthropic-cookbook/patterns/agents/orchestrator_workers.ipynb` [G5]

```python
def orchestrator(task: str, 
                 available_workers: dict[str, str],
                 context: str = "") -> str:
    """
    Orchestrator: 分析任务 → 分配给 workers → 汇总结果
    
    核心流程：
    1. 告诉 LLM 有哪些 Worker 可用
    2. LLM 分析任务，输出 <workers> XML → 列出需要哪些 worker 及各自的子任务
    3. 并行调用所有被选中的 worker
    4. LLM 汇总所有 worker 的结果
    """
    
    # Step 1: Orchestrator 分析任务，决定分配
    planning_prompt = f"""
    你是一个任务编排器。分析以下任务，决定需要哪些 worker：
    
    可用 workers: {list(available_workers.keys())}
    
    用 XML 格式输出你的分配方案：
    <workers>
      <worker>
        <name>worker名字</name>
        <task>分配给这个worker的具体子任务</task>
      </worker>
      ...
    </workers>
    
    Task: {task}
    Context: {context}
    """
    
    plan = llm_call(planning_prompt)
    worker_assignments = parse_workers_xml(plan)
    
    # Step 2: 并行执行所有 worker
    results = {}
    with ThreadPoolExecutor() as pool:
        futures = {
            name: pool.submit(
                llm_call, 
                f"{available_workers[name]}\nTask: {subtask}"
            )
            for name, subtask in worker_assignments
        }
        results = {name: f.result() for name, f in futures.items()}
    
    # Step 3: 汇总
    synthesis_prompt = f"""
    原始任务: {task}
    
    各 Worker 的输出:
    {format_results(results)}
    
    请综合所有 Worker 的输出，给出最终答案。
    """
    return llm_call(synthesis_prompt)
```

### Cookbook 真实用例

```python
available_workers = {
    "market_analyst": "你是市场分析师...",
    "financial_planner": "你是财务规划师...",
    "operations_designer": "你是运营设计师...",
    "marketing_strategist": "你是营销策略师...",
}

# Orchestrator 不是人工指定 Worker，而是让 LLM 自己决定
result = orchestrator(
    "为一家中等规模的可持续服装企业制定详细的商业计划",
    available_workers
)
```

**和 01a Parallel 的区别：**

```
Parallel:
prompt = "分析影响"  ← 固定 prompt
inputs = [客户, 员工, 股东]  ← 固定输入

Orchestrator:
prompt = 由 LLM 根据任务自动生成!  ← 动态
workers = 由 LLM 从可用列表中选择!  ← 动态
```

---

## §2 Evaluator-Optimizer 模式

**让两个 LLM 互相对抗：**

```
[Generator] → 生成初稿 → [Evaluator] → 评分 + 反馈
     ↑                                      ↓
     └──── 根据反馈改进 ←────────────────────┘
     
     循环直到 Evaluator 说 "通过" 或达到最大轮次
```

```python
def evaluator_optimizer(task: str, max_rounds: int = 3) -> str:
    result = llm_call(f"完成以下任务:\n{task}")  # Generator 初稿
    
    for round in range(max_rounds):
        eval_prompt = f"""
        任务要求: {task}
        当前方案: {result}
        
        评估质量 (PASS/NEEDS_IMPROVEMENT)。
        <verdict>PASS 或 NEEDS_IMPROVEMENT</verdict>
        <feedback>具体反馈</feedback>
        """
        evaluation = llm_call(eval_prompt)
        
        if extract_xml(evaluation, "verdict") == "PASS":
            return result
        
        feedback = extract_xml(evaluation, "feedback")
        result = llm_call(f"根据反馈改进:\n反馈: {feedback}\n原方案: {result}")
    
    return result
```

---

## §3 跨厂商 Agent 模式对比

### OpenAI Agents SDK 设计哲学

| 概念 | 解释 | 代码表现 |
|------|------|---------|
| **Agent** | 带 instructions + tools 的 LLM 实例 | `Agent(name="支持", instructions="你是客服...")` |
| **Handoff** | Agent 之间的控制权转移 | `agent.handoff(target_agent)` |
| **Guardrails** | 输入输出校验，防止 Agent 脱轨 | `@input_guardrail` 装饰器 |

**关键洞察：** Handoff 不是特殊 API，**就是一个返回 Agent 对象的普通 Python 函数**。简单到惊人。

### Google ADK 8 种多 Agent 模式

| # | 模式 | 核心思想 | Muse 适用度 |
|---|------|---------|-----------|
| 1 | **Sequential** | A → B → C 顺序执行 | ✅ 已在用 |
| 2 | **Parallel** | 同时执行多个 | 🟡 可用于多文件分析 |
| 3 | **Router** | 根据输入类型分发 | ✅ 已在用 |
| 4 | **Hierarchical** | Manager 管理多个下属 | ✅ Planner 就是 |
| 5 | **HITL** | Human-in-the-Loop | 🔴 **S3 要实现** |
| 6 | **Reflection** | 自我审查改进 | 🟡 Evaluator-Optimizer |
| 7 | **Debate** | 多 Agent 辩论取最优 | 后续 |
| 8 | **Consensus** | 投票取共识 | 后续 |

### 三大厂总结

| 维度 | Anthropic (BEA) | OpenAI (Agents SDK) | Google (ADK) |
|------|----------------|--------------------|----|
| **核心理念** | 简单可组合 > 复杂框架 | Handoff 就是函数调用 | 8 种标准模式 |
| **Agent 间通信** | 无官方协议 | 函数返回 Agent | AgentFlow |
| **人类审批** | 未明确 | Guardrails | HITL 模式 |
| **工具设计** | ACI 六原则 | Function Calling | Tool Registration |
| **Muse 借鉴** | 工具设计标准 | Handoff 简洁性 | HITL + Hierarchical |

### Andrew Ng 的 4 Agentic Patterns

| # | 模式 | Ng 的解释 | 对应我们学的 |
|---|------|---------|------------|
| 1 | **Reflection** | Agent 审查自己的输出并改进 | Evaluator-Optimizer |
| 2 | **Tool Use** | Agent 调用外部工具获取信息 | 所有模式的基础 |
| 3 | **Planning** | Agent 把任务分解成子任务 | Orchestrator-Worker |
| 4 | **Multi-Agent** | 多个 Agent 协作完成任务 | 整个 harness |

> "在 GPT-3.5 + Agentic Workflow 的表现优于 GPT-4 的零样本推理。"
> — 给弱模型加好的工作流，比强模型直接上更好。**这就是 Muse 存在的意义。**

---

## §4 🎯 Muse 映射

**Muse Harness 就是 Orchestrator-Worker 模式的实例：**

| 角色 | Orchestrator-Worker 对应 |
|------|------------------------|
| Planner | **Orchestrator** — 分析用户需求，决定分配 |
| Arch / Coder / Reviewer | **Workers** — 各自执行子任务 |
| `workflow_create` | Orchestrator 的 planning 步骤 |
| `handoff_to_member` | 分配 worker 的动作 |
| `notify_planner` | Worker 完成后的回调 |

**差异分析：**
- Muse 的 Worker 流程是**预定义的**（arch → coder → reviewer），不是 LLM 动态决定
- 这意味着 Muse 目前更像 **Chain + Orchestrator-Worker 的混合体**
- reviewer blocked 时可回溯 → 这是 **Evaluator-Optimizer** 的雏形

### Harness 代码审查发现

1. **`role` 参数没有 enum** — `handoff_to_member` 的 `role` 参数是自由文本，大小写不一致会导致找不到成员
2. **`instructions` 字段说"不生效"** — 让 LLM 困惑
3. **工具太多** — Planner 有 8 个工具，日常只需 3-4 个
4. **Handoff 是单向的** — Worker 挂了没有自动检测/超时机制

---

## §5 HITL 与 S3 审批设计

**HITL (Human-in-the-Loop) 是 Muse S3 审批的理论基础：**

```
Agent → 执行到高风险动作
    → 暂停！生成审批请求
    → 通知人类（Telegram / Web）
    → 人类判断：✅ 批准 / ❌ 拒绝
    → Agent 根据结果继续或回滚
```

Google 定义的触发条件：安全相关 / 成本相关 / 不确定性高

| 维度 | OpenCode Permission | Muse S3 审批 |
|------|-------------------|-------------|
| **粒度** | 工具级（read/write/bash） | 动作级（删数据/部署/大改） |
| **决策者** | 配置文件 + 自动规则 | 人类（Later） |
| **响应方式** | 同步弹窗 | 异步 Telegram |

---

## §6 💼 面试必答

1. **Orchestrator-Worker 和 Parallel 的核心区别是什么？**
   → 子任务是「代码预定义」还是「LLM 动态决定」

2. **Andrew Ng 的 4 Agentic Patterns 是什么？**
   → Reflection, Tool Use, Planning, Multi-Agent

3. **Muse 的 harness 目前是 Chain 还是 Orchestrator-Worker？**
   → 混合体 — 节点顺序是 Chain（预定义），但 Planner 负责决策是 Orchestrator

4. **Handoff 最简实现是什么？**
   → 一个返回 Agent 对象的 Python 函数

5. **HITL 什么时候触发？**
   → 安全、成本、不确定性

---

## §7 ✅ 自检题

- [ ] 能画出 Orchestrator-Worker 的流程图并解释和 Parallel 的区别
- [ ] 能写出 Evaluator-Optimizer 的伪代码
- [ ] 能说出三大厂的 Agent 设计哲学差异
- [ ] 能解释 Muse Harness 在编排模式中的定位

---

*内容合并自 Day02 精读 + Day03 跨厂商对比*
*→ 接下来读 [02b: Swarm 走读 + Handoff](./02b-swarm-handoff.md)*
