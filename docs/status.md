# Muse 项目状态全景

> 最后更新: 2026-03-15 · 权威状态源: [`PROJECT_STATE.json`](../PROJECT_STATE.json)

---

## 一、定量概览

| 指标 | 数值 |
|------|------|
| 生产代码 | **13,381 行** (36 个 .mjs) |
| 测试代码 | **7,437 行** (28 个 .test.mjs) |
| 测试用例 | **455 个** (112 suites) |
| 通过率 | **100%** |
| 实现任务数 | **22 个** |

---

## 二、Phase 全景图

```
Phase 1    基础骨架              ██████████ 100%  ✅ T01-T09
Phase 2    Agent 化              ██████████ 100%  ✅ T10-T17
Phase 2.5  健康自检              ██████████ 100%  ✅ selfCheck + 架构愿景
Phase 3A   基础设施              ██████████ 100%  ✅ T20-T23
Phase 3B   主动性引擎            ██████████ 100%  ✅ T30-T33
─────────────────────────── 已完成 ↑  规划中 ↓ ───────────────────────────
Phase 4    家族 + 自我开发       ░░░░░░░░░░   0%  📋 规划文档已有
Phase 5    实体化                ░░░░░░░░░░   0%  📋 规划文档已有
Phase 6    Muse 社区             ░░░░░░░░░░   0%  📋 ARCHITECTURE.md 愿景
```

### Phase 3 子阶段说明

Phase 3 拆为 **3A (基础设施)** 和 **3B (主动性引擎)** 两个子阶段，均已完成。

原 Phase 3 README 列了但**未排入任务**的内容:
- **Goal 系统** — 结构化目标跟踪，放入 Phase 4 或后续独立排期
- **Life Threads** — 碎片记忆串成脉络，放入 Phase 4 或后续独立排期
- **AI 自我解读** — selfCheck → AI 分析，可作为 T34 排入

> ⚠️ **没有 Phase 3C**。Phase 3 只有 3A 和 3B。上述未做项属于规划范围但未排任务。

---

## 三、已实现模块清单

### Phase 1: 基础骨架 (T01-T09)

| 模块 | 文件 | 行数 | 职责 |
|------|------|------|------|
| Identity | `core/identity.mjs` | 498 | 人格加载 / 热更 / buildSystemPrompt / boundaries |
| Memory | `core/memory.mjs` | 463 | SQLite 语义+情景记忆 |
| Engine | `core/engine.mjs` | 415 | OpenCode REST API 桥接 |
| Orchestrator | `core/orchestrator.mjs` | 112 | 消息路由 + session |
| Telegram | `adapters/telegram.mjs` | 504 | Bot 消息收发 + 主动推送 |
| Web | `web/api.mjs` | 523 | 15+ API 端点驾驶舱 |
| Cerebellum | `daemon/cerebellum.mjs` | 383 | 进程守护 / 心跳 / GC / 重启 |
| Config | `config.mjs` | 56 | 环境变量加载 |
| Index | `index.mjs` | 242 | DI 容器 + 生命周期 |

### Phase 2: Agent 化 (T10-T17)

| 模块 | 文件 | 职责 |
|------|------|------|
| Skill | `skill/skill.mjs` | Skill 加载器 + 规范 |
| Plugin | `plugin/plugin.mjs` | OpenCode Plugin + 4 Hook |
| MCP Memory | `mcp/memory.mjs` | 记忆 MCP Server |
| Perception | `perception/ingress.mjs` | 统一感知入口 + Channel |
| Registry | `capability/registry.mjs` | 能力注册表 (6 senses + 8 caps) |
| Gap Journal | `capability/gap-journal.mjs` | 能力缺口记录 |
| Router | `capability/router.mjs` | 8 层执行路由 + 分类器 |

### Phase 2.5: 健康自检

| 模块 | 文件 | 职责 |
|------|------|------|
| selfCheck | `daemon/self-check.mjs` | 三层报告 (System/SelfModel/Life) |

### Phase 3A: 基础设施 (T20-T23)

| 模块 | 文件 | 职责 |
|------|------|------|
| Config Loader | `family/config-loader.mjs` | 4 层配置加载 |
| Init | `family/init.mjs` | FAMILY_HOME 初始化 |
| Migrate | `family/migrate.mjs` | 迁移工具 |
| CLI | `family/cli.mjs` | `muse init` 命令行 |

### Phase 3B: 主动性引擎 (T30-T33)

| 模块 | 文件 | 职责 |
|------|------|------|
| Pulse | `daemon/pulse.mjs` | 触发器注册 + 调度 |
| PulseState | `daemon/pulse-state.mjs` | 状态持久化 |
| Pulse Actions | `daemon/pulse-actions.mjs` | AI 生成 + Telegram 推送 |
| Anti-Spam | `daemon/anti-spam.mjs` | DND / 静音 / 频率控制 / 降频 |
| Health History | `daemon/health-history.mjs` | selfCheck 定时 + 趋势检测 |

---

## 四、端到端链路覆盖

| 链路 | 状态 | 覆盖方式 |
|------|------|---------|
| 用户消息 → AI 回复 | ✅ | E2E 测试 |
| 图片消息 → 多模态感知 | ✅ | E2E 测试 |
| Web 驾驶舱 15+ API | ✅ | HTTP 测试 |
| 主动推送 (Pulse→AI→Telegram) | ✅ | E2E 测试 |
| Anti-Spam 完整链路 | ✅ | 5 场景 E2E |
| 健康诊断三层报告 | ✅ | 集成测试 |
| Cerebellum 生命周期 | ✅ | 12 个测试 |
| FAMILY_HOME 初始化 | ✅ | init + migrate |
| 定时体检 + 趋势 | ✅ | S1/S2/S3 集成 |
| Telegram 真实 Bot | 🟡 Mock | CI 不能用真 Bot |
| OpenCode 真实推理 | 🟡 Mock | 依赖外部服务 |
| MCP 工具链 | 🟡 单元 | 需真实 OpenCode 运行时 |

---

## 五、可测功能

### 启动方式

```bash
cd muse && ./start.sh
```

### Telegram

| 功能 | 测试方法 |
|------|---------|
| AI 对话 | 发消息，验证带人格回复 |
| 图片理解 | 发图片+文字 |
| `/status` | 验证三层健康报告 |

### Web 驾驶舱

| 功能 | 端点 |
|------|------|
| 健康检查 | `GET /api/health` |
| 身份查看/编辑 | `GET/PUT /api/identity` |
| 记忆搜索 | `GET /api/memory/semantic?q=xxx` |
| 活动时间线 | `GET /api/timeline` |
| 安全边界 | `GET/PUT /api/boundaries` |
| Pulse 状态 | `GET /api/pulse/status` |
| DND / 频率 | `PUT /api/pulse/config` |

### 高级

| 功能 | 方法 |
|------|------|
| 主动消息 | 等 Pulse 周期触发 |
| Anti-Spam | 设 quietHours 覆盖当前时段 |
| 降频 | 不回复主动消息，观察间隔拉长 |
| 健康趋势 | 停 OpenCode → 连续体检告警 |
| 家族初始化 | `node family/cli.mjs init ./my-family` |

---

## 六、未来规划

### Phase 4: 受控自我开发 + 家族

| 方向 | 内容 |
|------|------|
| Agent Family | 多成员 (nvwa/muse/artisan)，共享核心记忆 + 独立人格 |
| 任务委派 | Sisyphus 6 Pillars 协议 |
| 自主活动 | Background Session 学习/创作 |
| 受控开发 | develop ≠ deploy，人类审批门 |

### Phase 5: 实体化

| 方向 | 内容 |
|------|------|
| 3D 形象 | VRM 模型 + Three.js 渲染 |
| Body MCP | AI 直接控制表情/手势/穿搭 |
| IoT | HomeAssistant 家居控制 |
| 硬件 | 桌面机器人 / 智能音箱 |

### Phase 6: Muse 社区 (愿景)

| 方向 | 内容 |
|------|------|
| 跨家族交互 | Agent "串门" + 身份验证 |
| 自建通道 | Web Chat 脱离 Telegram 依赖 |
| Agent 社交 | 能力发现 + 协作 + 知识共享 |

---

## 七、规划一致性对照

| ARCHITECTURE.md 规划项 | 实现状态 | 说明 |
|----------------------|---------|------|
| Identity (人格) | ✅ | 嵌套 schema + boundaries + buildSystemPrompt |
| Memory (记忆) | ✅ | SQLite + MCP |
| Engine (大脑桥接) | ✅ | REST + SSE |
| Telegram (通道) | ✅ | 收发 + 主动推送 |
| Web (驾驶舱) | ✅ | 15+ API |
| Cerebellum (小脑) | ✅ | 进程守护 + 心跳 |
| Perception (感知) | ✅ | 多模态 Ingress |
| Capability (能力) | ✅ | Registry + Gap + Router |
| Skill/Plugin | ✅ | 加载 + Hook |
| FAMILY_HOME | ✅ | init + config + migrate |
| Pulse (主动性) | ✅ | 调度 + 推送 + Anti-Spam + 体检 |
| Goal 系统 | ❌ 未做 | 原规划在 Phase 3，未排任务 |
| Life Threads | ❌ 未做 | 原规划在 Phase 3，未排任务 |
| AI 自我解读 | ❌ 未做 | T33 只做存储+趋势，AI 解读待排 |
| Family 多成员 | ❌ 未做 | Phase 4 规划 |
| 3D Avatar | ❌ 未做 | Phase 5 规划 |
| IoT | ❌ 未做 | Phase 5 规划 |
| Muse 社区 | ❌ 未做 | Phase 6 愿景 |

---

## 八、风险

| 风险 | 等级 | 说明 |
|------|------|------|
| T10.5 experimental Hook API | 🟡 | OpenCode 升级可能移除 |
| T15 globalThis 通信 | 🟡 | Phase 4 需改依赖注入 |
| Phase 1 真实环境验证 | 🟡 | 部分链路只有 Mock |
