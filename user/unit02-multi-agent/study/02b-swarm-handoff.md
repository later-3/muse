# [占位] Swarm 源码走读 + Handoff 机制

> **状态：** [占位] 等待任务指令填充
> **来源：** [G6] `repos/swarm/swarm/core.py`
> **上游：** 02a Orchestrator-Workers
> **下游：** 02c Agent 评估

---

## 大纲

### §0 ⚡ 3 分钟速读版
[TODO]

### §1 Swarm 架构概述
- run() 函数主循环
- Agent 定义 (instructions + functions)
[TODO]

### §2 Handoff 机制（核心）
- 来源: `repos/swarm/swarm/core.py` run() 函数
- 工具返回 Agent 对象 → 自动切换
- 和 Anthropic 显式 Orchestrator 的对比
[TODO]

### §3 Examples 走读
- triage_agent: 路由 + Handoff
- airline: 多级 Handoff
- customer_service: 完整客服系统
[TODO]

### §4 🎯 Muse 映射
[TODO]

### §5 💼 面试必答
[TODO]

### §6 ✅ 自检题
[TODO]
