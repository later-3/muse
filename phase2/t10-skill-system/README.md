# T10: Skill System — 技能规范与伴侣行为策略

> **第一批 原生基座** — 与 T10.5/T11/T12 并行
> **详细方案**: [context.md](./context.md)
> **评审**: ✅ 通过 (见 context.md 末尾评审报告)

## 定位

**Skill 是 Muse 的行为策略层基座。**

- **不是**人格主载体 (→ T12 AGENTS.md)
- **不是**能力主载体 (→ T11 MCP / T10.5 Hook)
- **是** 行为策略 + 工具使用策略 + 场景化工作手册
- **是** Phase 4 AI 自我开发的最轻入口

> Skill 不只是提示词文件，也是 Muse 的"行为资产"和未来自我成长资产。

### 层级优先级

```
AGENTS.md (身份/人格/全局规则)  ← 最高
    ↓
Skill (场景策略/行为手册)       ← T10
    ↓
MCP / Hook / Tool (能力实现)    ← T11 / T10.5
```

## 背景

Phase 1 所有行为策略硬编码在 `orchestrator.mjs` (正则意图分类、关键词偏好提取、手动 prompt 拼接)。
Skill 是 OpenCode 四层扩展中最轻的一层 — 写 `SKILL.md` 即可注入策略，热部署，AI 自主选择加载。

## 与其他任务的关系

| 任务 | 关系 | 边界 |
|------|------|------|
| **T11** Memory MCP ✅ | `memory-companion` 是 T11 的默认伴生 Skill | Skill 定策略，MCP 出能力 |
| **T10.5** Hook 基座 | 必须形成"策略 + 生命周期观察"闭环 | prompt.after/Session.Error 联动 |
| **T12** Identity | **人格归 AGENTS.md，场景策略归 Skill** | daily-chat 不重复定义人格 |
| **T13** Orchestrator 瘦身 | Skill 只接"行为策略"，不是全量承接 | 认知→AI, 人格→AGENTS.md, 策略→Skill, 能力→MCP |
| **Phase 4** 自我开发 | AI 自己写 SKILL.md 扩展能力 | T10 建规范，P4 用规范 |

## 目标

### T10A: 技能规范标准 (先做)

1. 创建 `.agents/skills/` 目录结构
2. Skill 开发规范 (CONVENTION.md: 分层/格式/安全边界/命名)
3. Custom Tool 定位文档 (轻量例外，以 MCP 为主)
4. 验证 OpenCode 发现 Skill

### T10B: 首批伴侣 Skill (后做)

5. `memory-companion` Skill — 记忆存取策略 (配合 T11)
6. `daily-chat` Skill — 闲聊场景策略 (不含人格定义)
7. Custom Tool 试点 1 个 (format-datetime)

### 预留 Skill 方向 (Phase 2 不实现，但入设计视野)

8. `goal-companion` — 长期目标跟进/复盘/提醒策略
9. `capability-gap-handler` — 不会时如何解释/记录/求助
10. `photo-chat` — 照片聊天/相册回忆策略
11. `family-delegation` — 何时调子 agent / 家族成员

## 验收 (三层验证)

| 层 | # | 标准 | 验证方式 |
|----|---|------|---------|
| **文件层** | 1 | `.agents/skills/` 有 2+ Skill，frontmatter 合规 | `skill.test.mjs` (20 tests) |
| **发现层** | 2 | OpenCode 注册并加载 Skill | `--print-logs` 检查 `⚙ skill` 工具调用 |
| **行为层** | 3 | AI 实际调用 skill 工具并按内容执行 | E2E 检查 tool-call 痕迹，非模型文本 |
| 规范 | 4 | CONVENTION.md 可被未来 AI 自我开发引用 | 文件存在 + 格式验证 |
| 热部署 | 5 | 新增 SKILL.md → 被发现 → 加载 → PONG-42 生效 | E2E 动态创建 test-probe |

### 验证边界

> ⚠️ 明确区分 T10 自身闭环 vs 待后续任务联动坐实。

| ✅ T10 自身验收 | ⏳ 待后续任务联动 |
|-----------------|-------------------|
| Skill 文件结构合规 (20 unit tests) | memory-companion 驱动 T11 set_memory (→ T13) |
| Custom Tool 格式和执行正确 | daily-chat 在无 T12 时不发生人格漂移 (→ T12) |
| OpenCode 能发现并加载 Skill (E2E) | Skill + Hook 形成生命周期闭环 (→ T10.5) |
| 热部署: 新增 Skill 无需改代码 (E2E) | |

## 评审要求的 4 个守则

1. **人格归 AGENTS.md** — daily-chat 不重复定义"她是谁"和"她说话的基调"
2. **Skill 不只是聊天策略** — 预留感知/能力缺口/多模态场景
3. **不依赖 AI 自主加载** — AGENTS.md 提醒 + T10.5 prompt.before 补轻量注入 + 日志验证
4. **Skill 是长期资产** — 可索引、可展示到驾驶舱、未来可自我编写

