# T09 集成联调

> **Phase 1 收口任务** — 不是"最后盖章"，是集中暴露和收口系统级风险。

---

## 1. 背景

### 当前真实状态

| 模块 | 单元测试数 | 状态 | 已知风险 |
|------|-----------|------|---------|
| T01 config | 8 | ⚠️ env 隔离问题致部分失败 | 顶层导出冻结快照 |
| T02 identity | 17 | ✅ | 数据结构与 Web 编辑的契约未验证 |
| T03 engine | 52 (含契约) | ✅ | 双端点探针已修，未做集成级验证 |
| T04 memory | 30 | ✅ | — |
| T05 orchestrator | 31 | ✅ | 上下文膨胀问题（Backlog） |
| T06 telegram | — | ⚠️ Telegraf mock 不完整 | 手动验证为主 |
| T07 web | 17 | ⚠️ **API 测试通过但未验证与 Identity 数据结构的契约对齐** | 身份编辑写入格式可能与 T02 不一致 |
| T08 cerebellum | 13 | ✅ (评审修复后) | start() 回滚、GC 真实性刚修过，集成环境未验 |
| index | 14 | ✅ | Web 优先启动的降级路径未做集成级验证 |

> ⚠️ 这些数字是单元测试层面的结果。**模块间协作、降级路径、诊断闭环在集成层面尚未验证**。

### T09 要回答的 3 个核心问题

1. **Web 诊断入口是否可靠？** — Engine 挂了，Web 能不能提供真实降级状态而不是空页面？
2. **T02/T07 契约是否对齐？** — Web 编辑身份后，Identity 是否正确加载？字段名/类型/嵌套结构是否一致？
3. **T08 失败语义是否可信？** — start() 失败回滚、GC 中 DELETE 500 不计数，在集成环境中是否真正可靠？

---

## 2. 验收标准

### Phase 1 原有标准

| # | 场景 | 验证方式 | 涉及模块 |
|---|------|---------|---------|
| ① | Telegram 发消息 → 收到有人格的回复 | 手动 | T06→T05→T03→T02 |
| ② | 第二天继续聊 → 她记得昨天的内容 | 手动 | T05→T04 |
| ③ | 问复杂问题 → 自动切换到更强模型 | 自动 | T05 |
| ④ | Web 页面能配置她的名字和性格 | 自动 | T07→T02 |
| ⑤ | kill 大脑 → 小脑 30s 内自动重启 | 手动 | T08→T03 |
| ⑥ | kill 小脑 → launchd 拉起 → 小脑拉起大脑 | 手动 | T08+launchd |

### T09 新增收口标准 (基于评审暴露的系统级风险)

| # | 场景 | 验证方式 | 风险来源 |
|---|------|---------|---------|
| ⑦ | Web 在 Engine 失败时仍可访问且显示降级状态 | 自动 | T07 评审 |
| ⑧ | Web 身份编辑 → Identity 数据结构完全对齐 | 自动 | T02/T07 契约 |
| ⑨ | Cerebellum start() 失败后 health() 返回 ok=false | 自动 | T08 评审 |
| ⑩ | Cerebellum session GC 在真实 mock 下正确清理 | 自动 | T08 评审 |
| ⑪ | Cerebellum.health() 可被系统级读取并展示 | 自动 | 诊断闭环 |
| ⑫ | 已有全部稳定单元测试仍然通过 | 自动 | 回归 |

---

## 3. 开发方案

### 3.1 自动化集成测试 — `muse/integration.test.mjs`

> 不依赖外部服务 (OpenCode / Telegram)，用 mock + DI 验证模块协作。

| # | 测试 | 描述 | 对应验收 |
|---|------|------|---------|
| IT-01 | 模块创建 | `createModules()` → 所有模块实例存在且类型正确 | — |
| IT-02 | 启动顺序 | Web 最先 → Identity → Memory → Engine → Telegram | — |
| IT-03 | 优雅关闭 | `stopAll()` → 逆序关闭，无异常 | — |
| IT-04 | DI 连接 | Orchestrator 收到消息 → 调 Identity + Memory + Engine | ① |
| IT-05 | 记忆持久化 | 写入语义记忆 → 重新创建 Memory → 能读出 | ② |
| IT-06 | 身份热更契约 | Web PUT /api/identity → Identity 加载 → **字段名/类型/嵌套结构**一致 | ⑧ |
| IT-07 | 意图路由 | 短消息 → lightweight, 代码问题 → heavyweight | ③ |
| IT-08 | Web 降级 | Engine mock 不可用 → Web 仍在线 → health API 返回 cortex: unreachable | ⑦ |
| IT-09 | Cerebellum 失败回滚 | start() 失败 → health().ok === false + lastFailureReason 有值 | ⑨ |
| IT-10 | Cerebellum GC 真实性 | 通过可测试入口触发 session GC → expired 被删 + 500 不计数 + fresh 保留 | ⑩ |
| IT-11 | 诊断可读取 | Cerebellum.health() 结果可通过 Web `/api/health` 聚合读取 | ⑪ |

### 3.2 手动验证清单 — `phase1/t09-integration/manual-checklist.md`

每条手动验收**必须记录**:

| 字段 | 说明 |
|------|------|
| 日期 | 验证日期 |
| 环境 | Node 版本、OpenCode 版本、Telegram Bot ID |
| 输入 | 发送的消息/执行的命令 |
| 预期 | 应该看到什么 |
| 实际 | 实际看到什么 |
| 证据 | 关键日志片段 / 截图 / session ID |
| 结论 | ✅ 通过 / ❌ 失败 + 原因 |

> ⑤⑥ 守护链路必须记录：kill 时间、重启时间、日志片段，否则 "30s 内自动重启" 只能靠口头描述。

---

## 4. 交付物

| 文件 | 内容 |
|------|------|
| `muse/integration.test.mjs` | 11 项自动化集成测试 |
| `phase1/t09-integration/manual-checklist.md` | 结构化手动验证记录 |
| EXPERIENCE.md 更新 | 联调新 bug (如有) |

---

## 5. 不做什么

- ❌ 不做端到端自动化 (需真实 Telegram Bot + OpenCode)
- ❌ 不做性能测试
- ❌ 不做小脑诊断的完整 Web 页面 — 但**必须验证** health() 数据可被系统级读取

---

## 6. 上下文参考

| 来源 | 路径 | 参考点 |
|------|------|--------|
| 系统入口 | `muse/index.mjs` | `createModules()` DI + 5 阶段启动 |
| 踩坑记录 | `phase1/EXPERIENCE.md` | BUG-001 到 BUG-014 |
| T08 上下文 | `phase1/t08-daemon/context.md` | Engine API 真实行为 |
| T08 评审修复 | `muse/daemon/cerebellum.mjs` | start() 回滚 + GC 可测试性 |
| 验收标准 | `phase1/README.md` L273-279 | 6 条原始标准 |
