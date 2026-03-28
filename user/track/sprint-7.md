# Sprint 7：S3 (审批) + S2b (自开发闭环) + S4 语音 Spike

> **Sprint 主目标：** 实现 S3 审批链路 + S2b 自开发闭环 + 最小可观测性，完成 Muse Basic v1 全部 5 项能力。  
> **Side quest：** 语音通话 Spike（S4 是扩展场景，不阻塞 MVP）。  
> **服务于：** Phase 5（迭代开发）  
> **前置条件：** Sprint 6 完成，S1 + S2 跑通  
> **退出条件：** Muse Basic v1 全部 5 项能力达标

---

## 每日任务清单

### 第 1 天：S3 Technical Design（审批）

- [ ] 写 S3 技术设计：Governance 拦截 + 审批流实现方案
  - 动作分类规则如何定义
  - 审批请求如何发送给 planner
  - 批准/拒绝/超时如何处理
- [ ] 产出：`make-muse/technical-design/td-s3-governance.md`

### 第 2-3 天：S3 实现 + 验证

- [ ] 实现动作拦截器（高风险动作识别）
- [ ] 实现审批请求/响应机制
- [ ] 实现超时处理
- [ ] 代码合入 `muse/src/`
- [ ] 跑通验证：arch 触发高风险动作 → planner 审批 → 执行/阻止

### 第 4 天：S2b Technical Design（自开发闭环）

- [ ] 写 S2b 技术设计：
  - 触发机制：Muse 怎么「发现自身问题」？（日志异常 / test 失败 / 人工触发）
  - 立项流程：planner 如何自动创建 harness 工作流来修自己？
  - 安全约束：修改自身代码时需要哪些额外 Guardrails？（防止自毁）
  - 和 S2 harness 的关系：S2b 是 S2 的特例（target = muse 自身）还是独立链路？
- [ ] 产出：`make-muse/technical-design/td-s2b-self-dev.md`

### 第 5-6 天：S2b 实现

- [ ] 实现自开发触发器（至少支持：人工触发 + test 失败自动触发）
- [ ] 实现 self-target harness（worker 操作对象 = muse 自身的 docs/code/test）
- [ ] 实现安全约束（核心文件修改走 S3 审批 → S2b 和 S3 联动）
- [ ] 代码合入 `muse/src/`

### 第 7 天：S2b 验证 + 最小可观测性

- [ ] S2b 跑通验证：
  - Muse 发现问题 → planner 立项 → worker 修改自己的代码 → reviewer 审查 → 汇报
- [ ] 最小可观测性实现：
  - 接通全链路 trace（基于现有 muse-trace，确保 S1/S2/S2b/S3 全覆盖）
  - 实现关键指标采集：任务成功率 / 平均延迟 / 错误率
  - 最小看板：至少能 CLI 查询或 Web Cockpit 展示

### 第 8-9 天：语音通话 Spike（Side Quest）

- [ ] 研究 Voice 技术栈：Whisper STT、TTS、VAD
- [ ] 实现最小语音通话：Telegram 语音消息 → STT → LLM → TTS → 回复
- [ ] 代码存放：`user/spikes/spike-voice/`
- [ ] 产出语音研究笔记：`user/research/voice-realtime-research.md`

### 第 10 天：Sprint 7 复盘

- [ ] mini-eval（对齐 Muse Basic v1 硬验收）：
  - [ ] ✅ 能力 1：会话与记忆跑通？（S1，Sprint 6 已验证）
  - [ ] ✅ 能力 2：任务协作跑通？（S2，Sprint 6 已验证）
  - [ ] ✅ 能力 3：审批治理跑通？（S3）
  - [ ] ✅ 能力 4：自开发闭环跑通？（S2b）
  - [ ] ✅ 能力 5：最小可观测性达标？（trace + 指标）
  - [ ] 语音 Spike 基本可用？（Side Quest，不阻塞）
- [ ] 写复盘：`user/sprint-7-retro.md`
- [ ] 开始准备 demo（S1+S2+S2b+S3 端到端演示）

---

## 交付物清单

| # | 交付物 | 对应能力 | 状态 |
|---|-------|---------|------|
| 1 | `make-muse/technical-design/td-s3-governance.md` | 能力 3 审批 | [ ] |
| 2 | S3 审批代码（合入 `muse/src/`） | 能力 3 | [ ] |
| 3 | S3 端到端验证通过 | 能力 3 | [ ] |
| 4 | `make-muse/technical-design/td-s2b-self-dev.md` | 能力 4 自开发 | [ ] |
| 5 | S2b 自开发代码（合入 `muse/src/`） | 能力 4 | [ ] |
| 6 | S2b 端到端验证通过 | 能力 4 | [ ] |
| 7 | 最小可观测性实现（trace 全覆盖 + 指标采集 + 最小看板） | 能力 5 | [ ] |
| 8 | `user/research/voice-realtime-research.md` | Side Quest | [ ] |
| 9 | `user/spikes/spike-voice/` (代码) | Side Quest | [ ] |
| 10 | `user/sprint-7-retro.md` | — | [ ] |
