# Day 03：OpenAI + Google Agent 模式 + S3 审批设计

> **Sprint 1 · Day 3 · 类型：精读 + Muse 设计 + OpenCode MCP**  
> **学习目标：**  
> ① 掌握 OpenAI Handoff + Google HITL 模式  
> ② 设计 Muse S3 审批流程  
> ③ 理解 OpenCode MCP 配置机制

---

## 📖 Step 1: 跨厂商 Agent 模式对比

### OpenAI Agents SDK 设计哲学

OpenAI 的 Agent 设计有 3 个核心概念：

| 概念 | 解释 | 代码表现 |
|------|------|---------|
| **Agent** | 带 instructions + tools 的 LLM 实例 | `Agent(name="支持", instructions="你是客服...")` |
| **Handoff** | Agent 之间的控制权转移 | `agent.handoff(target_agent)` |
| **Guardrails** | 输入输出校验，防止 Agent 脱轨 | `@input_guardrail` 装饰器 |

#### Handoff 机制详解

```python
# OpenAI Swarm 的 Handoff（Day 4 会拆源码）
def transfer_to_billing():
    """把控制权转交给账单 Agent"""
    return billing_agent  # 就这么简单！返回 agent 就完成了转交

triage_agent = Agent(
    name="分诊员",
    instructions="判断用户问题类型，转给对应专家",
    functions=[transfer_to_billing, transfer_to_tech],  # Handoff 就是普通函数
)
```

**关键洞察：** Handoff 不是特殊 API，**就是一个返回 Agent 对象的普通 Python 函数**。简单到惊人。

### Google ADK 8 种多 Agent 模式

| # | 模式 | 核心思想 | Muse 适用度 |
|---|------|---------|-----------|
| 1 | **Sequential** | A → B → C 顺序执行 | ✅ 已在用 |
| 2 | **Parallel** | 同时执行多个 | 🟡 可用于多文件分析 |
| 3 | **Router** | 根据输入类型分发 | ✅ 已在用 |
| 4 | **Hierarchical** | Manager 管理多个下属 | ✅ Planner 就是 |
| 5 | **HITL** | Human-in-the-Loop | 🔴 **S3 要实现** |
| 6 | **Reflection** | 自我审查改进 | 🟡 Sprint 7 |
| 7 | **Debate** | 多 Agent 辩论取最优 | 后续 |
| 8 | **Consensus** | 投票取共识 | 后续 |

### 🔑 HITL (Human-in-the-Loop) 详解

**这是 Muse S3 审批的理论基础。**

```
Agent → 执行到高风险动作
    → 暂停！生成审批请求
    → 通知人类（Telegram / Web）
    → 人类判断：✅ 批准 / ❌ 拒绝
    → Agent 根据结果继续或回滚
```

Google 定义的 HITL 触发条件：
- **安全相关：** 删除数据、修改权限、部署上线
- **成本相关：** 大量 API 调用、购买资源
- **不确定性高：** Agent 自己不确定的决策

### 跨厂商对比总结

| 维度 | Anthropic (BEA) | OpenAI (Agents SDK) | Google (ADK) |
|------|----------------|--------------------|----|
| **核心理念** | 简单可组合 > 复杂框架 | Handoff 就是函数调用 | 8 种标准模式 |
| **Agent 间通信** | 无官方协议 | 函数返回 Agent | AgentFlow |
| **人类审批** | 未明确 | Guardrails | HITL 模式 |
| **工具设计** | ACI 六原则 | Function Calling | Tool Registration |
| **Muse 借鉴** | 工具设计标准 | Handoff 简洁性 | HITL + Hierarchical |

---

## 🎯 Step 2: Muse S3 审批流程设计

### 流程图

```
用户消息 → Muse pua 理解意图
    → 判断是否高风险
        → 低风险 → 直接执行
        → 高风险 → 触发 S3
            → 生成审批摘要（做什么 / 影响什么 / 风险等级）
            → 发送到 Telegram（带 ✅❌ 按钮）
            → 等待 Later 决策
                → Later 批准 → 继续执行
                → Later 拒绝 → 取消并回复原因
                → 超时（30min） → 自动取消
```

### S3 审批需要哪些 MCP 工具？

| 工具 | 功能 | 对照 |
|------|------|------|
| `request_approval` | 提交审批请求 | Google HITL 的暂停点 |
| `check_approval` | 轮询审批状态 | OpenAI Guardrail 的输出检查 |

### S3 vs OpenCode Permission 对比

| 维度 | OpenCode Permission | Muse S3 审批 |
|------|-------------------|-------------|
| **粒度** | 工具级（read/write/bash） | 动作级（删数据/部署/大改） |
| **决策者** | 配置文件 + 自动规则 | 人类（Later） |
| **响应方式** | 同步弹窗 | 异步 Telegram |
| **可学习的** | auto-permit 插件模式 | 审批规则可以逐步自动化 |

---

## 🔧 OpenCode 机制：MCP 配置深度解读

> **参考：** `learn-opencode/docs/5-advanced/07a-mcp-basics.md`

### MCP 工作原理

```
用户提问 → OpenCode → AI 决定调用 MCP 工具 → MCP 服务器执行 → 返回结果
```

### 配置优先级（重要）

```
~/.config/opencode/opencode.json  ← 全局（最低）
opencode.json                    ← 项目根
.opencode/opencode.json          ← 项目级（最高 ✅）
```

**Muse 的做法：** `start.sh` 启动时动态写入 `families/{family}/{member}/.opencode/opencode.json`，和 OpenCode 推荐的最高优先级路径一致。✅

### MCP 关键配置参数

```jsonc
{
  "mcp": {
    "muse-tools": {
      "type": "local",
      "command": ["node", "src/mcp/index.mjs"],
      "enabled": true,
      "timeout": 30000,     // 默认 30s，Muse 可能需要更长
      "environment": {
        "MUSE_MEMBER": "pua"
      }
    }
  }
}
```

### 🎯 对 Muse 的启发

1. **timeout 需要调大** — Muse 的 MCP 工具（如 handoff_to_member）可能执行时间 > 30s
2. **environment 注入** — 可以通过 MCP 环境变量告诉工具当前是哪个 member，不用在每次 tool call 里传
3. **工具太多的问题** — "MCP 服务器会增加上下文消耗，工具越多 token 消耗越快" — Muse 目前 13+ 工具，要考虑分组

---

## ✏️ Step 3: 沉淀

### 吸收检验

1. Handoff 最简实现是什么？（一个返回 Agent 的函数）
2. HITL 什么时候触发？（安全、成本、不确定性）
3. Muse S3 和 OpenCode Permission 的核心区别？（异步人类 vs 同步规则）

---

*Day 03 完成于 Sprint 1 · 2026-03-28*
