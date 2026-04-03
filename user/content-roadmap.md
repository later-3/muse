# 自媒体内容路线图

> **核心定位：** 「程序员视角 · 第一性原理 · 边学边做 · Muse 是产品也是教学项目」  
> **差异化：** 不追热点，走"讲透原理 + 真实项目验证 + 开源可复刻"路线  
> **节奏：** 每周 1-2 期内容，每期 = 理论讲解 + Muse 实践 + 代码演示

---

## 全局 Muse 功能 → 内容映射

> Muse 不仅是开源教学项目，更是产品。每个阶段的学习产出 = 一个 Muse 版本升级 + 一组自媒体内容。

```
Phase 1 学习产出 → Muse v0.1 (能对话的最简 Agent)
Phase 2 学习产出 → Muse v0.2 (有记忆/有工具/多角色)
Phase 3 学习产出 → Muse v1.0 (生产级/可部署/有个性)
```

### Muse 现有功能与内容对应

| Muse 功能 | 状态 | 对应理论 | 对应内容期数 |
|-----------|------|---------|------------|
| 🧠 有记忆 (语义记忆+情景对话) | ✅ 已实现 | 2.4 Memory 架构 | P2-04 |
| 🎭 有性格 (MBTI/性格滑块/语言风格) | ✅ 已实现 | 3.5 Identity/Persona | P3-05 |
| 🌱 会成长 (记忆积累/能力学习/性格塑造) | ✅ 已实现 | 2.4 + 3.5 + 2.6 评估 | P3-05 |
| 💬 可触达 (Telegram+Web+语音) | ✅ 已实现 | 3.3 多通道集成 | P3-03 |
| 🔍 能自检 (三层健康检测) | ✅ 已实现 | 3.2 可观测性 | P3-02 |
| 🔧 可扩展 (MCP+Plugin+Skill) | ✅ 已实现 | 2.2 Tool Use/MCP | P2-02 |
| 👥 多角色协作 (Family+Harness) | ✅ 已实现 | 2.5 Multi-Agent | P2-05 |
| 🗣️ 语音通话 (STT/TTS) | 🚧 进行中 | 3.3 多通道 | P3-03 |
| 🏘️ 社区&关系 (Muse社交) | 📐 规划中 | — (新方向) | P3-06+ |
| 🎮 Playground (共创应用) | 📐 规划中 | — (新方向) | P3-06+ |
| 🛡️ 自我开发引擎 (T37) | ✅ 已实现 | 2.7 Guardrails + 2.5 编排 | P2-07 |
| 🎯 Goal 系统 (T35) | ✅ 已实现 | 2.4 Memory + Agent 主动性 | P2-06 |
| 🧵 Life Threads (T36) | ✅ 已实现 | 2.4 Memory + 3.5 Identity | P3-05 |
| ❤️ Pulse 主动性引擎 (T30-T33) | ✅ 已实现 | Agent Heartbeat/Cron | P2-06 |

---

## Phase 1 内容序列 (第 1-4 周)

> **主题：LLM 基座 → 理解 Agent 的引擎**  
> **Muse 产出：v0.1 — 最简对话 Agent (能跑起来、能对话)**

| 期数 | 标题 (自媒体) | 理论节点 | Muse 实践 | 代码演示 |
|------|-------------|---------|-----------|---------|
| **P1-01** | 「手撕 Transformer：200 行 Python 理解 AI 大脑」 | 1.1 Transformer | — | nanoGPT 训练 + attention 可视化 |
| **P1-02** | 「为什么 AI 觉得中文更贵：BPE 原理拆解」 | 1.2 Tokenization | — | minbpe 实现 + 中英文 token 对比 |
| **P1-03** | 「LLM 的三次进化：从乱说话到听指令」 | 1.3 训练管线 | — | Colab 微调演示 |
| **P1-04** | 「AI 对话越长越慢？KV Cache 原理」 | 1.4 推理优化 | — | Ollama 本地模型 + 速度测量 |
| **P1-05** | 「AI 真的在思考吗：Reasoning 机制拆解」 | 1.5 Reasoning | — | 对比开/关 Reasoning 效果 |
| **P1-06** | 「50 行代码实现 Agent 核心循环」 | 1.6 Agent 定义 | **Muse v0.1 启动** | ReAct loop 实现 |
| **P1-07** | 「李宏毅拆 OpenClaw：AI Agent 原理一课搞懂」 | 1.5+1.6 综合 | Muse v0.1 对比 OpenClaw | 课程笔记 + 代码对照 |
| **P1-08** | 「Phase 1 复盘：从零理解 LLM 到写出第一个 Agent」 | 全部 | **Muse v0.1 发布** | 完整 demo 视频 |

### P1 里程碑

- **Muse v0.1** = 能通过 Telegram 对话的最简 Agent（用 OpenCode 做底座）
- **内容资产** = 8 期视频/图文 + 1 个可 fork 的 GitHub 仓库
- **粉丝目标** = 技术社区种子用户（GitHub Star + B站关注）

---

## Phase 2 内容序列 (第 5-10 周)

> **主题：Agent 核心技能 → 让 Agent 有用**  
> **Muse 产出：v0.2 — 有记忆、有工具、会协作的 Agent**

| 期数 | 标题 (自媒体) | 理论节点 | Muse 功能实践 | 对应 Muse Task |
|------|-------------|---------|-------------|----------------|
| **P2-01** | 「系统 Prompt 的 7 层架构：为什么你写的不如 Claude Code」 | 2.1 Prompt Eng | Identity 三层合并 · AGENTS.md 生成 | T12 |
| **P2-02** | 「MCP 协议拆解：AI 的 USB 接口」 | 2.2 Tool Use/MCP | MCP 工具服务器 · 3 个自定义工具 | T10, T10.5 |
| **P2-03** | 「Agent 上下文爆炸怎么办：Compaction 实战」 | 2.3 Context Eng | Compaction Hook · Session 管理 | T13 |
| **P2-04** | 「Agent 的三种记忆：为什么 ZeroClaw 不用 Pinecone」 | 2.4 Memory | Memory MCP · SQLite 语义检索 | T11 |
| **P2-05** | 「多 Agent 协作：我用 JS 重写了 Swarm 的 Handoff」 | 2.5 Multi-Agent | Family Harness · Planner→Worker 流程 | Harness |
| **P2-06** | 「让 Agent 主动找你：Pulse 引擎 + Goal 系统」 | 2.4+Heartbeat | Pulse 主动推送 · Goal CRUD | T30-T33, T35 |
| **P2-07** | 「Agent 自我开发：Muse 怎么给自己写代码」 | 2.5+2.7 | 自我开发引擎 (DevGuard+TaskOrchestrator) | T37 |
| **P2-08** | 「吴恩达说评估是成功的最大预测指标：我验证了」 | 2.6 评估 | 3 层测试体系 · Trace Reader | — |
| **P2-09** | 「AI Agent 安全：ZeroClaw 14 层防御我学到了什么」 | 2.7 安全 | 审批门控 · permission.ask | — |
| **P2-10** | 「Phase 2 复盘：Muse v0.2 — 一个有记忆有工具的 AI 伙伴」 | 全部 | **Muse v0.2 发布** | — |

### P2 里程碑

- **Muse v0.2** = 有记忆(T11) + 有工具(T10) + 有人格(T12) + 多角色协作(Harness) + 主动性(T30-T35) + 自我开发(T37)
- **内容资产** = 10 期 + P1 的 8 期 = 累计 18 期
- **粉丝目标** = 开发者群体（"想自己做 Agent"的人）

---

## Phase 3 内容序列 (第 11-16 周)

> **主题：开源拆解 → 生产级 Muse**  
> **Muse 产出：v1.0 — 可部署、有个性、多通道的产品**

| 期数 | 标题 (自媒体) | 理论节点 | Muse 功能实践 | 参考项目 |
|------|-------------|---------|-------------|---------|
| **P3-01** | 「三大开源 Agent 运行时深度对比」 | 3.1 架构比较 | Muse 架构设计决策 | OC vs OD vs ZC |
| **P3-02** | 「Agent 的自我修复：Muse 怎么实现"主动告警"」 | 3.2 可观测性 | AI Health Insight · 三层自检 | T34 |
| **P3-03** | 「一个 Agent 怎么同时听懂文字、看懂图片、听懂语音」 | 3.3 多通道 | Telegram+Web+语音 · PerceptionObject | T14, T14.5, T38 |
| **P3-04** | 「$10 跑 AI Agent：树莓派极限测试」 | 3.4 部署 | Muse 本地部署 · Ollama 对比云端 | ZC benchmark |
| **P3-05** | 「AI 伙伴的灵魂：让每个 Muse 都独一无二」 | 3.5 Identity | MBTI 性格 · Life Threads · Goal 系统 | T22, T35, T36 |
| **P3-06** | 「Agent 的 10 种死法：失败恢复策略全解」 | 3.6 失败恢复 | 3 层降级路径 · Model Failover | agent-research-map |
| **P3-07** | 「Muse Family：你的 AI 家族怎么协作」 | Multi-Agent 综合 | Family 管理 · 跨 Agent Handoff | — |
| **P3-08** | 「从开源到产品：Muse v1.0 发布！」 | 全部综合 | **Muse v1.0 发布** + 完整 demo | — |

### P3 里程碑

- **Muse v1.0** = Phase 3D 全部完成 + 真实用户可用的产品
- **内容资产** = 8 期 + P1P2 的 18 期 = 累计 **26 期完整课程**
- **粉丝目标** = 产品用户（"想用 Muse"或"改造 Muse 做自己产品"的人）

---

## 内容矩阵：理论 × Muse × 自媒体

```
                Theory Panorama                    Muse Product
                ─────────────────                  ────────────
P1: LLM 基座    Transformer/BPE/训练/推理          Muse v0.1 (最简 Agent)
                     ↓ 讲透原理                        ↓ 跑起来
                     
P2: Agent 技能  Prompt/Tool/Memory/Multi-Agent     Muse v0.2 (有记忆有工具)
                     ↓ 掌握零件                        ↓ 功能完整
                     
P3: 生产级      架构对比/可观测/部署/安全/个性      Muse v1.0 (可发布产品)
                     ↓ 拆解真实项目                    ↓ 真实用户
                     
                ─────────────────────────────────────────────────
                → 每一期内容 = 一个理论 + 一个 Muse 功能 + 一段代码
```

---

## 内容生产 SOP

### 每期内容标准格式

```
1. 开场 (30s): 抛出一个程序员关心的问题
   例: "为什么你的 AI Agent 对话越长越慢？"

2. 理论 (3-5min): 从第一性原理解释
   例: "KV Cache 的本质是什么？Attention 计算为什么是 O(n²)？"

3. 代码 (3-5min): 在 Muse 中实践验证
   例: "我在 Muse 中实现了 XXX，效果对比如下..."

4. 产品思考 (1min): 这对做产品意味着什么
   例: "这就是为什么 Muse 设计了 Compaction 机制"

5. 结尾 (30s): 引导 GitHub Star + 下一期预告
```

### 多平台分发策略

| 平台 | 形式 | 优势 | 优先级 |
|------|------|------|--------|
| **GitHub** | README + 代码 + Issue | 技术信任 + SEO + 长尾 | ⭐⭐⭐ |
| **B 站** | 10-15min 技术视频 | 中文技术受众最大 | ⭐⭐⭐ |
| **知乎** | 深度长文 | SEO + 专业背书 | ⭐⭐ |
| **小红书** | 短图文/信息图 | 破圈 + 非技术用户 | ⭐⭐ |
| **Twitter/X** | 英文 thread | 全球开发者 | ⭐ |
| **YouTube** | 英文版视频 | 全球流量（后期） | ⭐ |

### 内容复用策略

```
一个理论节点 → 多种形式产出:

1. B站视频 (10-15min 完整版)
2. 知乎长文 (视频文字稿 + 补充细节)
3. 小红书 (信息图 + 核心要点)
4. GitHub (代码 + 笔记 + Muse commit)
5. README 更新 (记录在 Muse 学习路径中)

投入产出比: 1次深度研究 → 5种内容形式
```

---

## 粉丝增长路径

```
Phase 1 (种子期):
  目标受众: 想学 AI 的程序员
  增长引擎: GitHub Star + B站搜索流量
  钩子: "手撕 Transformer" / "50 行代码实现 Agent"
  预期: 500-2000 粉丝

Phase 2 (增长期):
  目标受众: 想做 AI 产品的开发者
  增长引擎: Muse 开源社区 + 技术媒体转载
  钩子: "MCP 拆解" / "多 Agent 协作" / "Agent 自我开发"
  预期: 2000-10000 粉丝

Phase 3 (破圈期):
  目标受众: 想用 AI 伙伴的普通用户
  增长引擎: 产品体验 + 口碑传播
  钩子: "Muse v1.0 发布" / "$10 跑 Agent" / "AI 伙伴的灵魂"
  预期: 10000+ 粉丝
```

---

## 变现路径（Phase 4 融入前三阶段）

| 阶段 | 变现方式 | 说明 |
|------|---------|------|
| Phase 1 | 免费内容 + GitHub Star | 积累信任，不急变现 |
| Phase 2 | 付费进阶课程 / 技术咨询 | "跟我一起从零做 AI Agent" 小课 |
| Phase 3 | Muse 增值服务 / 硬件套件 | Muse Pro 版 / 树莓派 Agent 套件 |
| 持续 | 社区会员 / 企业咨询 | 基于 Muse 的定制化 Agent 开发 |

---

## 启动清单 ✅

> **立即可做（本周）：**

1. [ ] 确认首发平台（建议 B 站 + GitHub 双发）
2. [ ] 录制 P1-01「手撕 Transformer」的代码演示
3. [ ] 在 Muse README 中加入"学习路线"入口
4. [ ] 发 B 站第一条「我的 AI Agent 自媒体计划 + Muse 介绍」
5. [ ] 设置 GitHub Project Board 追踪内容产出

> **前提条件：**
> - nanoGPT 和 minbpe 可以跑通 (已在 user/reference/repos/)
> - Muse v0.1 的 Telegram 对话功能正常 (已实现)
> - 屏幕录制工具准备好
