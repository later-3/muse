# 📚 课程：Agent 编排模式 — 代码精读

> **来源：** [G5] `repos/anthropic-cookbook/patterns/agents/basic_workflows.ipynb`
> **补充：** [G7] `repos/hello-agents/docs/chapter1-2/` + [C6] Andrew Ng
> **上游：** 01a BEA 精读（先理解 5 种模式的理论）
> **下游：** unit02 Orchestrator-Workers
> **OC 关联：** oc04-05 (源码走读) / oc06 (ACI审计)
> **学习目标：** 看完这篇，你能自己写出 chain / parallel / route 三种模式的代码。

---

## 📍 上下文定位

### 主要来源：Anthropic Cookbook

本文的核心代码来自 **Anthropic 官方 Cookbook** 的 Agent 模式章节：

```
repos/anthropic-cookbook/
└── patterns/
    └── agents/
        ├── util.py                         ← 共用基础（LLM 调用 + XML 解析）
        ├── basic_workflows.ipynb           ← 📌 本文精读的 3 种模式
        ├── orchestrator_workers.ipynb      ← unit02 精读
        └── evaluator_optimizer.ipynb       ← unit02 参考
```

如果你没有这个仓库：`cd make-muse/reference && git clone --depth 1 https://github.com/anthropics/anthropic-cookbook.git`

### 补充来源

| 课程 | 对应本文哪段 | 精华摘要在 |
|------|-----------|----------|
| Hello-Agents Ch1-2 | Chain/Parallel 概念对比 | 本文 §五 |
| 吴恩达 Prompt Engineering | `temperature` 参数选择 | `day00/F6-prompt-eng.md` |

---

## 一、基础设施：`util.py`

> **📍 来源：** `anthropic-cookbook/patterns/agents/util.py`
> **作用：** 所有 3 种模式共用的 LLM 调用函数。先搞清楚这个，后面的模式代码才看得懂。

```python
# util.py — 两个函数，是整个 Cookbook 的地基

import os, re
from anthropic import Anthropic

def llm_call(prompt, system_prompt="", model="claude-sonnet-4-6"):
    """最核心的函数：发一条消息给 Claude，拿回一个字符串。
    
    注意几个关键设计：
    - temperature=0.1 → 几乎确定性输出，不是创意写作，而是精确执行任务
    - max_tokens=4096 → 足够长的输出空间
    - 只发一条 user 消息 → 无状态（每次调用都是独立的）
    """
    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model=model,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    return response.content[0].text


def extract_xml(text, tag):
    """从 LLM 输出中提取 XML 标签内容。
    
    为什么用 XML 而不是 JSON？
    → Anthropic 发现 Claude 在生成结构化输出时，XML 的可靠性更高。
    → JSON 容易漏括号/引号，XML 的开闭标签更不容易出错。
    """
    match = re.search(f"<{tag}>(.*?)</{tag}>", text, re.DOTALL)
    return match.group(1) if match else ""
```

### 💡 你要记住的

1. **`llm_call` 是无状态的** — 它没有记忆，每次调用都是全新的。这是 Workflow 的基本特征。
2. **temperature=0.1** — 在 Agent/Workflow 场景里，你要的是可靠执行，不是创意发散。
3. **XML 输出格式** — Anthropic 的官方推荐。比 JSON 更可靠。

---

## 二、模式 1：Prompt Chaining（链式调用）

### 代码

```python
def chain(input: str, prompts: list[str]) -> str:
    """链式调用：每一步的输出自动成为下一步的输入。
    
    数据流：
    input → [Prompt 1] → result1 → [Prompt 2] → result2 → [Prompt 3] → 最终结果
    """
    result = input
    for i, prompt in enumerate(prompts, 1):
        print(f"\nStep {i}:")
        result = llm_call(f"{prompt}\nInput: {result}")
        print(result)
    return result
```

### 用例：从产品报告中提取数据

```python
# 4 步链条：每步做一件小事
data_processing_steps = [
    "提取所有数字和对应的指标名",        # Step 1: 提取
    "把所有数字转换成百分比格式",         # Step 2: 标准化
    "按数值从高到低排序",               # Step 3: 排序
    "格式化成 Markdown 表格",           # Step 4: 美化
]

report = """
Q3 Performance Summary:
Our customer satisfaction score rose to 92 points this quarter.
Revenue grew by 45% compared to last year.
Market share is now at 23% in our primary market.
Customer churn decreased to 5% from 8%.
New user acquisition cost is $43 per user.
Product adoption rate increased to 78%.
Employee satisfaction is at 87 points.
Operating margin improved to 34%.
"""

# 执行：report 经过 4 步变成整洁的表格
formatted_result = chain(report, data_processing_steps)
```

### 执行过程可视化

```
原始报告文本
     ↓ Step 1: "提取数字"
"92: customer satisfaction
 45%: revenue growth
 23%: market share ..."
     ↓ Step 2: "转百分比"
"92%: customer satisfaction
 45%: revenue growth ..."
     ↓ Step 3: "排序"
"92%: customer satisfaction
 87%: employee satisfaction
 78%: product adoption ..."
     ↓ Step 4: "做成表格"
| Metric | Value |
|:--|--:|
| Customer Satisfaction | 92% |
| Employee Satisfaction | 87% |
| ...                   | ... |
```

### 🔑 Chain 的核心设计原则

| 原则 | 解释 | 为什么重要 |
|------|------|-----------|
| **每步只做一件事** | 提取 / 转换 / 排序 / 格式化 各自独立 | LLM 做一件事的可靠性远高于做四件事 |
| **步骤间可以设 Gate** | 检查中间输出，不合格就停止 | 像流水线的质检站，越早发现问题越好 |
| **可追踪 / 可调试** | 每步都 print，出错知道是哪步 | 做了 4 次 `llm_call`，比做 1 次长 prompt 更可观测 |

### 🎯 Muse 映射

**Muse 的 harness 工作流就是一个 Chain：**

```
用户需求 → [Planner 分解] → [Arch 分析] → [Coder 编码] → [Reviewer 审查] → 交付
```

每个角色就是 Chain 里的一个 Step。Planner 的输出是 Arch 的输入，Arch 的输出是 Coder 的输入。

---

## 三、模式 2：Parallelization（并行化）

### 代码

```python
def parallel(prompt: str, inputs: list[str], n_workers: int = 3) -> list[str]:
    """并行调用：用同一个 prompt 同时处理多个不同输入。
    
    数据流：
         ┌→ [LLM + input1] → result1
    prompt┤→ [LLM + input2] → result2
         └→ [LLM + input3] → result3
    """
    with ThreadPoolExecutor(max_workers=n_workers) as executor:
        futures = [
            executor.submit(llm_call, f"{prompt}\nInput: {x}") 
            for x in inputs
        ]
        return [f.result() for f in futures]
```

### 用例：多利益相关方影响分析

```python
# 4 组不同的利益相关方，同时分析
stakeholders = [
    "Customers: 价格敏感 / 想要更好的技术 / 环保诉求",
    "Employees: 工作安全担忧 / 需要新技能 / 需要明确方向",
    "Investors: 期望增长 / 要控制成本 / 风险担忧",
    "Suppliers: 产能限制 / 价格压力 / 技术转型",
]

# 同一个 prompt，4 个输入，同时发出
results = parallel(
    "分析市场变化将如何影响这个利益相关方群体。提供具体影响和建议行动。",
    stakeholders,
)
```

### 🔑 Parallel 的核心设计原则

| 原则 | 解释 | 为什么重要 |
|------|------|-----------|
| **各路独立** | 4 个 LLM 调用互不影响 | Customer 的分析不会被 Investor 的上下文干扰 |
| **同一个 Prompt** | 都用一样的分析框架 | 保证输出格式一致，方便后续汇总 |
| **速度是次要的** | 主要好处不是快（虽然确实快），而是**隔离** | 串行时 LLM 容易被前面的内容影响后面的判断 |

### 💡 这是 BEA 论文没讲清楚的

BEA 论文讲了两种并行化：
1. **Sectioning**（本节课这种）— 同一个任务拆成多个独立子任务
2. **Voting** — 同一个任务重复做多次，取多数结果

Cookbook 只实现了 Sectioning。Voting 用于需要高可靠性的场景（比如代码审查：让 3 个 LLM 各自审一遍，2/3 说有 bug 才算有 bug）。

### 🎯 Muse 映射

**Muse 可以并行的地方：**
- Arch 分析多个文件时 → 每个文件独立分析 → 最后合并
- 多个 Reviewer 同时审查同一份代码 → 取共识

---

## 四、模式 3：Routing（路由分发）

### 代码

```python
def route(input: str, routes: dict[str, str]) -> str:
    """路由：先用 LLM 判断输入类型，再走对应的专家路径。
    
    数据流：
    input → [LLM 分类器] → "billing"  → [账单专家 Prompt] → 专业回复
                          → "technical" → [技术专家 Prompt] → 专业回复
                          → "account"   → [账号专家 Prompt] → 专业回复
    """
    # Step 1: 让 LLM 判断这个输入该走哪条路
    selector_prompt = f"""
    Analyze the input and select the most appropriate support team 
    from these options: {list(routes.keys())}
    
    First explain your reasoning, then provide your selection:
    <reasoning>为什么选这个团队</reasoning>
    <selection>团队名称</selection>
    
    Input: {input}""".strip()

    route_response = llm_call(selector_prompt)
    
    # Step 2: 提取分类结果（用 XML，不用 JSON！）
    reasoning = extract_xml(route_response, "reasoning")
    route_key = extract_xml(route_response, "selection").strip().lower()
    
    # Step 3: 用对应的专家 prompt 处理原始输入
    selected_prompt = routes[route_key]
    return llm_call(f"{selected_prompt}\nInput: {input}")
```

### 用例：客服工单路由

```python
# 4 条专家路径，每条有自己的专业 prompt
support_routes = {
    "billing": """你是账单支持专家。规则：
    1. 先确认具体的账单问题
    2. 清晰解释收费或差异
    3. 列出具体的下一步和时间线
    4. 如相关，提供支付选项""",
    
    "technical": """你是技术支持工程师。规则：
    1. 列出解决问题的精确步骤
    2. 包含系统要求
    3. 提供常见问题的临时方案
    4. 最后给出升级路径""",
    
    "account": """你是账户安全专家。规则：
    1. 优先账户安全和验证
    2. 清晰的账户恢复步骤
    3. 包含安全提示和警告
    4. 设定明确的解决时间预期""",
    
    "product": """你是产品专家。规则：
    1. 聚焦功能教育和最佳实践
    2. 包含具体使用示例
    3. 链接到相关文档
    4. 推荐可能有帮助的相关功能""",
}

# 测试：这封邮件应该路由到哪里？
ticket = """
Subject: 我的卡上有一笔意外扣费
Message: 你好，我刚发现信用卡上有一笔 $49.99 的扣费，
但我订的是 $29.99 的套餐。能解释一下吗？
"""

response = route(ticket, support_routes)
# LLM 会先判断这是 "billing" → 然后用账单专家 prompt 处理
```

### 🔑 Route 的核心设计原则

| 原则 | 解释 | 为什么重要 |
|------|------|-----------|
| **分类器和处理器分离** | 用一个 LLM 判断类型，用另一个 LLM 处理 | 分类器可以用小模型（便宜快），处理器用大模型（质量高） |
| **专家 prompt 独立** | 每条路径有定制化的 system prompt | 比一个通用 prompt 做所有事效果好得多 |
| **分类器给推理过程** | 要求写 `<reasoning>` | 可调试 — 路由错了能看到为什么分错 |

### 🎯 Muse 映射

**Muse 的场景分发就是 Routing：**

```
用户消息 → [LLM 意图识别]
    → "闲聊" → pua 直接回复
    → "下任务" → planner 启动 harness 工作流
    → "审批请求" → S3 审批流程
    → "查记忆" → 直接调 search_memory
```

目前 Muse 的路由是写在代码里的（if/else），不是 LLM 做的。BEA 的建议是：**简单分支用代码，复杂或模糊的分支用 LLM 路由。**

---

## 五、三种模式的对比总结

```
Chain:     A → B → C → D        (流水线，顺序执行)
Parallel:  A → [B1, B2, B3] → C (岔路，同时执行，汇合)
Route:     A → 分类 → B 或 C 或 D (选路，走一条)
```

| 维度 | Chain | Parallel | Route |
|------|-------|----------|-------|
| **什么时候用** | 任务有明确的前后依赖 | 多个子任务互不影响 | 不同类型的输入需要不同处理 |
| **LLM 调用次数** | N 次（N=步骤数） | N 次（N=子任务数） | 2 次（分类+处理） |
| **可组合性** | Chain 的步骤可以是 Parallel | Parallel 的输出可以再 Chain | Route 的每条路里可以嵌 Chain |
| **Muse 对应** | harness 工作流 | 多文件分析 | 意图识别 |

---

## 六、🧪 动手练习（选做）

如果你想亲手跑一遍：

```bash
cd make-muse/reference/anthropic-cookbook/patterns/agents
export ANTHROPIC_API_KEY="你的key"
# 用 jupyter 打开
jupyter notebook basic_workflows.ipynb
# 或者直接用 python 跑示例
python3 -c "from util import llm_call; print(llm_call('Hello, who are you?'))"
```

如果没有 API Key 也没关系 — **读代码 + 理解流程**比跑 demo 更重要。

---

## 七、其他课程怎么讲这些模式

> 不只有 Anthropic 一家在讲 Agent 编排。以下是其他优质课程的精华对比。完整摘要在 `day00/` 对应文件。

### Hello-Agents (Datawhale) — Ch1-2

```
核心差异: 用中文 + 更贴近国内工程实践
Chain: 强调"链条越短越好"，每个环节的失败率会累乘 → P(成功) = 0.95^n
Parallel: 额外讲了 MapReduce 模式 — 先 Map(拆) → 各自执行 → Reduce(合)
亮点: 有从零构建 Agent 的完整代码（Python），不依赖 LangChain
```

### 吴恩达 — Building with LLMs (DeepLearning.AI)

```
核心差异: 更关注工程实践和 prompt 优化
Chain: 强调用"分类器"在链条中做质检（Gate），而不是盲目串联
Route: 强调"evaluation-driven routing" — 先评估 → 再路由，不是先路由 → 再评估
关键洞察: "Start with the simplest solution. Only add complexity when needed."
```

### HuggingFace Agents Course — Unit 1

```
核心差异: 框架无关，讲原理
链式调用: 强调"工具链"概念 — 每个工具的输出自动变成下个工具的输入
路由: 用 ReAct 模式做动态路由，不是预定义路由表
亮点: 用 smolagents 库演示，非常轻量
```

### 对同一模式的多角度对照

| 模式 | Anthropic (本文) | Hello-Agents | 吴恩达 | HuggingFace |
|------|-----------------|-------------|--------|-----------|
| **Chain** | `for step in steps: result = llm_call(step + result)` | 强调失败率累乘风险 | 加 Gate 质检 | 工具链自动串联 |
| **Parallel** | `ThreadPoolExecutor` 同时发 | MapReduce 模式 | — | — |
| **Route** | LLM分类器 + XML | — | 评估驱动路由 | ReAct 动态路由 |

> 详细精华在各 `day00/FX-*.md` 中。本文只做对比速览。

---

*课程笔记完成于 Sprint 1 Day 1 · 2026-03-28*
