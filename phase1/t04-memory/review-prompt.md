# T04 记忆层 — 评审指引

> 本文档告诉评审 agent 从什么角度、以什么标准来审核 T04 技术方案。

---

## 评审目标

请评审 `t04-memory/README.md` 的技术方案，确保 T04 记忆层的设计在实际开发中能正确实现并与其他模块顺利集成，不会返工。

---

## 需要阅读的文档

请在评审前完整阅读以下文件：

| 优先级 | 文件 | 理由 |
|--------|------|------|
| **必读** | `phase1/t04-memory/README.md` | 被评审的技术方案本体 |
| **必读** | `phase1/t04-memory/context.md` | 项目背景 + 已有模块的约定 |
| **必读** | `phase1/README.md` | Phase 1 总体任务地图 + 大脑/小脑架构 |
| 推荐 | `muse/config.mjs` | 已有的 memory 配置项 |
| 推荐 | `muse/core/identity.mjs` | 生命周期 pattern 已有实现（作为设计一致性参考） |
| 推荐 | `muse/core/identity.test.mjs` | 测试模式参考（临时目录 + 清理） |
| 推荐 | `muse/core/engine.mjs` | Session API（工作记忆代理，理解边界） |

---

## 评审维度

请从以下 6 个维度逐一评审，每个维度给出 **✅ 通过 / ⚠️ 需改进 / ❌ 有问题**，并附具体说明。

### 1. SQL Schema 设计

- `agent_id` 预留策略是否合理？DEFAULT 值 + UNIQUE 约束是否正确？
- 索引选择是否覆盖了主要查询路径？有没有遗漏的索引？
- `semantic_memory` 的 UNIQUE(agent_id, key) 是否满足去重需求？
- `episodic_memory` 不设 UNIQUE 是否合理（允许重复消息）？
- 字段类型选择：字符串日期 vs INTEGER 时间戳，各有什么 trade-off？
- 有没有缺少的字段（例如 metadata/tags/embedding 预留）？

### 2. Memory 类 API 设计

- API 命名是否清晰，和 Identity/Engine 的风格是否一致？
- CRUD 覆盖是否完整？有没有遗漏的常见操作？
- `searchMemories` 和 `searchEpisodes` 的 LIKE 模糊匹配在 Phase 1 是否够用？
- `getRecentSummaries` 只取 assistant 的 summary 是否合理？
- `getEpisodicStats` 返回的统计维度是否足够？
- 有没有 T05 编排层需要但 Memory 没提供的接口？
- 有没有潜在的 N+1 查询问题？

### 3. 生命周期与错误处理

- `start()/stop()/health()` 是否和 Identity/Engine 保持一致？
- start() 失败的场景覆盖：文件不存在、权限不足、schema 损坏
- stop() 后的行为：再调用方法是否安全？是否需要防御性检查？
- WAL 模式 + busy_timeout 的并发策略是否合理？
- 有没有资源泄漏风险（db 连接未关闭）？

### 4. 测试方案

- 22 个测试用例是否覆盖了所有核心路径？有没有遗漏的边界场景？
- 临时目录模式是否能保证测试隔离？
- agent_id 隔离测试（测试 #20）的设计是否有说服力？
- 有没有并发测试的需求（虽然 Phase 1 可以不做）？
- 测试命名和分组结构是否清晰？

### 5. 模块边界

- Memory 和 Identity 的职责划分是否清晰？有没有重叠？
- Memory 和 Engine 的边界（工作记忆代理）是否合理？
- T05 编排层的集成点描述是否完整？
- T07 Web 驾驶舱需要的接口是否都已提供？
- T08 小脑的并发读场景是否被充分考虑？

### 6. Phase 1/Phase 2 分期

- Phase 1 的范围是否足够（不做太多也不做太少）？
- 预留的扩展点是否合理（summary 字段、token_count、agent_id）？
- Phase 2 升级到 sqlite-vec 时需要做哪些 schema 变更？是否平滑？
- 有没有"Phase 1 应该做但没做"的功能？

---

## 评审输出格式

请按以下格式输出评审结果：

```markdown
# T04 记忆层 — 评审报告

## 总体评价
[一句话总结]

## 逐项评审

### 1. SQL Schema 设计 [✅/⚠️/❌]
[具体分析...]

### 2. Memory 类 API 设计 [✅/⚠️/❌]
[具体分析...]

### 3. 生命周期与错误处理 [✅/⚠️/❌]
[具体分析...]

### 4. 测试方案 [✅/⚠️/❌]
[具体分析...]

### 5. 模块边界 [✅/⚠️/❌]
[具体分析...]

### 6. Phase 1/Phase 2 分期 [✅/⚠️/❌]
[具体分析...]

## 必须修正 (Blockers)
[列出必须在开发前修正的问题，不修正不应开始编码]

## 建议改进 (Suggestions)
[列出建议但非必须的改进项，优先级排序]

## 确认通过的部分
[列出设计优秀、不需要修改的部分]
```

---

## 特别注意

1. **和已有代码的一致性**是最重要的评审标准——Memory 模块应该和 Identity/Engine 在风格、命名、模式上保持高度一致
2. **不要过度设计**——这是 Phase 1 MVP，LIKE 搜索、粗略 token 估算都是可接受的简化
3. **关注 T05 消费者视角**——编排层是 Memory 的主要消费者，API 设计应该对编排层友好
4. **并发安全**——小脑和主进程可能并发访问 SQLite，WAL 模式是否足够需要评估

---

# T04 记忆层 — 评审报告

## 总体评价

方案整体方向是对的，Phase 1 用 `better-sqlite3 + WAL + LIKE 检索` 这条路线足够务实，也和 T01-T03 的技术基线一致；但当前版本**还不建议直接开始开发**，因为有 `3` 个会导致返工的缺口：`summary` 回填链路缺 API、部分索引没有按 `agent_id` 设计、空库统计结果与测试目标不一致。

## 逐项评审

### 1. SQL Schema 设计 [⚠️]

优点：

- `semantic_memory` 用 `UNIQUE(agent_id, key)` 是合理的，能满足“同一 agent 的同一语义 key 只保留最新值”这个需求。
- `episodic_memory` 不做 UNIQUE 也对，情景记忆本来就应该允许重复消息。
- `agent_id DEFAULT 'muse'` 的预留策略是对的，Phase 1 单 agent、Phase 4 扩展多 agent 时都能平滑演进。
- `datetime('now')` 用 SQLite 侧统一时间，避免 JS 和 DB 两边时间源不一致，这个决策是成立的。

问题：

1. `episodic_memory` 的 session 查询路径没有建立复合索引。  
当前只有：
```sql
CREATE INDEX IF NOT EXISTS idx_episodic_session ON episodic_memory(session_id);
```
但实际查询是：
```sql
WHERE agent_id = ? AND session_id = ? ORDER BY created_at ASC
```
这意味着多 agent 后会越来越依赖回表和额外过滤。建议直接改成：
```sql
CREATE INDEX IF NOT EXISTS idx_episodic_agent_session
ON episodic_memory(agent_id, session_id, created_at);
```

2. `semantic_memory` 的 `idx_semantic_key ON semantic_memory(key)` 不够一致。  
由于所有查询都带 `agent_id`，单列 `key` 索引在多 agent 场景下价值有限，建议改为：
```sql
CREATE INDEX IF NOT EXISTS idx_semantic_agent_key
ON semantic_memory(agent_id, key);
```
虽然 `UNIQUE(agent_id, key)` 已经隐含一个唯一索引，但文档应明确依赖它，而不是再定义一个不完全匹配查询路径的普通索引。

3. 缺少对 `role` 的约束。  
现在 `episodic_memory.role` 只是 `TEXT NOT NULL`，但业务语义已经写死为 `user / assistant`。建议至少在实现层校验，或者在 schema 侧增加 `CHECK(role IN ('user','assistant'))`。否则后续很容易混入非法值，污染统计和摘要查询。

### 2. Memory 类 API 设计 [⚠️]

优点：

- API 命名整体清晰，和现有 `Identity` / `Engine` 风格一致，符合“一个类对外暴露明确职责”的模式。
- `setMemory / getMemory / deleteMemory / listMemories / searchMemories` 这组语义记忆 API 是完整的。
- `addEpisode / getRecentEpisodes / getSessionEpisodes / searchEpisodes / getRecentSummaries / getEpisodicStats` 这组情景记忆 API 基本覆盖了 T05 和 T07 的主要消费面。
- LIKE 模糊匹配作为 Phase 1 的检索方案是可接受的，不属于过度简化。

问题：

1. 缺少“回填摘要”的 API，这是当前最大的接口缺口。  
文档里多次强调：
- `summary` 是预留字段
- T05 会异步生成摘要后回填

但当前 API 只有 `addEpisode(..., summary = null)`，**没有 `updateEpisodeSummary()` / `setEpisodeSummary()` 之类的方法**。  
这会导致 T05 在摘要异步生成后，根本没有正式入口把摘要写回数据库，只能：
- 重复插入一条消息
- 或直接让上层自己写 SQL

这两个都不应该发生。这个问题属于开发前必须补齐的 blocker。

2. 缺少按 session 聚合摘要的接口。  
`getRecentSummaries(days)` 当前返回的是“最近 N 天所有有 summary 的 assistant 消息”。如果一个 session 未来有多条 summary 或多轮摘要，T05 实际上更可能需要“每个 session 最近一条摘要”或“按 session 聚合”。  
Phase 1 可以先保留现状，但建议文档明确：当前返回的是“消息级摘要”，不是“会话级摘要”。

3. `searchEpisodes(keyword, limit)` 没定义 `limit` 上界。  
虽然 SQL 参数化避免了注入，但如果上层把 limit 传成特别大的值，会直接放大 IO。建议在实现层做一个简单钳制，例如 `1..100`。

### 3. 生命周期与错误处理 [⚠️]

优点：

- `start()/stop()/health()` 形态和前面 T02/T03 保持一致，这点很好。
- `WAL + busy_timeout` 是符合上下文要求的合理方案，足以支撑 Phase 1 的主进程写、小脑并发读。
- `stop()` 关闭连接并清空 `#db`，没有明显资源泄漏。

问题：

1. `start()` 没处理父目录不存在的场景。  
`new Database(this.#config.memory.dbPath)` 在目录不存在时会直接失败。虽然当前默认路径在 `muse/data/` 下，大概率已经存在，但既然这是可配置路径，建议在 `start()` 前确保目录存在，避免一改路径就炸。

2. `stop()` 之后所有方法会抛出原始 `TypeError`，但文档没有定义这种行为。  
测试矩阵里写了“stop → 再调用方法 → 抛错”，这说明你已经接受“stop 后不可用”。这没问题，但最好显式做防御性检查，抛出更清晰的错误，例如：
```js
throw new Error('Memory not started')
```
这样比 `Cannot read properties of null` 更利于排障，也和 T02 的防御性风格更一致。

3. schema 损坏/数据损坏场景缺少明确策略。  
现在 `health()` 能 catch 查询错误，但 `start()` 里如果碰到已有库文件损坏，文档没有说明是直接抛错、还是尝试恢复、还是记录日志后降级。  
Phase 1 可以直接抛错，但建议把这个行为写明确。

### 4. 测试方案 [⚠️]

优点：

- `22` 项测试矩阵覆盖面已经相当完整，主路径、空库、幂等、agent 隔离都考虑到了。
- 临时目录 + 独立 db 的隔离模式是对的，也和现有 `identity.test.mjs` 保持了一致。
- `agent_id` 隔离单独列成测试项是加分项，说明你在为 Phase 4 提前保底。

问题：

1. 测试 #22 和当前 SQL 实现有潜在冲突。  
`getEpisodicStats()` 现在是：
```sql
SUM(token_count) as totalTokens
```
在 SQLite 空表上，`SUM(...)` 返回的是 `NULL`，不是 `0`。  
而测试目标写的是“零值统计”。这意味着当前设计和测试目标不一致。建议文档中明确使用：
```sql
COALESCE(SUM(token_count), 0) as totalTokens
```

2. 缺少“摘要回填”测试，因为 API 本身还不存在。  
既然 `summary` 是 Phase 1 设计的一部分，那么至少应该有一条测试验证“插入后再回填摘要”这条路径。

3. 缺少“目录不存在”或“路径无权限”的 start 失败测试。  
评审维度里明确要求考虑“文件不存在、权限不足、schema 损坏”，但测试矩阵里只覆盖了正常创建数据库，没有覆盖这些失败路径。

### 5. 模块边界 [✅]

这部分整体是清晰的。

- Memory 没有去重复实现身份记忆，明确委托给 T02，这个边界是对的。
- 工作记忆继续由 Engine 管，不把 session CRUD 混进 SQLite，也对。
- T05 作为主要消费者的调用链描述清晰，至少从职责上没有跑偏。
- T07 需要的浏览/搜索/统计接口大体都在。
- T08 的并发读场景与 WAL 模式是匹配的，Phase 1 够用。

这里唯一要补的是“摘要回填”接口，因为那是 T05 异步流程中的真实集成点，而不是抽象需求。

### 6. Phase 1/Phase 2 分期 [✅]

这部分拿捏得比较好，没有明显过度设计。

- Phase 1 用 LIKE 检索、粗略 token 估算、NULL summary，都是合理简化。
- `agent_id`、`summary`、`token_count` 这些扩展点预留得很到位。
- 从 SQLite 普通表升级到 sqlite-vec，也具备平滑演进空间。

唯一建议是再补一句：Phase 2 如果要做向量检索，最好不要直接改现有表，而是加一张 `episodic_embedding` / `semantic_embedding` 旁路表，迁移成本会更低。

## 必须修正 (Blockers)

1. 补一个正式的摘要回填 API，例如 `setEpisodeSummary(id, summary)` 或 `updateEpisodeSummary(sessionId, messageId, summary)`。没有这个接口，T05 的“异步生成摘要后回填”无法正式落地。
2. 把 `getEpisodicStats()` 的 `SUM(token_count)` 改成 `COALESCE(SUM(token_count), 0)`，否则空库统计和测试目标不一致。
3. 调整 `episodic_memory` 的索引设计，至少增加 `(agent_id, session_id, created_at)` 的复合索引，避免未来多 agent 下查询路径失真。

## 建议改进 (Suggestions)

1. 在实现层或 schema 层校验 `role` 只能是 `user / assistant`。
2. `start()` 前确保 `dbPath` 的父目录存在，减少配置变更时的脆弱性。
3. `stop()` 后的方法调用改成显式抛 `Memory not started`，不要依赖底层空指针错误。
4. 为 `searchEpisodes(limit)` 加一个合理上界，例如 `100`。
5. 明确 `getRecentSummaries()` 当前返回的是“消息级摘要”，不是“会话级摘要”。
6. 补 `start()` 失败场景测试：目录不存在、权限不足、损坏库文件。

## 确认通过的部分

1. `semantic_memory` / `episodic_memory` 这两个 Phase 1 主表划分是合理的，没有把工作记忆和身份记忆错误混进来。
2. `UNIQUE(agent_id, key)` 的语义记忆去重策略是正确的。
3. `episodic_memory` 不去重、保留完整消息流也是正确决策。
4. `WAL + busy_timeout` 作为 Phase 1 并发方案足够务实，符合大脑/小脑架构。
5. API 命名整体统一，和 T02/T03 的类接口风格一致。
6. 测试矩阵覆盖面广，说明方案已经考虑了实现落地，不只是停留在概念层。

---

# T04 记忆层 — 开发结果审核

## 总体评价

这次 `T04` 的实现质量整体不错，之前方案评审里提到的主要 blocker 基本都已经修掉了：摘要回填 API 已落地、空库统计的 `COALESCE` 已补、`role` 约束与目录自动创建也都做了。`memory.test.mjs` 我单独复跑，结果是 `30/30` 通过。  
但当前实现还存在 `2` 个值得在合并前修掉的问题，以及 `1` 个项目级验证风险。

## 主要发现

### 1. `start()` 不是严格幂等，重复启动会泄漏旧连接

当前实现：

```js
async start() {
  const dbPath = this.#config.memory.dbPath
  mkdirSync(dirname(dbPath), { recursive: true })

  this.#db = new Database(dbPath)
  this.#db.pragma('journal_mode = WAL')
  this.#db.pragma('busy_timeout = 5000')
  this.#db.exec(SCHEMA_SQL)
  this.#prepareStatements()
}
```

这里没有判断实例是否已经处于 started 状态。  
如果上层误调用两次 `start()`，新的 `Database(...)` 会直接覆盖旧的 `#db` 引用，而旧连接不会被关闭。这和测试名“重复调用 start 应幂等不抛错”并不一致，因为当前测试实际上覆盖的是：

```text
start -> stop -> start
```

而不是：

```text
start -> start
```

建议在 `start()` 开头加显式保护：

- 已经启动时直接 return
- 或者先关闭旧连接，再重新打开

否则后续集成到 orchestrator / daemon 时，生命周期误用会变成隐蔽资源泄漏。

### 2. 情景记忆查询没有真正补上稳定排序

你提到已经为 SQLite 秒级时间戳导致的同秒排序不稳定问题做了修复，并在 SQL 层追加了 `id DESC` 作为 tie-breaker。  
但我检查代码后，当前**只有语义记忆查询**真正加了 `id DESC`：

```js
listAll: '... ORDER BY updated_at DESC, id DESC'
listByCategory: '... ORDER BY updated_at DESC, id DESC'
search: '... ORDER BY updated_at DESC, id DESC'
```

情景记忆相关查询仍然只有 `created_at` 排序：

```js
recentEpisodes:  ORDER BY created_at DESC
sessionEpisodes: ORDER BY created_at ASC
searchEpisodes:  ORDER BY created_at DESC
recentSummaries: ORDER BY created_at DESC
```

而 `created_at` 仍然是 `datetime('now')`，只有秒级分辨率。  
这意味着：

- 同一秒插入多条 episode 时，`getRecentEpisodes()` 顺序仍可能不稳定
- 同一秒同 session 连续两条消息时，`getSessionEpisodes()` 的顺序也可能不稳定
- 搜索和摘要列表同样存在 tie-break 不确定性

如果你要真正解决这个问题，建议统一改为：

- `created_at DESC, id DESC`
- 或 `created_at ASC, id ASC`

并在相关测试里显式验证同秒插入的顺序。

### 3. `T04` 单测是绿的，但项目全量测试当前不能确认全绿

我单独执行了：

```bash
node --test muse/core/memory.test.mjs
```

结果是：

- `30/30` 通过
- 耗时约 `165ms`

但执行项目级：

```bash
npm test
```

在我这里当前会先在 `Engine — health check` 失败，不是 `T04` 测试本身失败。  
这看起来不像是 `Memory` 模块直接引入的问题，但它意味着“当前整个仓库测试已全绿”这个结论我无法确认。

## 已确认做对的部分

1. 方案评审中的 `3` 个 blocker 已基本修复：
   - 摘要回填 API：已加 `updateEpisodeSummary()`
   - 空库统计：已用 `COALESCE(SUM(...), 0)`
   - 目录不存在：`start()` 已自动 `mkdir -p`
2. `role` 的 `CHECK(user, assistant)` 已补，这是比文档更进一步的质量提升。
3. `#ensureConnected()` 让 stop 后错误语义更明确，明显优于空指针报错。
4. SQL 顶层常量 + prepared statements 缓存这次做得不错，结构比最初方案更稳。
5. `searchEpisodes(limit)` 的上界钳制也补上了，防止 Web/T05 误传超大 limit 放大 IO。
6. Multi-Agent 隔离测试和空库边界测试都真正落到了代码里，这点是加分项。

## 结论

`T04` 当前可以判断为：**基本可合并，但建议在合并前再补一轮小修**。

优先级建议：

1. 修 `start()` 的重复启动幂等性
2. 给所有情景记忆查询补上 `id` 作为稳定排序 tie-breaker
3. 再跑一次全量 `npm test`，确认项目级没有其他模块红灯
