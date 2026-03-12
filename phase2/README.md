# Phase 2 — 从 Wrapper 到 Native Agent

> **前置**: Phase 1 (主体完成)
> **一句话**: 让 Muse 站在 OpenCode 原生能力之上，知道自己有什么感官、有什么能力、不会什么、并能自己尝试搞定问题。

---

## 一、Phase 2 目标

Phase 1 证明了"能跑通"。Phase 2 的核心转变:

| 从 | 到 |
|----|-----|
| Orchestrator 手动注入记忆 | AI 通过 MCP 自主决定存取 |
| buildSystemPrompt() 代码注入人格 | AGENTS.md 原生注入 |
| wrapper 层做认知决策 | AI 自己决策，wrapper 只做转发 |
| Telegram 是通道 | Telegram 是她的感官器官 |
| 不知道自己不会什么 | 有能力注册表 + 缺口日志 |
| 只能调工具 | 能调工具/Skill/MCP/Hook/子agent |

### 验收标准

1. "我叫 Later" → AI **自主调** `set_memory` (不是代码正则)
2. 第二天聊天 → AI **主动** `search_memory` (不是每轮机械注入)
3. 20 轮对话后 session token 稳定 (人格不膨胀)
4. 改身份 → AGENTS.md 更新 → 对话风格变化
5. Orchestrator 不含认知逻辑 (`grep "意图|intent|正则" = 0`)
6. MCP 不可用 → 自动降级，对话正常
7. 收到语音 → Gap Journal 记录 + 告知用户
8. Web 驾驶舱显示能力列表 + 缺口列表
9. 新 Skill 只需写 SKILL.md，无需改代码
10. prompt.after 触发情景记忆落盘

---

## 二、OpenCode 完整能力地图

### 2.1 内置工具 (16 个)

| 工具 | 能力 | Muse 用途 |
|------|------|----------|
| bash | shell 命令 | 计算/脚本/系统操作 |
| read / write / edit / apply_patch | 文件操作 | 知识管理/日记/自我开发 |
| glob / grep / codesearch | 搜索 | 知识检索/发现 |
| webfetch / websearch | 网络 | 信息采集/搜索 |
| lsp | 代码分析 | 自我开发 (实验) |
| task | 子任务/子会话 | 家族协作/并行处理 |
| todo | 待办管理 | 目标跟踪 |
| skill | 加载技能指令 | 策略注入 |
| question | 向用户提问 | 交互确认 |
| batch | 批量工具调用 | 并行效率 (实验) |

### 2.2 七大扩展机制

| # | 机制 | 本质 | Muse 用途 |
|---|------|------|----------|
| ① | **Skill** (`.agents/skills/*/SKILL.md`) | 指令注入 | 策略: 何时存记忆/如何聊天 |
| ② | **Custom Tool** (`.agents/tools/*.js`) | 轻量代码 | 格式化/本地计算 |
| ③ | **MCP Server** (`opencode.json → mcp`) | 有状态服务 | Memory/Weather/Reminder |
| ④ | **Plugin** (`opencode.json → plugins`) | 运行时批量扩展 | agents/tools/hooks 注册 |
| ⑤ | **Hook** (via Plugin.trigger) | 生命周期拦截 | 审计/注入/降级 |
| ⑥ | **Bus** (Bus.publish/subscribe) | 事件系统 | 状态桥/触发器/观察 |
| ⑦ | **AGENTS.md** | 规则文件 | 人格/行为规则 |

### 2.3 Bus 事件 (源码实证)

| 事件 | 触发时机 | Muse 用途 |
|------|---------|----------|
| Session.Created/Updated/Deleted | 会话生命周期 | 上下文注入/清理 |
| Session.Idle | 空闲 | 主动触发/背景任务 |
| Session.Error | 错误 | 失败记录/降级/Gap Journal |
| Session.Compacted | 上下文压缩 | 记忆保存触发 |
| MessageV2.Updated/PartDelta | 消息流 | 对话日志/实时展示 |
| File.Edited | 文件编辑 | 自我开发审计 |
| Command.Executed | 命令执行 | bash 审计 |
| Todo.Updated | 待办变更 | 目标跟踪 |

### 2.4 Hook 点位 (源码实证)

| Hook | 触发时机 | Muse 用途 |
|------|---------|----------|
| prompt.before / after | LLM 调用前后 | 上下文注入/记忆落盘 |
| tool.definition | 工具注册 | 动态修改描述 |
| tool.output.after | 工具执行后 | 审计/缓存 |
| permission.ask | 权限请求 | 审批拦截 |
| compaction.before | 上下文压缩前 | 关键信息保存 |
| chat.system.transform | system prompt | 人格/目标动态注入 |
| chat.messages.transform | 消息列表 | 过滤/增强 |

---

## 三、Muse 架构四层

```
┌──────────────────────────────────────────┐
│          Perception Ingress              │
│  Telegram(嘴耳) / Camera(眼) / FS(收件) │
│  → 标准化 PerceptionObject              │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│         Capability Registry              │
│  感官: { telegram_text: ✅, camera: ❌ } │
│  能力: { memory: MCP, translate: LLM }  │
│  状态: { transcribe_audio: missing }     │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│          Execution Router                │
│  1. LLM → 2. 内置工具 → 3. Skill       │
│  4. Custom Tool → 5. MCP → 6. Hook      │
│  7. Subagent → 8. 新 OpenCode 实例      │
└────────────────┬─────────────────────────┘
                 │ 失败
┌────────────────▼─────────────────────────┐
│       Capability Gap Journal             │
│  { input, missing_cap, tried, result }   │
│  → 告知用户 / 自学 / 求助 / 申请新能力   │
└──────────────────────────────────────────┘
```

### 3.1 Perception Ingress

统一所有外部输入为标准对象:

```js
{
  source: 'telegram',             // 器官来源
  type: 'text' | 'audio' | 'image' | 'video' | 'file' | 'event',
  userId: 'later',
  artifact: { kind, mime, localPath },
  textFallback: '...',
  timestamp: '...'
}
```

Phase 2 先做 Telegram text/photo。audio/video/file 触发 Gap 流程。

### 3.2 Capability Registry

```js
{
  senses: {
    telegram_text: { status: 'available' },
    telegram_photo: { status: 'available', tool: 'multimodal_llm' },
    telegram_audio: { status: 'unavailable', reason: 'no transcribe' },
    camera: { status: 'not_connected' }
  },
  capabilities: {
    remember_user: { provider: 'mcp', server: 'memory-server' },
    understand_text: { provider: 'native' },
    search_web: { provider: 'builtin', tool: 'websearch' },
    transcribe_audio: { provider: 'none', status: 'missing' },
    create_subagent: { provider: 'builtin', tool: 'task' }
  }
}
```

Phase 2: 静态注册。Phase 3: 动态发现。Phase 4: 自主扩展。

### 3.3 Execution Router

| 层级 | 方式 | 适用场景 |
|------|------|---------|
| 1 | LLM 直接推理 | 闲聊/翻译/创作 |
| 2 | 内置工具 | 文件/终端/搜索 |
| 3 | 加载 Skill | 需要策略指导 |
| 4 | Custom Tool | 轻量计算 |
| 5 | MCP Server | 有状态服务 |
| 6 | Hook / Plugin | 生命周期拦截 |
| 7 | Subagent | 短任务并行 |
| 8 | 新 OpenCode 实例 | 隔离/沙箱 |

### 3.4 Capability Gap Journal

```js
{
  timestamp: '...',
  inputType: 'audio',
  source: 'telegram',
  missingCapability: 'transcribe_audio',
  triedPaths: ['llm', 'builtin', 'mcp'],
  result: 'no_solution',
  userNotified: true,
  growthProposal: 'install whisper MCP'
}
```

---

## 四、Agent Execution Topology

```
┌─────────────────────────────────────┐
│        Muse 主体 (AI Agent)          │
├─────────────────────────────────────┤
│  ① 内置工具 (bash/read/webfetch)   │
│  ② MCP 工具 (memory/weather)       │
│  ③ Skill 策略                      │
├─────────────────────────────────────┤
│  ④ 子 agent (task 工具)            │ P2 预留
│     └ 短任务: 搜索/格式化/分类      │
├─────────────────────────────────────┤
│  ⑤ 创建新 agent (P4)              │
│     └ 家族成员: 工匠/书虫           │
├─────────────────────────────────────┤
│  ⑥ 新 OpenCode 实例 (P4)          │
│     └ 沙箱: 自我开发/做项目        │
└─────────────────────────────────────┘
```

她未来不只调工具 — 还能**调子 agent、自建 agent、自写 Hook/Plugin/MCP/Skill、起新 OpenCode 实例做项目**。Phase 2 建框架，Phase 3-4 逐步解锁。

---

## 五、场景矩阵 (器官模型)

### A. 感官器官场景

| 器官 | 输入 | Phase 2 | 后续 |
|------|------|---------|------|
| Telegram (嘴耳) | text | ✅ | — |
| Telegram (嘴耳) | photo | ✅ | — |
| Telegram (嘴耳) | audio | Gap → 告知 | P3 自装 TTS/STT |
| Telegram (嘴耳) | video | Gap → 告知 | P3 ffmpeg+多模态 |
| Telegram (嘴耳) | file | Gap → 告知 | P3 file parser |
| Camera (眼) | stream | P5 | Vision MCP |
| FileSystem (收件) | file watch | P3 | Bus event |
| IoT (环境) | sensor | P5 | HomeAssistant |

### B. 日常关系场景

| 场景 | 能力 | 机制 |
|------|------|------|
| 闲聊/共情/写诗/唱歌(文字) | LLM 原生 | AGENTS.md 人格 |
| "我叫 Later" → 记住 | set_memory | MCP |
| 第二天回忆 | search_memory | MCP 自主调用 |
| 搜索/总结链接 | websearch, webfetch | 内置工具 |

### C. 长期目标与连续生活

| 场景 | Phase |
|------|-------|
| 记住"我在学 Rust" | P2 预留 → P3 |
| 阶段提醒 | P3 (Pulse) |
| 复盘/周总结 | P2 可做 |
| 生成报告/卡片 | P3 |

### D. 未知输入与能力缺口

| 场景 | Phase 2 行为 | Phase 3 行为 |
|------|-------------|-------------|
| 收到语音 | Registry → 缺 → Gap → 告知 | 自己找/写 whisper MCP |
| 收到视频 | Registry → 缺 → Gap → 告知 | ffmpeg 抽帧 + 多模态 |
| 唱歌(要声音) | 文字版 + Gap(tts) | 自己接 TTS |

### E. 自我成长与开发

| 场景 | Phase |
|------|-------|
| 写新 SKILL.md | P3 |
| 写 MCP/Hook/Plugin | P4 (受控审批) |
| 造 Agent / 起新 OC | P4 |
| 用 OpenCode 做项目 | P4 |
| 失败记录 + 求助 | P2 ✅ |

### F. 家族协作

| 场景 | Phase |
|------|-------|
| 子任务委派 | P4 |
| 工匠/书虫 | P4 |
| 共享记忆 | P4 |

---

## 六、任务拆分 (9 个)

### 主链

#### T11: Memory MCP — 记忆工具化

**目标**: Memory 从 Orchestrator 手动注入 → AI 通过 MCP 自主存取

1. `muse/mcp/memory.mjs` — MCP stdio Server
2. 工具: search_memory, set_memory, get_user_profile, get_recent_episodes, add_episode
3. opencode.json 注册
4. 降级: MCP 不可用 → Orchestrator 直接查 SQLite
5. Memory 表结构预留 capability / goal / gap 字段

#### T12: Identity → AGENTS.md

**目标**: 人格从 buildSystemPrompt() → AGENTS.md + chat.system.transform

1. identity.json → AGENTS.md 生成器
2. Web 驾驶舱改身份 → 重新生成 AGENTS.md
3. 验证: 人格不在 session 里重复膨胀

#### T13: Orchestrator 瘦身

**目标**: Orchestrator 只做消息转发

1. 删手动记忆注入 (T11 接管)
2. 删 buildSystemPrompt (T12 接管)
3. 删意图路由正则
4. 保留: 消息转发 + 格式化 + 降级
5. 回归测试

**依赖**: T11 + T12

### 并行基座

#### T10: Skill + Custom Tool + 开发规范

1. `.agents/skills/` 目录结构
2. Skill 开发标准 (分层原则/格式/安全边界)
3. `memory-companion` Skill (配合 T11)
4. `daily-chat` Skill
5. Custom Tool 试点 1 个

#### T10.5: Hook / Plugin / Bus 基座

1. prompt.before: 上下文/能力自知注入
2. prompt.after: 情景记忆落盘触发
3. tool.output.after: 审计日志
4. Session.Error → Gap Journal
5. Session.Idle → 预留主动触发 (P3 Pulse)
6. permission.ask → 预留审批链 (P4)

### 新增核心

#### T14: Perception Ingress — 感知统一层

1. PerceptionObject 数据结构
2. Telegram text → PerceptionObject
3. Telegram photo → PerceptionObject
4. 未支持类型 → 触发 Gap 流程
5. 预留: 其他器官接口 (P3+)

#### T15: Capability Registry — 能力自知

1. CapabilityRegistry 数据结构 (senses + capabilities + status)
2. 静态注册: 启动时构建
3. 查询: queryCapability(type) → { available, provider, fallback }
4. Web 驾驶舱: 能力列表
5. AGENTS.md 注入: AI 知道自己的能力清单

#### T16: Capability Gap Journal — 缺口管理

1. GapEntry 数据结构
2. Memory gap 表
3. 自动: Perception 未知类型 → 查 Registry → 记录 Gap
4. 告知用户 + 成长提议
5. Web 驾驶舱: Gap 列表

#### T17: Execution Router — 执行路由

1. 8 层路由链 (LLM → 内置 → Skill → Tool → MCP → Hook → Subagent → 新 OC)
2. 与 Registry 联动: 路由前查可用性
3. 路由失败 → Gap Journal
4. 决策日志 (自省和审计用)

---

## 七、依赖图与执行顺序

```
第一批 (并行):  T11 + T12 + T10
第二批:         T13 (依赖 T11+T12)
第三批 (并行):  T10.5 + T14 + T15
第四批:         T16 + T17
```

```
T11 (Memory MCP) ──────────→ T13 (Orchestrator 瘦身)
T12 (Identity)   ──────────→ T13
T10 (Skill 标准) ──── 配合 → T11
T10.5 (Hook 基座)
T14 (Perception) ──→ T15 (Registry) ──→ T16 (Gap Journal)
                                         ↓
T17 (Execution Router) ←── T15 + T16
```

---

## 八、技能开发规范 (Muse 自我开发规则)

### 分层原则

```
新增能力时:
1. LLM 原生解决?        → AGENTS.md 规则
2. 内置工具解决?        → 写 Skill 指令
3. 轻量计算?            → Custom Tool (.agents/tools/)
4. 需要持久状态?        → MCP Server (muse/mcp/)
5. 需要生命周期拦截?    → Hook (via Plugin)
6. 需要跨模块通信?      → Bus 事件
7. 需要并行/隔离执行?   → Subagent (task)
8. 需要完全隔离?        → 新 OpenCode 实例
```

### 安全边界

| 操作 | P2 | P3 | P4 |
|------|-----|-----|-----|
| 创建 SKILL.md | ❌ 人工 | ✅ AI | ✅ |
| 修改 opencode.json | ❌ 人工 | ❌ 人工 | ⚠️ 审批 |
| 修改 muse/core/ | ❌ 人工 | ❌ 人工 | ⚠️ 受控 |
| 读写 muse/data/ | ✅ MCP | ✅ | ✅ |
| 起子 agent | ❌ | ⚠️ 受限 | ✅ |
| 起新 OC 实例 | ❌ | ❌ | ⚠️ 审批 |
| 写 MCP/Hook/Plugin | ❌ | ❌ | ⚠️ 受控 |

---

## 九、与其他 Phase 的关系

| Phase | 关系 |
|-------|------|
| Phase 1 | Memory/Identity/Engine/Orchestrator 基础代码 → Phase 2 改造 |
| Phase 3 | Phase 2 的 Registry + Gap → Phase 3 的自我学习 + Pulse |
| Phase 4 | Phase 2 的 Execution Router → Phase 4 的自我开发 + 家族 |
| Phase 5 | Phase 2 的 Perception → Phase 5 的 Camera/IoT 器官 |
