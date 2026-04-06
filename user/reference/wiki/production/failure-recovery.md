# 失败模式与恢复

> **一句话定义**: Agent 系统的失败模式远比传统软件复杂——不仅有代码层面的异常，还有模型幻觉、上下文丢失、工具链断裂、多 Agent 死锁等 AI 特有的失败。理解这些模式是构建可靠 Agent 的前提。

## 核心原理

### Agent 失败的五个层次

```
Level 5: 多 Agent 级    ← 协作死锁 / 级联故障 / 资源竞争
Level 4: 计划级         ← 目标漂移 / 无限循环 / 步骤遗漏
Level 3: 上下文级       ← 信息丢失 / 中间遗忘 / 压缩损坏
Level 2: 工具级         ← API 超时 / 权限不足 / 返回格式错误
Level 1: 模型级         ← 幻觉 / 拒绝回答 / token 用尽
```

### Level 1: 模型级失败

| 失败模式 | 表现 | 恢复策略 |
|---------|------|---------|
| **幻觉** | 模型编造不存在的工具/API | 工具列表白名单 + 输出验证 |
| **拒绝回答** | 过度保守的安全过滤 | 调整 prompt + 降低 safety 敏感度 |
| **token 用尽** | max_tokens 耗尽，回复截断 | 检测截断 + 自动续写 |
| **格式错误** | 工具调用参数不合 schema | 重试 + 更详细的参数描述 |
| **model drift** | 模型更新后行为变化 | 离线评估 + 回归测试 |

### Level 2: 工具级失败

learn-claude-code s02 的 safe_path 模式展示了工具安全（详见 [[tool-use-mcp]] 的“路径安全: safe_path 模式”一节）。

**常见工具故障**：

| 故障 | 检测方式 | 恢复方式 |
|------|---------|---------|
| API 超时 | timeout 参数 (300s) | 重试 + fallback 到备用服务 |
| 权限不足 | 错误码检查 | 提示用户 + 降级到只读模式 |
| 结果过大 | 截断到 50000 字符 | 分页 + 摘要 |
| 工具不存在 | dispatch map 查找失败 | 错误消息返回 + 引导模型用其他工具 |

### Level 3: 上下文级失败

详见 [[context-engineering]] 的“四种上下文失败模式”一节。在失败恢复的语境下，补充两个额外的模式：

| 失败模式 | 症状 | 原因 |
|---------|------|------|
| **Context Stale** | 使用过时信息 | 缓存未更新 |
| **Context Leakage** | 泄露敏感信息 | 未清理前序对话的隐私数据 |

**恢复策略** (learn-claude-code s06)：
```
三层压缩:
1. 截断: 删除最旧的消息
2. 摘要: LLM 将历史压缩为摘要
3. 重置: 保留系统提示，丢弃所有对话
```

### Level 4: 计划级失败

| 失败模式 | 表现 | 来源 |
|---------|------|------|
| **目标漂移** | Agent 偏离原始任务 | s03: nag 提醒缺失 |
| **无限循环** | 重复执行相同步骤 | 缺少最大轮数限制 |
| **步骤遗漏** | 跳过必要步骤 | 任务依赖未建模 |
| **规划过深** | 生成过多无用子任务 | 子代理层数无限制 |

**恢复策略**：

```python
# s03: "一次只做一件事" 约束
if in_progress_count > 1:
    raise ValueError("Only one task can be in_progress")

# s04: 禁止递归生成子代理
PARENT_TOOLS = CHILD_TOOLS + [task_tool]  # 只有父级有 task
# 子代理没有 task 工具, 无法再生成子代理

# s07: 任务图 DAG 自动解锁
def _clear_dependency(self, completed_id):
    # 完成一个任务 → 自动解锁所有下游任务
```

### Level 5: 多 Agent 级失败

| 失败模式 | 表现 | 来源 |
|---------|------|------|
| **文件冲突** | 两个 Agent 同时修改同一文件 | s12: 没有 worktree 隔离 |
| **消息风暴** | Agent 间无限互相通知 | s10: 缺少协议终止条件 |
| **角色模糊** | Agent 越权执行其他角色的工作 | Identity 边界不清 |
| **级联崩溃** | 一个 Agent 失败导致所有 Agent 停滞 | 缺少 fallback 机制 |

**恢复策略** (ai-agents-for-beginners L06)：
- **Docker 沙箱**：限制 Agent 只在容器内运行
- **Fallback 机制**：LLM A 不可用时切换到 LLM B
- **重试 + 降级**：重试 3 次后降级到更简单的处理方式
- **Circuit Breaker**：连续失败超过阈值后自动熔断

### 持久化恢复 (Crash Recovery)

s07 和 s12 共同定义了 Agent 崩溃后的恢复策略：

```
Agent 崩溃前:
  .tasks/task_1.json    → status: "in_progress"
  .worktrees/index.json → auth-refactor: active

Agent 重启后:
  1. 扫描 .tasks/ 目录 → 重建任务状态
  2. 扫描 .worktrees/index.json → 重建环境状态
  3. 对话记忆丢失（volatile），但文件状态完好（durable）
  4. 从磁盘状态恢复 → 继续执行
```

**核心原则**：对话上下文是 volatile 的，磁盘状态是 durable 的。设计 Agent 时要确保所有关键状态都持久化到磁盘。

### 防御性设计清单

| 类别 | 措施 | 实现位置 |
|------|------|---------|
| **输入防护** | 路径安全检查 | s02: safe_path |
| **输出限制** | 截断过长结果 | s02: str[:50000] |
| **计划保持** | Nag 提醒注入 | s03: rounds_since_todo |
| **上下文保护** | 子代理隔离 | s04: 独立 messages |
| **执行安全** | 最大轮数限制 | s04: range(30) |
| **状态持久化** | 任务文件化 | s07: .tasks/ |
| **并发安全** | 线程锁 + 通知队列 | s08: threading.Lock |
| **协议安全** | FSM + request_id | s10: 状态机 |
| **环境隔离** | Git Worktree | s12: 独立目录 |

## 来源覆盖

| 来源 | 章节 | 覆盖深度 | 关键贡献 |
|------|------|---------|---------|
| [learn-claude-code](../../repos/learn-claude-code/docs/en/s02-tool-use.md) | s02-s12 | ⭐⭐⭐ | 每层对应一种失败恢复 |
| [ai-agents-for-beginners](../../repos/ai-agents-for-beginners/06-building-trustworthy-agents/README.md) | L06 + L10 + L12 | ⭐⭐⭐ | 威胁模型 + 上下文失败 |
| [swarm](../../repos/swarm/README.md) | 错误处理 | ⭐ | 简洁的 Handoff 错误处理 |

## 概念间关系

- **前置概念**: [[agent-definition]] (循环是所有失败发生的地方)
- **相关概念**: [[observability]] (检测失败) / [[harness-architecture]] (每层都是一种防御)
- **实践概念**: [[context-engineering]] (Level 3 的失败和恢复)

## 开放问题

1. **自愈 Agent**：Agent 能否自动检测并修复自己的失败模式？Meta-cognition (L09) 方向
2. **失败预测**：能否通过历史 trace 模式预测即将发生的失败？
3. **优雅降级**：用户体验角度，Agent 失败时应该怎么沟通？静默重试还是告知用户？
4. **多 Agent 事务**：多个 Agent 的操作如何保证原子性？需要 2PC 这样的协议吗？
