# T04 记忆层 — 技术方案

> 实现 4 层记忆系统基础版：身份记忆 + 语义记忆 + 情景记忆 + 工作记忆
>
> 已整合大脑/小脑架构决策，所有表预留 `agent_id` 字段
>
> 已整合评审反馈（3 个 Blocker 修正 + 6 项改进）

---

## 1. 目标

- 实现 4 层分层记忆系统，为 T05 编排层提供记忆读写能力
- SQLite 存储（better-sqlite3），WAL 模式避免锁竞争
- 语义记忆：key-value 存储用户偏好和知识片段
- 情景记忆：对话摘要 + 全文日志，支持按时间/关键词检索
- 工作记忆：OpenCode session 代理（委托 Engine 管理）
- 身份记忆：直接读 identity.json（委托 Identity 模块，不重复实现）
- 所有表预留 `agent_id` 字段，Phase 1 固定 `'muse'`，Phase 4 扩展为多 Agent
- 遵循 T01 生命周期接口（start/stop/health）

---

## 2. 4 层记忆架构

```
┌───────────────────────────────────────────────┐
│              T05 编排层 (消费者)               │
│  加载身份 → 检索记忆 → 组装 prompt → 发引擎    │
└──────────┬────────────────────────────────────┘
           │ 调用 memory.xxx()
┌──────────▼────────────────────────────────────┐
│              Memory 类 (本模块)                │
│                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 语义记忆  │  │ 情景记忆  │  │ 工作记忆  │    │
│  │ semantic │  │ episodic │  │ working  │    │
│  │ KV 存储  │  │ 对话日志  │  │ session  │    │
│  │ SQLite   │  │ SQLite   │  │ Engine   │    │
│  └──────────┘  └──────────┘  └──────────┘    │
│                                               │
│  身份记忆: 委托 Identity 模块，不在此实现       │
└───────────────────────────────────────────────┘
```

| 层 | 存储 | 生命周期 | Phase 1 实现 |
|----|------|----------|-------------|
| 身份 | identity.json | 永久 | Identity 类 (T02) |
| 语义 | SQLite `semantic_memory` | 永久，持续积累 | key-value CRUD |
| 情景 | SQLite `episodic_memory` | 永久，检索时可加时间衰减 | 对话全文 + 消息级摘要 |
| 工作 | OpenCode session | 单次对话 | Engine 代理 (T03) |

---

## 3. SQL Schema

```sql
-- 语义记忆: 用户偏好、知识片段
CREATE TABLE IF NOT EXISTS semantic_memory (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id   TEXT NOT NULL DEFAULT 'muse',
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  category   TEXT DEFAULT 'general',   -- 分类: preference / knowledge / fact
  source     TEXT DEFAULT 'auto',      -- 来源: auto(LLM提取) / manual(用户手动)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, key)
);

-- 评审修正: 移除冗余的单列 key 索引，UNIQUE(agent_id, key) 已隐含覆盖
CREATE INDEX IF NOT EXISTS idx_semantic_agent ON semantic_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_semantic_category ON semantic_memory(agent_id, category);


-- 情景记忆: 对话日志 + 摘要
CREATE TABLE IF NOT EXISTS episodic_memory (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id      TEXT NOT NULL DEFAULT 'muse',
  session_id    TEXT NOT NULL,            -- OpenCode session ID
  role          TEXT NOT NULL CHECK(role IN ('user', 'assistant')),  -- 评审改进 #1: 约束合法值
  content       TEXT NOT NULL,            -- 消息全文
  summary       TEXT,                     -- 消息级摘要 (异步生成, 可为 NULL)
  token_count   INTEGER DEFAULT 0,        -- 粗略 token 计数
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 评审修正 #3: 复合索引匹配实际查询路径 (agent_id, session_id, created_at)
CREATE INDEX IF NOT EXISTS idx_episodic_agent ON episodic_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_episodic_agent_session ON episodic_memory(agent_id, session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_episodic_time ON episodic_memory(agent_id, created_at);
```

**设计决策**（含评审修正）：

| 决策 | 选择 | 理由 |
|------|------|------|
| agent_id 预留 | `DEFAULT 'muse'` | Phase 1 固定，Phase 4 扩展多 Agent 无需迁移 |
| semantic UNIQUE key | `(agent_id, key)` | 同一 agent 的同一 key 只保留最新值，隐含索引 |
| episodic 不去重 | 每条消息单独存 | 完整对话记录，支持上下文检索 |
| role CHECK 约束 | `IN ('user', 'assistant')` | 评审 #1: 防止非法值污染统计和摘要查询 |
| 复合索引 | `(agent_id, session_id, created_at)` | 评审 #3: 匹配实际查询路径，避免多 agent 下回表 |
| WAL 模式 | 初始化时开启 | 读写并发场景（小脑清理 + 主进程写入） |
| datetime('now') | SQLite 内置 | 避免 Node/SQLite 时区不一致 |
| token_count | 粗略统计 | Phase 1 用字符数/4 估算，Phase 2 用 tokenizer |
| summary 语义 | 消息级摘要，非会话级 | 每条 assistant 消息可有独立摘要，T05 异步回填 |

---

## 4. 核心实现

### 4.1 core/memory.mjs

```javascript
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { createLogger } from '../logger.mjs'

const log = createLogger('memory')

// 评审改进 #4: searchEpisodes limit 上界
const MAX_SEARCH_LIMIT = 100

export class Memory {
  #db = null
  #config
  #agentId

  constructor(config, agentId = 'muse') {
    this.#config = config
    this.#agentId = agentId
  }

  // --- 生命周期 ---

  async start() {
    // 评审改进 #2: 确保 dbPath 父目录存在
    mkdirSync(dirname(this.#config.memory.dbPath), { recursive: true })

    this.#db = new Database(this.#config.memory.dbPath)
    this.#db.pragma('journal_mode = WAL')
    this.#db.pragma('busy_timeout = 5000')
    this.#initSchema()
    log.info(`记忆系统已启动: ${this.#config.memory.dbPath}`)
  }

  async stop() {
    if (this.#db) {
      this.#db.close()
      this.#db = null
    }
    log.info('记忆系统已关闭')
  }

  async health() {
    if (!this.#db) return { ok: false, detail: 'not connected' }
    try {
      this.#db.prepare('SELECT 1').get()
      const semanticCount = this.#db.prepare(
        'SELECT COUNT(*) as count FROM semantic_memory WHERE agent_id = ?'
      ).get(this.#agentId).count
      const episodicCount = this.#db.prepare(
        'SELECT COUNT(*) as count FROM episodic_memory WHERE agent_id = ?'
      ).get(this.#agentId).count
      return {
        ok: true,
        detail: { semanticCount, episodicCount, agentId: this.#agentId },
      }
    } catch (e) {
      return { ok: false, detail: e.message }
    }
  }

  // --- 防御性检查 (评审改进 #3) ---

  #ensureConnected() {
    if (!this.#db) throw new Error('Memory not started — call start() first')
  }

  // --- 语义记忆 (KV) ---

  /** 设置语义记忆 (upsert) */
  setMemory(key, value, category = 'general', source = 'auto') {
    this.#ensureConnected()
    this.#db.prepare(`
      INSERT INTO semantic_memory (agent_id, key, value, category, source, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(agent_id, key)
      DO UPDATE SET value = excluded.value,
                    category = excluded.category,
                    source = excluded.source,
                    updated_at = datetime('now')
    `).run(this.#agentId, key, value, category, source)
  }

  /** 获取单条语义记忆 */
  getMemory(key) {
    this.#ensureConnected()
    return this.#db.prepare(
      'SELECT * FROM semantic_memory WHERE agent_id = ? AND key = ?'
    ).get(this.#agentId, key) ?? null
  }

  /** 删除单条语义记忆 */
  deleteMemory(key) {
    this.#ensureConnected()
    const result = this.#db.prepare(
      'DELETE FROM semantic_memory WHERE agent_id = ? AND key = ?'
    ).run(this.#agentId, key)
    return result.changes > 0
  }

  /** 列出所有语义记忆 (可选分类筛选) */
  listMemories(category = null) {
    this.#ensureConnected()
    if (category) {
      return this.#db.prepare(
        'SELECT * FROM semantic_memory WHERE agent_id = ? AND category = ? ORDER BY updated_at DESC'
      ).all(this.#agentId, category)
    }
    return this.#db.prepare(
      'SELECT * FROM semantic_memory WHERE agent_id = ? ORDER BY updated_at DESC'
    ).all(this.#agentId)
  }

  /** 按关键词搜索语义记忆 (key 和 value 模糊匹配) */
  searchMemories(keyword) {
    this.#ensureConnected()
    const pattern = `%${keyword}%`
    return this.#db.prepare(
      'SELECT * FROM semantic_memory WHERE agent_id = ? AND (key LIKE ? OR value LIKE ?) ORDER BY updated_at DESC'
    ).all(this.#agentId, pattern, pattern)
  }

  // --- 情景记忆 ---

  /** 添加一条对话记录 */
  addEpisode(sessionId, role, content, summary = null) {
    this.#ensureConnected()
    const tokenCount = Math.ceil(content.length / 4)  // 粗略估算
    this.#db.prepare(`
      INSERT INTO episodic_memory (agent_id, session_id, role, content, summary, token_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(this.#agentId, sessionId, role, content, summary, tokenCount)
  }

  /**
   * 评审 Blocker #1: 回填摘要 API
   * T05 异步生成摘要后，通过此方法写回数据库
   */
  updateEpisodeSummary(episodeId, summary) {
    this.#ensureConnected()
    const result = this.#db.prepare(
      'UPDATE episodic_memory SET summary = ? WHERE id = ? AND agent_id = ?'
    ).run(summary, episodeId, this.#agentId)
    return result.changes > 0
  }

  /** 获取最近 N 天的对话记录 */
  getRecentEpisodes(days = null) {
    this.#ensureConnected()
    const maxDays = days ?? this.#config.memory.maxEpisodicDays
    return this.#db.prepare(`
      SELECT * FROM episodic_memory
      WHERE agent_id = ?
        AND created_at >= datetime('now', ?)
      ORDER BY created_at DESC
    `).all(this.#agentId, `-${maxDays} days`)
  }

  /** 获取特定 session 的对话记录 */
  getSessionEpisodes(sessionId) {
    this.#ensureConnected()
    return this.#db.prepare(
      'SELECT * FROM episodic_memory WHERE agent_id = ? AND session_id = ? ORDER BY created_at ASC'
    ).all(this.#agentId, sessionId)
  }

  /** 按关键词搜索情景记忆 */
  searchEpisodes(keyword, limit = 20) {
    this.#ensureConnected()
    // 评审改进 #4: 钳制 limit 上界
    const safeLimit = Math.min(Math.max(1, limit), MAX_SEARCH_LIMIT)
    const pattern = `%${keyword}%`
    return this.#db.prepare(`
      SELECT * FROM episodic_memory
      WHERE agent_id = ? AND (content LIKE ? OR summary LIKE ?)
      ORDER BY created_at DESC
      LIMIT ?
    `).all(this.#agentId, pattern, pattern, safeLimit)
  }

  /**
   * 获取最近 N 天的消息级摘要 (T05 编排层用)
   * 评审改进 #5: 明确返回消息级摘要，不是会话级摘要
   * 每条记录是一条 assistant 消息的摘要，同一 session 可能有多条
   */
  getRecentSummaries(days = 3) {
    this.#ensureConnected()
    return this.#db.prepare(`
      SELECT id, session_id, summary, created_at FROM episodic_memory
      WHERE agent_id = ?
        AND summary IS NOT NULL
        AND role = 'assistant'
        AND created_at >= datetime('now', ?)
      ORDER BY created_at DESC
    `).all(this.#agentId, `-${days} days`)
  }

  /** 获取情景记忆统计 */
  getEpisodicStats() {
    this.#ensureConnected()
    // 评审 Blocker #2: COALESCE 防止空表返回 NULL
    return this.#db.prepare(`
      SELECT
        COUNT(*) as totalMessages,
        COUNT(DISTINCT session_id) as totalSessions,
        COALESCE(SUM(token_count), 0) as totalTokens,
        MIN(created_at) as earliest,
        MAX(created_at) as latest
      FROM episodic_memory WHERE agent_id = ?
    `).get(this.#agentId)
  }

  // --- 内部 ---

  #initSchema() {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS semantic_memory (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id   TEXT NOT NULL DEFAULT 'muse',
        key        TEXT NOT NULL,
        value      TEXT NOT NULL,
        category   TEXT DEFAULT 'general',
        source     TEXT DEFAULT 'auto',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(agent_id, key)
      );
      CREATE INDEX IF NOT EXISTS idx_semantic_agent ON semantic_memory(agent_id);
      CREATE INDEX IF NOT EXISTS idx_semantic_category ON semantic_memory(agent_id, category);

      CREATE TABLE IF NOT EXISTS episodic_memory (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id      TEXT NOT NULL DEFAULT 'muse',
        session_id    TEXT NOT NULL,
        role          TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content       TEXT NOT NULL,
        summary       TEXT,
        token_count   INTEGER DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_episodic_agent ON episodic_memory(agent_id);
      CREATE INDEX IF NOT EXISTS idx_episodic_agent_session ON episodic_memory(agent_id, session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_episodic_time ON episodic_memory(agent_id, created_at);
    `)
    log.debug('记忆表初始化完成')
  }
}
```

### 4.2 设计决策汇总（含评审修正）

| 决策 | 选择 | 理由 |
|------|------|------|
| DB 引擎 | better-sqlite3 (同步 API) | T01 已选型，零配置，性能好 |
| WAL 模式 | 初始化开启 | 支持小脑并发读（GC清理），主进程写 |
| busy_timeout | 5000ms | 防止并发锁等待超时 |
| agent_id 默认值 | `'muse'` 硬编码 | Phase 1 单 agent，构造函数可传参 |
| token 估算 | `content.length / 4` | Phase 1 粗略估算，Phase 2 换 tiktoken |
| 时间管理 | SQLite `datetime('now')` | 避免 Node/SQLite 时区差异 |
| 情景排序 | created_at DESC (最新优先) | T05 编排层需要最近记忆 |
| 搜索方式 | LIKE 模糊匹配 | Phase 1 够用，Phase 2 升级 sqlite-vec 向量检索 |
| 摘要 | 消息级摘要，T05 异步回填 | `updateEpisodeSummary()` API (评审 Blocker #1) |
| 空表统计 | `COALESCE(SUM(...), 0)` | 评审 Blocker #2: 空表 SUM 返回 NULL → 0 |
| 复合索引 | `(agent_id, session_id, created_at)` | 评审 Blocker #3: 匹配实际查询路径 |
| role 约束 | `CHECK(role IN ('user', 'assistant'))` | 评审改进 #1: 防止非法值 |
| 目录保障 | `mkdirSync(dirname(dbPath), {recursive})` | 评审改进 #2: 防止路径不存在 |
| 防御性检查 | `#ensureConnected()` | 评审改进 #3: stop 后明确报错 |
| 搜索上界 | `MAX_SEARCH_LIMIT = 100` | 评审改进 #4: 防止大 limit 放大 IO |

---

## 5. T05 编排层集成点

Memory 为 T05 编排层提供以下接口：

```
编排层核心流程:
  用户消息
    → [1] identity.buildSystemPrompt()         // T02 身份记忆
    → [2] memory.searchMemories(keywords)       // 语义记忆检索
    → [3] memory.getRecentSummaries(3)          // 最近 3 天消息级摘要
    → [4] 意图判断 → 选择模型
    → [5] 组装 enriched prompt → engine.sendAndWait()
    → [6] 异步回调:
          memory.addEpisode(sid, 'user', msg)           // 存用户消息
          memory.addEpisode(sid, 'assistant', reply)     // 存助手回复 (summary=null)
          memory.setMemory(key, value, 'preference')     // 提取偏好
          memory.updateEpisodeSummary(episodeId, summary) // 回填摘要 (评审 Blocker #1)
```

---

## 6. 与其他模块的边界

| 模块 | Memory 的关系 | 说明 |
|------|-------------|------|
| T02 Identity | **不包含** | 身份记忆由 Identity 类管理，Memory 不重复存储 |
| T03 Engine | **不包含** | 工作记忆(session)由 Engine 管，Memory 不代理 session |
| T05 Orchestrator | **消费者** | 编排层调用 Memory 的 CRUD 接口 + updateEpisodeSummary |
| T06 Telegram | **间接** | 通过 Orchestrator 使用，不直接调用 Memory |
| T07 Web | **直接** | Web API 可直接调 Memory（记忆浏览/搜索/编辑） |
| T08 Cerebellum | **并发读** | 小脑可能读取 Memory 做统计，WAL 保证不阻塞 |

---

## 7. 测试方案

```bash
node --test muse/core/memory.test.mjs
```

### 测试矩阵（含评审补充）

| # | 测试项 | 描述 | 类型 |
|---|--------|------|------|
| 1 | start 创建数据库 | 无 db 文件 → start → 文件生成 + 表创建 | 生命周期 |
| 2 | start WAL 模式 | start 后 PRAGMA journal_mode = wal | 生命周期 |
| 3 | start 自动创建目录 | 父目录不存在 → start → 自动 mkdirSync | 生命周期 |
| 4 | start 失败 — 无权限 | 只读路径 → start → 抛错 | 生命周期 |
| 5 | stop 关闭连接 | stop → 再调用 → 抛 'Memory not started' | 生命周期 |
| 6 | health 返回状态 | 连接中 → ok:true + 计数 | 生命周期 |
| 7 | setMemory 插入 | 新 key → 插入成功 → getMemory 返回 | 语义 CRUD |
| 8 | setMemory 更新 (upsert) | 同 key → 更新 value + updated_at 变化 | 语义 CRUD |
| 9 | getMemory 不存在 | 无效 key → 返回 null | 语义 CRUD |
| 10 | deleteMemory 存在 | 删除 → 返回 true → get 返回 null | 语义 CRUD |
| 11 | deleteMemory 不存在 | 无效 key → 返回 false | 语义 CRUD |
| 12 | listMemories 全部 | 多条记录 → 按 updated_at DESC | 语义查询 |
| 13 | listMemories 按分类 | 混合分类 → 按 category 筛选 | 语义查询 |
| 14 | searchMemories | key/value 模糊匹配 | 语义查询 |
| 15 | addEpisode 插入 | 插入一条 → getSessionEpisodes 返回 | 情景 CRUD |
| 16 | addEpisode token 估算 | 中文/英文 → token_count > 0 | 情景 CRUD |
| 17 | addEpisode 非法 role | role='system' → CHECK 约束抛错 | 情景校验 |
| 18 | updateEpisodeSummary 回填 | 插入 → 回填 summary → 查询验证 | 情景 CRUD |
| 19 | updateEpisodeSummary 不存在 | 无效 id → 返回 false | 情景 CRUD |
| 20 | getRecentEpisodes | 多天数据 → 按天数过滤 | 情景查询 |
| 21 | getSessionEpisodes | sessionId 过滤 + ASC 排序 | 情景查询 |
| 22 | searchEpisodes | content 模糊匹配 + 限制 | 情景查询 |
| 23 | searchEpisodes limit 上界 | limit=999 → 实际用 100 | 情景查询 |
| 24 | getRecentSummaries | 只返回有摘要的 assistant 消息 | 情景查询 |
| 25 | getEpisodicStats | 总数/session数/token数/时间范围 | 情景统计 |
| 26 | getEpisodicStats 空库 | 空表 → totalTokens=0, earliest=null | 情景统计 |
| 27 | agent_id 隔离 | 两个 agentId 的数据互不影响 | Multi-Agent |
| 28 | 幂等 initSchema | 重复调用 start → 不抛错 | 健壮性 |
| 29 | 空数据库查询 | 无数据 → 返回空数组 / null / 零值统计 | 边界 |

### 测试基础设施

```javascript
// 模式: 每个 test 用独立临时目录 + 独立 db，互不干扰
function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'muse-memory-test-'))
}

function makeConfig(dir) {
  return {
    memory: {
      dbPath: join(dir, 'test-memory.db'),
      maxEpisodicDays: 90,
    }
  }
}
```

> 和 `identity.test.mjs` 保持一致的临时目录模式，避免测试间污染。

---

## 8. 上下文参考

| 来源 | 路径 | 参考点 |
|------|------|--------|
| T01 脚手架 | `muse/config.mjs` | `memory.dbPath`, `maxEpisodicDays` 配置 |
| T02 身份 | `muse/core/identity.mjs` | 生命周期 pattern, structuredClone 防御 |
| T03 引擎 | `muse/core/engine.mjs` | session 管理 API (工作记忆代理) |
| Phase 1 地图 | `phase1/README.md` | 4 层记忆定义 + agent_id 预留 |
| 愿景文档 | `assistant-prep/muse-vision.md` | 记忆系统长期能力规划 |
| better-sqlite3 | npm 文档 | API 参考 (prepare/exec/pragma) |

---

## 9. 风险与决策记录

| 风险 | 应对 |
|------|------|
| SQLite 损坏 | WAL 模式 + busy_timeout；Phase 1 start 失败直接抛错；Phase 2 加 PRAGMA integrity_check |
| 并发锁竞争 | WAL 允许读写并发；busy_timeout = 5000ms |
| 记忆膨胀 | maxEpisodicDays 限制检索范围；Phase 2 小脑定期清理 |
| 搜索性能 | Phase 1 LIKE 够用（数据量小）；Phase 2 加 `episodic_embedding` 旁路表做向量索引 |
| token 估算不准 | Phase 1 字符数/4 粗略估算；Phase 2 换 tiktoken |
| 时区问题 | 统一用 SQLite datetime('now')，不用 JS Date |
| dbPath 目录不存在 | start() 内 mkdirSync(dirname, recursive) 自动创建 |
| stop 后误调用 | #ensureConnected() 抛明确错误 'Memory not started' |
| 非法 role 值 | CHECK(role IN ('user', 'assistant')) 约束 |

---

## 10. 完成定义 (DoD)

- [ ] `muse/core/memory.mjs` Memory 类完整实现
- [ ] SQLite schema: semantic_memory + episodic_memory + 索引 (含复合索引)
- [ ] WAL 模式 + busy_timeout 初始化
- [ ] start() 前 mkdirSync 保障目录存在
- [ ] #ensureConnected() 防御性检查
- [ ] role CHECK 约束
- [ ] 语义记忆: setMemory (upsert) / getMemory / deleteMemory / listMemories / searchMemories
- [ ] 情景记忆: addEpisode / updateEpisodeSummary / getRecentEpisodes / getSessionEpisodes / searchEpisodes / getRecentSummaries / getEpisodicStats
- [ ] getEpisodicStats 使用 COALESCE 防空表
- [ ] searchEpisodes limit 钳制 (1..100)
- [ ] agent_id 贯穿所有操作，Phase 1 默认 'muse'
- [ ] `start()/stop()/health()` 生命周期完整
- [ ] 29 项单元测试通过
- [ ] git commit
