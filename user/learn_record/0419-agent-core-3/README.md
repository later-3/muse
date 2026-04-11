# D12 — N10 Agent 核心 (3/3)

> **日期：** 2026-04-19（Sat）
> **路线图位置：** Week 2 · Day 12 · N10 Agent 核心（第 3 天，共 3 天）
> **定位：** 🟥 精通级（今天 1.5h = 30min 理论 + 60min 实践）

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **BEA 的 5 种编排模式各适用什么场景？** 能给每种模式举一个真实产品的例子
2. **怎么做 ACI 审计？** 拿到一个 Agent 的工具列表，你会检查什么？
3. **D10-D12 三天的 Agent 知识怎么串起来？** 从概念到工具到编排，完整的 Agent 设计路径

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（编排模式深入） | 30min | [ ] |
| 2 | 📖 复习 → `unit01-agent-core/study/01b-study-anthropic-bea-projects.md` | 10min | [ ] |
| 3 | 📂 oc06 ACI 审计（见下方实践任务） | 50min | [ ] |
| 4 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 以下是 AI 从 吴恩达 Agentic AI Module 3 + Anthropic BEA 深读 + 开源项目分析中提炼。
> 今天聚焦：**5 种编排模式的深入对比 + ACI 审计实战 + Agent 设计决策树**。

### 🧩 5 分钟预备词汇表

| 词 | 一句话解释 | 今天先怎么理解 | 暂时不用深究 |
|---|---|---|---|
| **Prompt Chaining** | 输出 A → 输入 B 的固定流水线 | 像工厂流水线，每站做一件事 | 和 LangChain 的关系 |
| **Routing** | 根据输入分类走不同路径 | 像客服分流："技术问题按1，退款按2" | 路由模型的训练 |
| **Parallelization** | 多个 LLM 调用并行 | 同一个问题同时让 3 个"专家"分析 | 结果合并策略 |
| **Orchestrator-Workers** | 一个规划者 + 多个执行者 | 项目经理分活给工程师 | 子任务依赖管理 |
| **Evaluator-Optimizer** | 生成 → 评估 → 优化循环 | 写作文 → 老师批改 → 重写 | 收敛条件设计 |

### BEA 5 种编排模式深入对比

> 📖 基础概念已在 → `unit01-agent-core/study/01a-study-anthropic-bea.md`
> 今天聚焦**选型决策**和**真实案例**。

#### 模式 1：Prompt Chaining ⭐

[Fact] 最简单的编排 — 任务被分解成**固定的**步骤序列。

```
Input → [Step 1: 翻译] → [Step 2: 摘要] → [Step 3: 格式化] → Output
```

**适用场景：**
- 每步的输入输出格式明确
- 步骤固定不需要动态调整
- 需要在中间步骤加"门控"（检查质量再继续）

**真实案例：** 翻译管线 — 原文 → 翻译 → 回译验证 → 修正

**Muse 中的体现：** System Prompt 组装 = 多步 Chaining（加载 Identity → 加载 Memory → 组装最终 Prompt）

#### 模式 2：Routing ⭐⭐

[Fact] 根据输入**分类**，走不同的处理路径。

```
Input → [分类器] → 技术问题 → [技术 Agent]
                  → 退款请求 → [退款 Agent]
                  → 闲聊    → [普通回复]
```

**适用场景：**
- 输入类型差异大，需要不同的处理逻辑
- 不同类型需要不同的 System Prompt 或不同的工具集

**真实案例：** 客服系统 — 先识别意图，再路由到对应处理流

**关键限制：** 分类器的准确率是瓶颈 — 分类错了后续全错

#### 模式 3：Parallelization ⭐⭐

[Fact] 同一个输入**并行**交给多个 LLM 处理。两种变体：

**Sectioning（分段）：** 把一个大任务拆成独立的子任务并行执行
```
"分析这篇文章" → 并行 → [语法检查] + [事实核查] + [风格评估] → 合并
```

**Voting（投票）：** 同一个问题让多个模型回答，取共识
```
"这段代码有 bug 吗?" → 3 个 LLM 独立回答 → 多数同意才算有 bug
```

**真实案例：** 代码审查 — 安全审计 + 性能分析 + 风格检查并行

#### 模式 4：Orchestrator-Workers ⭐⭐⭐

[Fact] 一个 **Orchestrator** 负责规划和分配，多个 **Worker** 负责执行。

```
User 输入 → [Orchestrator: 分析任务，拆分子任务]
              → Worker 1: 搜索相关论文
              → Worker 2: 分析代码
              → Worker 3: 生成图表
           → [Orchestrator: 收集结果，综合回答]
```

**适用场景：**
- 复杂任务需要**动态分解**（不能预先确定步骤）
- 子任务之间有依赖关系需要协调
- 需要根据中间结果调整计划

**真实案例：**
- Aider（AI 编程）：Orchestrator 分析需求 → Workers 修改各个文件
- Devin（AI 工程师）：规划 → 编码 → 测试 → 调试循环

**和 Prompt Chaining 的区别：** Chaining 是固定步骤，Orchestrator-Workers 的步骤是**动态生成**的。

#### 模式 5：Evaluator-Optimizer ⭐⭐⭐⭐

[Fact] 生成-评估-优化的迭代循环。

```
[Generator: 生成方案] → [Evaluator: 打分/评估] → 分数够高? → 输出
                                                   ↓ 不够
                                               [Generator: 根据反馈重新生成]
```

**适用场景：**
- 有明确的质量标准可以量化评估
- 允许多次迭代（时间/成本不是最大约束）
- 需要达到特定质量门槛

**真实案例：** 代码生成 — 生成代码 → 运行测试 → 不通过 → 修改 → 再测试

### Agent 设计决策树

[Fact] Anthropic 的核心原则 — **从简单开始，只有需要时才加复杂度**：

```
你的任务需要 Agent 吗?
├── 一次 LLM 调用就能解决? → 不要用 Agent，直接调用
├── 需要固定的多步处理? → Prompt Chaining
├── 输入类型多，需要分流? → Routing
├── 可以拆成独立子任务? → Parallelization
├── 需要动态规划和协调? → Orchestrator-Workers
└── 需要迭代优化到高质量? → Evaluator-Optimizer
```

> "Start with the simplest solution. Every layer of complexity you add has costs."

### ACI 审计实战 — 怎么审一个 Agent 的工具

[Fact] ACI 审计的检查清单：

**1. 命名审计**
```
✅ search_web — 动词+宾语，清晰
✅ read_file — 动作明确
❌ process — 太模糊
❌ handle_request — LLM 不知道"handle"是什么
```

**2. 描述审计**
```
✅ "搜索互联网获取最新信息。当用户问实时数据时使用。" — 包含使用条件
❌ "搜索" — 太短，LLM 不知道什么时候用
❌ 描述中有技术术语 LLM 不理解的
```

**3. 参数审计**
```
✅ 参数 ≤ 5 个，每个有描述
❌ 参数 > 10 个，LLM 必然出错
❌ 有隐含参数（需要知道内部状态才能填）
```

**4. 错误返回审计**
```
✅ "文件不存在: /path/to/file。可尝试: list_files(dir)" — 指导下一步
❌ "Error 404" — LLM 无法理解
❌ 不返回错误，静默失败
```

**5. 覆盖率审计**
```
有 read_file 但没有 list_files → Agent 不知道有哪些文件可读
有 search_web 但没有 read_url → 搜到链接不能读内容
→ 工具之间要形成闭环
```

### D10-D12 三天知识串联

```
D10: WHY  — Agent 是什么？为什么需要它？
     └— LLM + 工具 + 循环 = Agent
     └— ReAct: Reason → Action → Observe
     └— Weng: Planning / Memory / Action

D11: HOW  — 工具怎么实现？怎么防错？
     └— Function Calling 4步流程
     └— ACI 设计原则
     └— 4种失败模式 + 防御

D12: WHAT — 用哪种模式？怎么审计？ ← 今天
     └— BEA 5种编排模式 + 决策树
     └— ACI 审计 5步检查清单
     └— 从简单开始的设计哲学
```

### 📜 原文对照

| 📄 原文 | 🗣 大白话 |
|---------|----------|
| "Start with the simplest solution." — Anthropic BEA | 能用 Prompt Chaining 解决的就别搞 Orchestrator |
| "Every layer of complexity has costs." — Anthropic BEA | 复杂度不是免费的 — 调试难度、失败率、延迟都会增加 |
| "Agent frameworks can help... but they often create extra abstractions." — Anthropic BEA | 框架有帮助但也有代价 — 理解底层比依赖框架更重要 |

### 🎤 面试追问链

```
Q1: 如果让你设计一个客服 AI Agent，你会用什么架构？
→ 你答: Routing + Prompt Chaining。先用分类器路由到不同处理流（退款/技术/投诉），每个流内用 Chaining 按步骤处理。
  Q1.1: 如果需要处理非常复杂的技术问题呢？
  → 你答: 技术流内升级到 Orchestrator-Workers。Orchestrator 分析问题 → Workers 分别查文档/搜日志/查代码 → Orchestrator 综合回答。
    Q1.1.1: 怎么确保回答质量？
    → 你答: 加 Evaluator 层。生成回答后，用另一个 LLM 评估是否完整回答了用户问题。不满意就再生成。

Q2: 审计一个 Agent 的工具定义，你会检查什么？
→ 你答: 5步：命名（动词+宾语）→ 描述（含使用条件）→ 参数（≤5个）→ 错误返回（能指导下一步）→ 覆盖率（工具间闭环）
```

### 这几个概念不要混

- **Prompt Chaining ≠ Orchestrator-Workers**：Chaining 是固定步骤，Orchestrator 是动态规划
- **Parallelization ≠ Multi-Agent**：Parallelization 是同一个 Agent 并行调多个 LLM；Multi-Agent 是多个独立 Agent 协作
- **Routing ≠ Orchestrator**：Routing 是一次性分类分流；Orchestrator 持续协调子任务
- **Evaluator ≠ 测试**：Evaluator 是 LLM 做的定性评估；测试是代码做的确定性检查

### 关键概念清单

- [ ] **5 种编排模式**：名字 + 适用场景 + 各一个例子
- [ ] **决策树**：什么时候用哪种模式
- [ ] **从简到繁的原则**："Start with the simplest solution"
- [ ] **ACI 审计 5 步**：命名 / 描述 / 参数 / 错误返回 / 覆盖率
- [ ] **D10-D12 串联**：WHY → HOW → WHAT 的三层结构
- [ ] **Orchestrator-Workers vs Prompt Chaining**：固定 vs 动态的本质区别
- [ ] **完成 oc06 ACI 审计**：能说出 Muse 的工具定义哪里好/哪里需改进

---

## 🔧 实践任务：oc06 ACI 审计

> 📂 已有文件，去看 → `unit01-agent-core/oc-tasks/L3-analyze/oc06-aci-audit.md`

**USOLB 标注：** `[S] 源码` `[O] 观察` `[L] 日志` `[B] 编译`

**任务说明：**
1. 阅读 oc06 文档，理解 ACI 审计的方法论
2. 列出 Muse 当前注册的所有 MCP 工具
3. 用今天学的 5 步检查清单审计每个工具
4. 输出审计报告：哪些做得好 / 哪些需要改进

**和今天理论的联系：**
- 这是 ACI 设计原则的**实际应用** — 你在审计自己的 Agent 的工具质量
- 审计结果直接可以改进 Muse 的工具定义

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 链接 | 看什么 |
|------|------|--------|
| 吴恩达 M3 | https://www.deeplearning.ai/courses/agentic-ai/ | Module 3: 编排模式 |
| Anthropic BEA | https://www.anthropic.com/research/building-effective-agents | "When to use agents" 部分 |

> 📖 **优先读已有 study 文档：**
> - `unit01-agent-core/study/01a-study-anthropic-bea.md` — BEA 精读 ✅
> - `unit01-agent-core/study/01b-study-anthropic-bea-projects.md` — 开源项目分析 ✅
> - `unit01-agent-core/study/01-muse-aci-audit.md` — ACI 审计方法 ✅

---

## 🧠 与 Muse/项目 的映射

- **本地代码实际做的事：**
  - Muse 当前是 **单 Agent + Tool Use** 模式 — 最简单的编排
  - `src/core/orchestrator.mjs` — 名字虽叫 orchestrator，但目前是单 Agent 循环
  - `src/mcp/` — 这里注册的工具就是你今天要审计的对象
- **远端模型/外部系统做的事：**
  - LLM 根据工具列表做编排决策（选哪个工具、什么顺序调用）
- **设计启示：**
  - Muse 未来如果要支持多 Agent → 才需要真正的 Orchestrator-Workers 模式
  - 当前阶段遵循 BEA 的"从简单开始" — 先做好单 Agent 的工具质量

---

## ✅ 自检清单

- [ ] **能列出 5 种编排模式并各举一个例子**
- [ ] **能画出 Agent 设计决策树**：判断什么场景用什么模式
- [ ] **能做 ACI 审计**：5 步检查清单能应用于任意 Agent
- [ ] **能区分 Chaining / Routing / Orchestrator**：固定步骤 / 分类分流 / 动态规划
- [ ] **能串联 D10-D12**：WHY(概念) → HOW(工具) → WHAT(编排)
- [ ] **完成 oc06**：输出 Muse 工具的审计报告

### 面试题积累（2 题）

**Q1: 请比较 Prompt Chaining 和 Orchestrator-Workers 的区别，各适用什么场景？**

> 你的回答：___
>
> 参考：Chaining=固定步骤流水线（翻译管线），Orchestrator-Workers=动态规划+分配（复杂研究任务）。核心区别：步骤是否预先确定。

**Q2: 给你一个 Agent 的 20 个工具定义，你怎么审计？**

> 你的回答：___
>
> 参考：5步审计法：1)命名（动词+宾语） 2)描述（含使用条件） 3)参数（≤5个） 4)错误返回（指导下一步） 5)覆盖率（工具间闭环）。20个工具偏多，考虑分组或二级路由。

---

## 📝 学习笔记

✅ 理论:
✅ 关键洞察:
❓ 问题:
💡 映射:
