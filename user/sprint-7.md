# Sprint 7：S3 (审批) + S4 语音探索（side quest）

> **Sprint 主目标：** 实现 S3 审批链路，完成 MVP 三场景闭环。  
> **Side quest：** 语音通话研究和可行性 Spike（S4 是扩展场景，不阻塞 MVP）。  
> **服务于：** Phase 5（迭代开发）— S3 治理 + S4 语音  
> **前置条件：** Sprint 6 完成，S1 + S2 跑通

---

## 每日任务清单

### 第 1 天：S3 Technical Design（审批）

- [ ] 写 S3 技术设计：Governance 拦截 + 审批流实现方案
  - 动作分类规则如何定义
  - 审批请求如何发送给 planner
  - 批准/拒绝/超时如何处理
- [ ] 产出：`user/technical-design/td-s3-governance.md`

### 第 2-3 天：S3 实现

- [ ] 实现动作拦截器（高风险动作识别）
- [ ] 实现审批请求/响应机制
- [ ] 实现超时处理
- [ ] 代码合入 `muse/src/`

### 第 4 天：S3 验证

- [ ] 跑通：arch 触发高风险动作 → planner 审批 → 执行/阻止
- [ ] 记录验证结果

### 第 5-6 天：语音通话研究

- [ ] 研究 Voice 技术栈：Whisper STT、TTS、VAD、WebRTC
- [ ] 走读 Pipecat / LiveKit / 现有 Muse voice 代码
- [ ] 产出：`user/research/voice-realtime-research.md`

### 第 7-8 天：语音通话 Spike

- [ ] 实现最小语音通话：Telegram 语音消息 → STT → LLM → TTS → 回复
- [ ] 代码存放：`user/spikes/spike-voice/`
- [ ] 验证基本通话质量

### 第 9 天：S4 路线决策

- [ ] 根据 Spike 结果决定：S4 用 Telegram 语音消息还是 WebRTC 实时通话
- [ ] 如果选 WebRTC，规划后续实现

### 第 10 天：Sprint 7 复盘

- [ ] mini-eval：
  - [ ] S3 审批链路跑通？
  - [ ] 语音 Spike 基本可用？
  - [ ] 所有 3 个 MVP 场景（S1/S2/S3）端到端跑通？
- [ ] 写复盘：`user/sprint-7-retro.md`
- [ ] 开始准备 demo（S1+S2+S3 端到端演示）

---

## 交付物清单

| # | 交付物 | 状态 |
|---|-------|------|
| 1 | `user/technical-design/td-s3-governance.md` | [ ] |
| 2 | S3 审批代码（合入 `muse/src/`） | [ ] |
| 3 | S3 端到端验证通过 | [ ] |
| 4 | `user/research/voice-realtime-research.md` | [ ] |
| 5 | `user/spikes/spike-voice/` (代码) | [ ] |
| 6 | `user/sprint-7-retro.md` | [ ] |
