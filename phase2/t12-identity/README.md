# T12: Identity → AGENTS.md

> **第一批 原生基座** — 与 T10/T10.5/T11 并行
> **详细方案**: [context.md](./context.md)

## 定位

**T12 是 Muse 人格的原生化** — 将人格从 Phase 1 的运行时手动注入迁移到 OpenCode 原生 AGENTS.md 机制。

- **是**：Muse 身份和人格的唯一权威来源
- **是**：OpenCode 自动注入到每个 session 的 system prompt
- **不是**：场景策略 (→ T10 Skill)
- **不是**：运行时动态信息注入 (→ T10.5 Hook)
- **不是**：能力定义 (→ T11 MCP)

### 优先级层级

```
AGENTS.md (身份/人格/全局规则)     ← T12 ← 本任务 (最高优先级)
    ↓
Skill (场景策略)                   ← T10 ✅
    ↓
Plugin Hook (生命周期拦截)         ← T10.5
    ↓
MCP / Custom Tool (能力实现)       ← T11 ✅
```

## 背景

Phase 1 的人格注入是手动拼接:
```javascript
// orchestrator.mjs — Phase 1 硬编码
const enriched = identity.buildSystemPrompt() + '\n\n' + text
```

**问题**:
1. 每条消息都手动拼接 system prompt，效率低
2. 人格和项目说明混在一起 (当前 AGENTS.md 是项目 README)
3. OpenCode 原生的 instruction 机制被浪费了
4. session 级注入导致 token 浪费

## 与其他任务的关系

| 任务 | 关系 | 边界 |
|------|------|------|
| **T10** Skill ✅ | Skill 明确"人格由 AGENTS.md 定义" | AGENTS.md 定人格，Skill 定策略 |
| **T10.5** Hook | `chat.system.transform` 注入动态信息 | AGENTS.md 不含动态信息 (时间等) |
| **T11** Memory MCP ✅ | AGENTS.md 提醒 AI 可用哪些 MCP 工具 | 列可用工具，不重复工具文档 |
| **T13** Orchestrator | T12 完成后删 `buildSystemPrompt()` 注入 | AGENTS.md 接手，Orchestrator 瘦身 |

## 目标

### 子任务

| # | 交付物 | 说明 |
|---|--------|------|
| I1 | AGENTS.md 生成器 | `identity.json` → AGENTS.md 内容生成 |
| I2 | AGENTS.md 重写 | 项目根目录 AGENTS.md 从 README → 人格 + 项目上下文 |
| I3 | Web 驾驶舱更新触发 | Web 改身份 → 重新生成 AGENTS.md |
| I4 | Orchestrator 去注入 | 删 `buildSystemPrompt()` 手动拼接 (与 T13 协调) |
| I5 | 验证: 不膨胀 | session 中 system prompt 不重复包含人格 |
| I6 | 测试 | unit + E2E |

## 验收 (三层验证)

| 层 | # | 标准 | 验证方式 |
|----|---|------|---------|
| **文件层** | 1 | AGENTS.md 包含人格定义 | unit test 检查内容结构 |
| **注入层** | 2 | OpenCode 读取 AGENTS.md 注入 system prompt | E2E `--print-logs` |
| **行为层** | 3 | AI 按 AGENTS.md 人格回复 (口吻/风格) | E2E 对话验证 |
| 一致性 | 4 | identity.json 修改 → AGENTS.md 自动更新 | 集成测试 |
| 不膨胀 | 5 | 手动 buildSystemPrompt() 不再注入 | E2E 检查消息内容 |

### 验证边界

| ✅ T12 自身闭环 | ⏳ 待后续联动 |
|-----------------|-----------------|
| AGENTS.md 内容正确 | T13: 删 Orchestrator 手动注入 |
| OpenCode 读取并注入 | T10.5: chat.system.transform 互补 |
| identity.json → AGENTS.md 生成 | Web 驾驶舱改身份触发 |
| AI 语气符合人格定义 | |
