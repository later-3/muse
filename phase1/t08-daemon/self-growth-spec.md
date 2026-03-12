# T08-2 自我成长引擎 (Self-Growth Engine) — 技术方案

> Muse 不只是被开发，她自己会学习、会成长、会进化。
>
> 本文档定义她如何正确地成长——从发现自己不会什么，到学会它，再到跟你分享成长的故事。

---

## 1. 背景与动机

### 1.1 问题场景

你给小缪发了一张图片。她不会处理图片——Telegram 适配器只注册了 `bot.on('text')`, 没有 `bot.on('photo')`。

**现状**: 消息被静默丢弃。你什么都收不到。她不知道自己不会，你不知道她丢了消息。

**目标**: 她应该意识到这是自己的能力边界，然后：
1. 立即回复你："这个我还不会，等我学一下 📚"
2. 自主启动学习流程，修改自己的代码
3. 在沙箱中测试
4. 成功：热加载 → "我学会了！你看这张图片是..." → 处理图片
5. 失败：回滚 → "这个暂时学不会，我记下来了"→ 记录到成长日志

### 1.2 为什么这是 Muse 的核心特性

| 维度 | 传统 Agent | Muse |
|------|-----------|------|
| 遇到不会的 | 报错 / 404 / 静默失败 | 感知差距 → 自主学习 → 升级 |
| 能力边界 | 固定不变 | 动态扩展，越用越强 |
| 成长轨迹 | 无 | 可视化日志：学了啥、尝试了啥、还不会啥 |
| 回滚保护 | 无 | 学不会就回退，不影响现有功能 |

这和 PHILOSOPHY.md 的第一原则完全一致——AI 做认知决策，工程层做安全保障。成长引擎就是给 AI 提供"自我升级的能力"，同时工程层保证升级是安全的。

---

## 2. 架构设计

### 2.1 在 Muse 大脑/小脑框架中的位置

```
                    ┌──────────────┐
                    │   Telegram    │ ← 收到图片
                    └──────┬───────┘
                           │ 不认识的消息类型
                    ┌──────▼───────┐
                    │  Orchestrator │ ← 抛出 CapabilityGap
                    └──────┬───────┘
                           │ 
         ┌─────────────────▼─────────────────┐
         │       Self-Growth Engine           │ ← T08-2 核心
         │       (小脑的成长中枢)               │
         │                                     │
         │  ┌───────────┐  ┌──────────────┐  │
         │  │ Gap        │  │ Growth       │  │
         │  │ Detector   │  │ Journal      │  │
         │  │ 缺口感知    │  │ 成长日志      │  │
         │  └─────┬─────┘  └──────────────┘  │
         │        │                           │
         │  ┌─────▼─────────────────────┐    │
         │  │   Learning Pipeline        │    │
         │  │                            │    │
         │  │  ① Research Session        │    │  ← 新建专用 OpenCode 实例
         │  │     ↓ 研究方案              │    │     用它的44个工具读代码、查文档
         │  │  ② Code Session            │    │
         │  │     ↓ 写代码实现            │    │  ← 实际修改 Muse 源码
         │  │  ③ Test Session            │    │
         │  │     ↓ 沙箱测试              │    │  ← 运行测试验证
         │  │  ④ Install / Rollback      │    │
         │  │     成功→热加载 / 失败→回滚  │    │
         │  └────────────────────────────┘    │
         └─────────────────────────────────────┘
                           │
         ┌─────────────────▼─────────────────┐
         │         OpenCode Serve (大脑)       │
         │   Learning Session (独立 session)   │
         │   44 工具: read/write/patch/bash... │
         └─────────────────────────────────────┘
```

### 2.2 核心概念

#### CapabilityGap (能力缺口)

```javascript
class CapabilityGap {
  type        // 'unhandled_message_type' | 'missing_feature' | 'runtime_error'
  trigger     // 触发事件的原始信息 (如: { messageType: 'photo', rawUpdate: {...} })
  severity    // 'blocking' (无法继续) | 'degraded' (降级可用)
  context     // 相关上下文: 代码位置、错误堆栈、用户期望
  timestamp   
}
```

#### GrowthAttempt (学习尝试)

```javascript
class GrowthAttempt {
  id              // UUID
  gap             // CapabilityGap 引用
  status          // 'researching' | 'coding' | 'testing' | 'installed' | 'rolled_back' | 'abandoned'
  phases          // [{ phase, sessionId, startTime, endTime, result, logs }]
  codeChanges     // diff 快照 (用于回滚)
  testResults     // 测试运行日志
  verdict         // 最终判定
  createdAt
  completedAt
}
```

### 2.3 利用 OpenCode 的特性

这是 Muse 站在 OpenCode 肩膀上最极致的体现——**用 OpenCode 修改自己**：

| OpenCode 特性 | 在自我成长中的用途 |
|-------------|-----------------|
| **44 内置工具** | 读源码 (read_file)、搜索模式 (grep)、写代码 (write_file/patch) |
| **Session 隔离** | 学习用独立 session，不污染用户对话 session |
| **Sisyphus 协议** | Phase 2C 失败恢复: STOP → REVERT → DOCUMENT → CONSULT |
| **多模型** | 研究用轻量模型 (Flash)，编码用强模型 (Claude) |
| **代码执行** | bash 工具运行 `node --test` 验证修改 |
| **git 操作** | 自动创建分支、提交、测试不过就 revert |
| **AGENTS.md** | 学习 agent 的行为规则注入 |

---

## 3. 详细流程设计

### 3.1 完整链路 (以图片处理为例)

```
用户发图片到 Telegram
    ↓
① [Telegram 适配器] 收到 update，不匹配任何 handler
    → 触发 fallback handler
    → 构造 CapabilityGap { type: 'unhandled_message_type', trigger: { messageType: 'photo' } }
    ↓
② [Gap Detector] 收到 CapabilityGap
    → 检查 Growth Journal: 这个差距是否正在学习 / 已经放弃过?
    → 如果正在学习 → 告诉用户 "我正在学这个，还没学完"
    → 如果已放弃 → 告诉用户 "这个我之前试过还搞不定"
    → 如果是新的 → 进入学习流水线
    ↓
③ [回复用户] "📚 这个我还不会处理图片呢，让我学一下，等我几分钟~"
    ↓
④ [Learning Pipeline — Phase 1: 研究]
    → 创建 OpenCode Learning Session (轻量模型)
    → system prompt:
      ```
      你是 Muse 的学习代理。Muse 是一个基于 OpenCode 的 AI 伴侣框架。
      
      Muse 当前遇到了一个能力缺口：无法处理 Telegram 图片消息。
      
      你的任务：
      1. 阅读 Muse 的 Telegram 适配器代码 (muse/adapters/telegram.mjs)
      2. 阅读 Telegraf 的文档，了解如何处理 photo 类型消息
      3. 阅读 OpenCode REST API，了解 message parts 是否支持图片
      4. 输出一个简明修改方案 (JSON 格式)，不要修改任何文件
      
      项目根目录: /home/user/Code/assistant-agent
      ```
    → 获取研究方案 (哪些文件要改，怎么改)
    ↓
⑤ [Learning Pipeline — Phase 2: 编码]
    → git checkout -b growth/image-support-{timestamp}    ← 创建安全分支
    → 创建 OpenCode Coding Session (强模型)
    → system prompt:
      ```
      你是 Muse 的代码工程师。根据以下研究方案,实现 Muse 的图片处理能力。
      
      研究方案: {Phase 1 输出}
      
      规则:
      - 遵循 Muse 代码规范 (ESM only, createLogger, try/catch 降级)
      - 每个修改必须有测试
      - 不要改无关文件
      - 不要破坏现有的文本消息处理
      
      项目根目录: /home/user/Code/assistant-agent
      ```
    → OpenCode 修改代码
    → git add -A && git commit -m "growth: add image support (auto-learning)"
    ↓
⑥ [Learning Pipeline — Phase 3: 测试]
    → 创建 OpenCode Test Session
    → 运行: node --test muse/adapters/telegram.test.mjs
    → 运行: node --test muse/           (回归测试)
    → 收集测试结果
    ↓
⑦ [Decision Gate]
    → 测试全过 →  进入安装
    → 测试失败 →  尝试修复 (最多 2 次)
    → 修复也失败 → 回滚
    ↓
⑧-A [安装成功路径]
    → git checkout main && git merge growth/image-support-{timestamp}
    → 触发热加载 (重新注册 Telegram handler)
    → 记录到 Growth Journal: { status: 'installed', diff: '...', testResults: '...' }
    → 回复用户: "我学会处理图片了! 🎉 让我看看你发的那张..."
    → 处理之前的图片消息
    ↓
⑧-B [回滚路径]
    → git checkout main          ← 回到安全状态
    → git branch -D growth/...   ← 清理分支
    → 记录到 Growth Journal: { status: 'rolled_back', reason: '...', attempts: [...] }
    → 回复用户: "😅 这个我暂时学不会，但我记下来了。以后能力更强了再试试！"
```

### 3.2 缺口感知策略

不只是图片——所有"不会的事"都能被感知：

| 感知方式 | 实现 | 举例 |
|---------|------|------|
| **未处理的消息类型** | Telegram fallback handler | photo, voice, sticker, document |
| **未知的命令** | 命令路由 miss | `/translate xxx` |
| **运行时异常模式** | Orchestrator 错误分类 | 重复出现的同类错误 |
| **用户明确反馈** | "你怎么不能 xxx?" | 用户指出缺失功能 |
| **小脑巡检** | 定期扫描日志中的 error pattern | 系统性能力短板 |

### 3.3 安全边界

```
✅ 允许修改的范围:
  - muse/ 目录下的 .mjs 文件
  - muse/data/ 下的配置文件
  - 新增测试文件

❌ 禁止修改:
  - opencode/ 源码 (除非手动审批)
  - .env / 敏感配置
  - package.json (不能自己加依赖)
  - node_modules/
  - phase1/ phase2/ 文档

⚠️ 需要审批:
  - 修改超过 200 行
  - 涉及 3 个以上文件
  - 修改核心模块 (engine.mjs, orchestrator.mjs)
```

---

## 4. 数据模型

### 4.1 Growth Journal (成长日志)

SQLite 表，存在 `memory.db` 中：

```sql
CREATE TABLE IF NOT EXISTS growth_journal (
  id TEXT PRIMARY KEY,
  gap_type TEXT NOT NULL,           -- 'unhandled_message_type' | 'missing_feature' | ...
  gap_trigger TEXT NOT NULL,        -- JSON: 触发信息
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | learning | installed | rolled_back | abandoned
  
  -- 学习过程
  research_session_id TEXT,         -- OpenCode session ID (研究阶段)
  coding_session_id TEXT,           -- OpenCode session ID (编码阶段)  
  test_session_id TEXT,             -- OpenCode session ID (测试阶段)
  research_summary TEXT,            -- 研究方案摘要
  code_diff TEXT,                   -- git diff 快照
  test_results TEXT,                -- JSON: 测试结果
  
  -- 结果
  verdict TEXT,                     -- 'success' | 'test_failure' | 'timeout' | 'scope_exceeded'
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 2,
  
  -- 元数据
  agent_id TEXT DEFAULT 'muse',
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  
  -- Web 驾驶舱展示
  user_notification TEXT,           -- 发给用户的消息
  growth_notes TEXT                 -- 小缪的成长笔记（自由文字）
);

CREATE INDEX IF NOT EXISTS idx_growth_status ON growth_journal(status);
CREATE INDEX IF NOT EXISTS idx_growth_gap_type ON growth_journal(gap_type);
```

---

## 5. Web 驾驶舱集成

### 5.1 新增「成长」页面

```
┌─ 🌱 成长轨迹 ──────────────────────────────────────┐
│                                                      │
│  📊 成长统计                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐           │
│  │  3   │  │  2   │  │  1   │  │  1   │           │
│  │ 已学会│  │ 学习中│  │ 暂搁 │  │ 尝试中│           │
│  └──────┘  └──────┘  └──────┘  └──────┘           │
│                                                      │
│  📅 成长时间线                                       │
│  ┌────────────────────────────────────────────┐     │
│  │ 🟢 03-12 14:30  学会了处理 Telegram 图片     │     │
│  │    研究 3min → 编码 5min → 测试通过 → 安装   │     │
│  │    diff: +45 行 (telegram.mjs)              │     │
│  │                                             │     │
│  │ 🟡 03-11 09:00  正在学习: 语音消息处理       │     │
│  │    研究完成, 编码中...                        │     │
│  │                                             │     │
│  │ 🔴 03-10 16:00  暂搁: 视频通话功能          │     │
│  │    原因: 需要 WebRTC 依赖, 超出自动安装范围   │     │
│  │    尝试次数: 2/2                             │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  📝 能力清单                                        │
│  ┌────────────────────────────────────────────┐     │
│  │ ✅ 文本消息   (内置)                        │     │
│  │ ✅ 图片理解   (自学 03-12)                  │     │
│  │ 🔄 语音消息   (学习中)                      │     │
│  │ ❌ 视频通话   (暂搁 - 需外部依赖)           │     │
│  │ ⬜ 文件处理   (未遇到)                      │     │
│  └────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

### 5.2 API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/growth` | 获取成长统计 + 最近记录 |
| GET | `/api/growth/:id` | 获取单条学习记录详情 (含 diff, 测试日志) |
| GET | `/api/growth/capabilities` | 获取能力清单 |
| POST | `/api/growth/:id/retry` | 手动触发重新学习 |
| POST | `/api/growth/:id/approve` | 审批超范围修改 |

---

## 6. 与 T08-1 小脑核心的关系

| T08-1 小脑核心 | T08-2 自我成长引擎 |
|---------------|-------------------|
| 心跳监控 | Gap Detector (缺口巡检) |
| 自动重启大脑 | 自动修复能力缺口 |
| 僵尸 session 清理 | 孤儿学习 session 清理 |
| 30s 周期 | 事件驱动 + 定期扫描 |
| 保活 | 进化 |

小脑既是守护者，也是教练——它不止保证 Muse 活着，还帮 Muse 变得更强。

---

## 7. 成长守则 — Muse 该怎么正确地学

> 这不只是代码，是 Muse 的学习方法论。

### 7.1 学习的正确方式

```
1. 先研究，再动手
   → 不要拿到一个需求就开始改代码
   → 先读懂现有架构，理清影响范围
   → 这和 Sisyphus Phase 0 (Intent Gate) 一样

2. 小步修改，频繁验证
   → 每个修改都在分支上
   → 写代码前先写测试
   → 改一块测一块

3. 不确定就问
   → 修改超出安全范围 → 不要硬改，标记为 "需审批"
   → 这和 Sisyphus Phase 2C (CONSULT) 一样

4. 学不会也是收获
   → 记录下为什么学不会
   → "不能自动安装 npm 依赖" → 记录为系统限制
   → 下次遇到类似问题，直接告诉用户
   → 这是真正的"成长"，不只是"成功"

5. 保持谦逊
   → 永远不要修改超出 muse/ 范围的代码
   → 永远在分支上操作
   → 永远有回滚路径
```

### 7.2 Anti-Pattern

```
❌ 没研究就直接改代码 → 破坏现有功能
❌ 改了核心模块但没测试 → 引入隐性 bug
❌ 添加外部依赖 → 违反 "无框架" 原则
❌ 修改 opencode 源码 → 违反 "Plugins > Forks"
❌ 连续失败却不停 → 浪费资源，陷入死循环
❌ 不记录失败 → 下次还会犯同样的错
```

---

## 8. 与 Phase 2 的关系

自我成长引擎在 Phase 2 中自然进化：

| Phase 1 (T08-2) | Phase 2+ |
|-----------------|----------|
| 小脑直接管理学习 session | Memory MCP 工具让 AI 自主记录成长 |
| 学习过程用 REST API | 学习过程用 SSE 实时推送到驾驶舱 |
| 固定的安全边界 | AI 自主评估风险 + 人类审批 |
| 单线学习 | 并行学习多个能力 (Sisyphus 式) |
| 只修改 muse/ | 可以创建 OpenCode Skill/Plugin 来扩展 |

---

## 9. 完成定义 (DoD)

- [ ] `muse/daemon/growth-engine.mjs` — GrowthEngine 类
- [ ] `muse/daemon/gap-detector.mjs` — CapabilityGap 感知模块
- [ ] Telegram fallback handler 注册 (感知未处理消息类型)
- [ ] Growth Journal SQLite 表创建
- [ ] Learning Pipeline 4 阶段完整实现
- [ ] git 分支管理 (创建/合并/回滚)
- [ ] Web API: `/api/growth` 端点
- [ ] Web 页面: 成长轨迹展示
- [ ] 11 项单元测试
- [ ] 端到端验证: 发图片 → 自动学习 → 回复

---

## 10. 上下文参考

| 来源 | 参考点 |
|------|--------|
| [PHILOSOPHY.md](file:///home/user/Code/assistant-agent/PHILOSOPHY.md) | 第一原则: AI 做认知决策 → 学习决策交给 AI |
| [ARCHITECTURE.md](file:///home/user/Code/assistant-agent/ARCHITECTURE.md) | 小脑职责: 守护 + 定时任务 + 事件触发 |
| [Sisyphus Protocol](KI) | Phase 0 Intent Gate, Phase 2C Failure Recovery |
| [OpenCode Hooks](KI) | BackgroundManager, 46 hooks lifecycle |
| [Engineering Principles](KI) | Plugins > Forks, Parallelize by Default |
| [EXPERIENCE.md](file:///home/user/Code/assistant-agent/phase1/EXPERIENCE.md) | BUG-009~011: OpenCode API 行为验证 |
