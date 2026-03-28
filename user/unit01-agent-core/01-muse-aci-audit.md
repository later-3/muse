# Day 1 · Step 2 + Step 3：ACI 审计 + 沉淀

> **目标：** 用你今天学到的 ACI 原则审计 Muse 的 3 个 MCP 工具，然后用自己的话沉淀核心概念。  
> **预计时间：** Step 2 (~30min) + Step 3 (~20min) = 50 min  
> **它的意义：** 这是你第一次把「理论」压回「Muse 实战」。不改代码，只列问题和改进建议。

---

## Step 2：🎯 ACI 审计

### 什么是 ACI？

ACI = Agent-Computer Interface（智能体-计算机接口），来自今天精读的 Anthropic BEA。

核心思想：**工具不是给人用的，是给 LLM 用的。** LLM 看到工具的方式和人不一样，所以设计时要「站在模型的角度想」。

### ACI 六原则（你的评分标准）

| # | 原则 | 英文 | 一句话解释 | 怎么评分 |
|---|------|------|-----------|---------|
| 1 | **文档清晰** | Clear Documentation | 工具名和描述能让 LLM 一看就知道什么时候该用 | 描述是否像好同事写的 API 文档？ |
| 2 | **参数防呆** | Foolproof Parameters | 参数名、类型、默认值能防止 LLM 传错 | 有没有 enum？有没有 default？有没有容易传错的参数？ |
| 3 | **减少格式开销** | Minimize Format Overhead | 不要让 LLM 自己拼复杂的 JSON/XML | 参数是不是足够扁平？有没有多余的嵌套？ |
| 4 | **站在模型角度** | Model Perspective | 参数名是模型能理解的语义，不是内部代号 | 参数名有没有歧义？description 够不够直白？ |
| 5 | **给思考空间** | Room to Think | 不要一个工具做太多事，让模型分步调用 | 工具职责单一吗？有没有塞太多功能？ |
| 6 | **防错设计 (Poka-yoke)** | Error Prevention | 防止常见误用，给清晰的错误信息 | 缺必填参数会怎样？传错类型会怎样？ |

### 📋 你要审计的 3 个工具

我已经帮你把这 3 个工具的真实代码找出来了。**你的任务是：读代码 → 用六原则打分 → 列改进建议。**

---

#### 工具 1：`notify_planner`

> **文件：** `src/mcp/callback-tools.mjs`  
> **用途：** Worker 完成任务后通知 Planner

```javascript
{
  name: 'notify_planner',
  description: '任务完成后主动通知 Planner。执行角色（pua/arch/coder/reviewer）完成节点任务后必须调用此工具。',
  inputSchema: {
    properties: {
      instance_id:  { type: 'string', description: '工作流实例 ID（从任务 prompt 的 CONTEXT 中获取）' },
      status:       { type: 'string', enum: ['done', 'blocked', 'failed'], description: '完成状态' },
      summary:      { type: 'string', description: '一句话总结你做了什么' },
      artifact:     { type: 'string', description: '产出文件名（如 task-brief.md）' },
    },
    required: ['instance_id', 'status', 'summary'],
  },
}
```

**🤔 你来打分：**

| 原则 | 得分 (1-5) | 你的理由 |
|------|-----------|---------|
| 1. 文档清晰 | ？ | description 够清楚吗？LLM 知道什么时候该调用吗？ |
| 2. 参数防呆 | ？ | status 用了 enum ✅，instance_id 呢？LLM 从哪知道它的值？ |
| 3. 减少格式开销 | ？ | 参数结构扁平吗？有没有多余的？ |
| 4. 站在模型角度 | ？ | `instance_id` 这个名字 LLM 能理解吗？ |
| 5. 给思考空间 | ？ | 这个工具的职责是否单一？ |
| 6. 防错设计 | ？ | 如果 instance_id 传错了会怎样？有提示吗？ |

**你的改进建议：**
- （写在这里）

---

#### 工具 2：`search_memory`

> **文件：** `src/mcp/memory.mjs`  
> **用途：** 搜索用户相关记忆

```javascript
{
  name: 'search_memory',
  description: '搜索用户相关的记忆。当需要回忆用户偏好、习惯、个人信息、目标或历史事件时调用。\n'
    + 'scope 缩小范围: identity(身份), preference(偏好), goal(目标), general(其他)。',
  inputSchema: {
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      type:  { type: 'string', enum: ['semantic', 'episodic', 'all'], default: 'all', description: '搜索范围' },
      scope: { type: 'string', enum: ['identity', 'preference', 'goal', 'general', 'all'], default: 'all', description: '语义分类过滤' },
      limit: { type: 'number', default: 10, description: '返回数量上限' },
    },
    required: ['query'],
  },
}
```

**🤔 你来打分：**

| 原则 | 得分 (1-5) | 你的理由 |
|------|-----------|---------|
| 1. 文档清晰 | ？ | |
| 2. 参数防呆 | ？ | `type` 和 `scope` 区别清楚吗？LLM 会不会混淆？ |
| 3. 减少格式开销 | ？ | |
| 4. 站在模型角度 | ？ | `semantic` vs `episodic` — LLM 知道选哪个吗？ |
| 5. 给思考空间 | ？ | |
| 6. 防错设计 | ？ | |

**你的改进建议：**
- （写在这里）

---

#### 工具 3：`handoff_to_member`

> **文件：** `src/mcp/planner-tools.mjs`  
> **用途：** Planner 向指定成员分派任务

```javascript
{
  name: 'handoff_to_member',
  description: '向指定 Muse 成员分派当前节点的工作任务。Planner 将节点目标、步骤、约束组装成 prompt 发送给目标成员。',
  inputSchema: {
    properties: {
      instance_id:  { type: 'string', description: '工作流实例 ID' },
      role:         { type: 'string', description: "目标角色（如 'pua', 'coder', 'arch'）" },
      instructions: { type: 'string', description: 'Planner 附加指令（本期保留字段但不生效，后续版本支持注入 extraPrompt）' },
    },
    required: ['instance_id', 'role'],
  },
}
```

**🤔 你来打分：**

| 原则 | 得分 (1-5) | 你的理由 |
|------|-----------|---------|
| 1. 文档清晰 | ？ | |
| 2. 参数防呆 | ？ | `role` 为什么不用 enum？LLM 怎么知道有哪些角色？ |
| 3. 减少格式开销 | ？ | |
| 4. 站在模型角度 | ？ | `instructions` 说「不生效」，LLM 看到会不会困惑？ |
| 5. 给思考空间 | ？ | |
| 6. 防错设计 | ？ | 如果传了不存在的 role 呢？ |

**你的改进建议：**
- （写在这里）

---

### 📊 汇总评分表

填完以上 3 个工具后，汇总到这里：

| 工具 | 文档 | 防呆 | 格式 | 模型视角 | 思考空间 | 防错 | 总分 /30 |
|------|------|------|------|---------|---------|------|---------|
| notify_planner | | | | | | | |
| search_memory | | | | | | | |
| handoff_to_member | | | | | | | |

**总体改进优先级：** （列出最该先改的 3 个问题）

1. 
2. 
3. 

---

## Step 3：✏️ 沉淀

> **规则：** 用你自己的话写。不用很长，但必须是你理解后的输出，不是复制粘贴。

### 问题 1：Agent 和 Workflow 的区别是什么？

**提示：** 想想今天读到的 —
- Agent 的核心循环是什么？（Thought → Action → Observation）
- Workflow 的核心是什么？（预定义的步骤 + 固定的流转）
- 谁来决定下一步做什么？（Agent 自己决定 vs 代码预定义）

> **你的回答：**
> 
> （写在这里，3-5 句话就够）

---

### 问题 2：五种编排模式各适合什么场景？

**提示：** 用一个具体例子说明每种模式什么时候用。

| 模式 | 适合什么场景？（用你自己的话） | 举一个例子 |
|------|--------------------------|----------|
| Prompt Chaining | | |
| Parallelization | | |
| Routing | | |
| Orchestrator-Worker | | |
| Evaluator-Optimizer | | |

> **加分题：** Muse 的 harness 工作流目前最接近哪种模式？为什么？

---

**完成后：** 把这个文件里你填的内容保存好，就是你的 Day 1 沉淀产出。

*产出文件：`01-muse-aci-audit.md`（本文件）*
