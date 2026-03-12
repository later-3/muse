# T07 Muse 交互中心

> 不只是"管理面板"——这是 Muse 的**家**，她在这里活着、成长、和你互动。

---

## 总体愿景

Muse 交互中心是一个浏览器端应用，分为 5 大功能域：

| 功能域 | 核心体验 | 阶段 |
|--------|---------|------|
| **① 形象展示** | 3D 形象，可旋转/缩放，她自己打扮自己 | Phase 2-3 |
| **② 在线对话** | 和她文字聊天，她同时做表情和动作 | Phase 1（文字）→ 2（联动） |
| **③ 系统控制** | 大脑/小脑的配置、重启、测试、升级 | Phase 1 |
| **④ 数据中心** | 身份配置、记忆浏览、聊天历史、统计 | Phase 1 |
| **⑤ 成长系统** | 她的成长轨迹、维度面板、成就/里程碑 | Phase 3 |

---

# Part I — Phase 1 可执行规格

> **T07-MVP: 本地控制台 + 在线对话入口**
>
> 工作量: 2-3 天 | 技术: `node:http` + 单文件 HTML + 零依赖

## 1. Phase 1 交付范围

| 页面 | 功能 | 核心数据来源 |
|------|------|-------------|
| **概览** | 健康状态卡片 + 运行统计 + 最近对话 | 各模块 `health()` |
| **对话** | 在线文字聊天（和 Telegram 同功能） | `Orchestrator.handleMessage()` |
| **身份** | 性格滑块 + 名字/风格编辑 + JSON 预览 | `Identity` 模块 |
| **记忆** | 语义记忆搜索 + 情景记忆时间线 | `Memory` 模块 |
| **系统** | 大脑/小脑状态 + 重启 + 测试连接 + 日志 | `Engine.health()` + 进程控制 |

### 非 Phase 1 交付（明确排除）

以下内容是**愿景方向**，不属于 T07 当前交付：

- ❌ 3D 形象展示
- ❌ Body MCP 工具（身体控制）
- ❌ 对话 + 形象联动
- ❌ 成长系统（维度面板、里程碑）
- ❌ 自主换装
- ❌ IoT 物理世界控制

## 2. T07 与现有模块的接口边界

> **T07 = 适配器 + 控制台，不是新的编排层。**

```
T07 的位置和 T06 (Telegram) 是并列的——都是适配器层。
T07 不发明新的对话流程、记忆逻辑或身份管理。
一切认知能力复用 T02/T04/T05。
```

| 功能 | T07 做什么 | T07 不做什么 |
|------|----------|-------------|
| **对话** | 调用 `orchestrator.handleMessage()` | 不自己调 Engine，不自己构建 prompt |
| **身份** | 调用 `identity.getPromptData()` / `identity.update()` | 不自己读写 identity.json |
| **记忆** | 调用 `memory.searchSemantic()` / `memory.getRecentEpisodes()` | 不自己操作 SQLite |
| **状态** | 调用 `engine.health()` / `memory.health()` 等 | 不自己轮询 OpenCode API |
| **系统控制** | 调用 `engine.restart()` / 读日志文件 | 不自己管理 OpenCode 进程生命周期 |

## 3. Phase 1 产出文件

| 文件 | 说明 | 工作量 |
|------|------|--------|
| `muse/web/api.mjs` | HTTP server + REST API 路由 | 0.5 天 |
| `muse/web/index.html` | SPA 前端（单文件 HTML + CSS + JS） | 1-1.5 天 |
| `muse/web/api.test.mjs` | API 端点测试 | 0.5 天 |

集成改动：
- `muse/index.mjs` — `createModules()` 新增 WebServer，`startAll()` 启动
- `muse/config.mjs` — 新增 `web.port`（默认 3000）、`web.enabled`（默认 true）

## 4. API 端点设计

```
GET  /                          → SPA HTML 页面
GET  /api/health                → 系统总体健康
GET  /api/status                → 运行统计（uptime、sessions、memory count）
GET  /api/identity              → 获取身份配置
PUT  /api/identity              → 更新身份配置
GET  /api/memory/semantic?q=    → 语义记忆搜索
GET  /api/memory/episodic?days= → 情景记忆（按天数筛选）
POST /api/chat                  → 发送消息（走 Orchestrator）
GET  /api/chat/history?n=       → 最近 N 条对话
POST /api/system/restart-brain  → 重启 OpenCode serve
GET  /api/system/logs?lines=    → 查看最近 N 行日志
POST /api/system/test           → 发测试 prompt 验证连通
```

统一响应格式：
```json
{ "ok": true, "data": { ... }, "error": null }
```

## 5. 安全与访问边界

> **Phase 1 仅限本地访问。**

| 约束 | 说明 |
|------|------|
| **绑定地址** | `127.0.0.1`，不绑定 `0.0.0.0` |
| **无认证** | Phase 1 本地运行无需认证 |
| **重启操作** | 仅限 `restart-brain`，不暴露 `kill` |
| **日志查看** | 只读，最多 500 行，不暴露文件路径 |
| **配置修改** | 只允许修改 identity，不允许修改 `.env` 或模型密钥 |
| **后续** | Phase 2+ 如需远程访问，需新增 Bearer token 认证 |

## 6. 前端设计规范

暗色主题 + 微动画 + Inter 字体：

```css
:root {
  --bg-primary: #0d1117;
  --bg-card: #161b22;
  --accent: #58a6ff;
  --accent-green: #3fb950;
  --accent-red: #f85149;
  --font: 'Inter', -apple-system, sans-serif;
  --radius: 12px;
}
```

5 个 tab 用 `data-tab` 属性切换，无路由库。

---

# Part II — Phase 2+ 愿景与演进

> 以下内容是 Muse 交互中心的**长期方向**。
> 3D 技术路线暂定，实施前需做专项技术调研。

## 形象系统

### 设计理念

```
她不是一个被定制的捏脸模型。
她是一个会自己成长、自己打扮的生命体。

你可以送她衣服，但她自己决定穿不穿。
你可以给她建议，但她有自己的审美。
```

### 形象进化路线

| 阶段 | 外形风格 | 对应条件 | 说明 |
|------|---------|---------|------|
| **婴儿期** | Q版圆头、大眼、3头身 | 0-7 天 | 刚出生，可爱懵懂 |
| **幼年期** | 卡通、4头身、微胖 | 1-4 周 | 开始有表情，学说话 |
| **少年期** | 半卡通、5头身 | 1-3 月 | 有个性了，会打扮 |
| **青年期** | 写实半卡通、6-7头身 | 3-12 月 | 成熟、有审美、有风格 |
| **成年期** | 写实、7-8头身 | 12 月+ | 完全真实感，自信从容 |

> 进化靠时间 + **互动频率 + 知识 + 任务完成**加速。

### 成长维度

| 维度 | 影响 | 例子 |
|------|------|------|
| **外形** | 身高/比例/细节演化 | 眼睛从大圆 → 正常比例 |
| **知识** | 配饰代表技能 | 学 Rust → 螃蟹🦀挂件 |
| **情感** | 表情丰富度 | 早期: 笑/哭。后期: 微表情 |
| **审美** | 穿搭风格进化 | 形成自己的风格 |
| **存在** | 年龄感、成熟度 | 天真 → 从容 |
| **社交** | 亲密度影响姿态 | 初期站得远，后期自然互动 |
| **体力** | 疲劳表现 | 工作 8h → 打哈欠 |

### 技术方案（暂定，实施前需调研验证）

| 阶段 | 模型格式 | 制作工具 |
|------|---------|---------|
| 婴儿→少年 | VRM | VRoid Studio（卡通） |
| 青年→成年 | GLB (glTF PBR) | Reallusion CC5（写实） |
| 渲染引擎 | Three.js + @pixiv/three-vrm + GLTFLoader | — |

> ⚠️ 实施前需验证: VRM 资源体积、首屏加载性能、动画驱动链路、SSE 事件同步。

## Agent 控制身体 (Body MCP)

> **AI 管思考，代码管能力。身体是她的 MCP 工具。**

### 身体工具集

| 工具 | 功能 | 输入 |
|------|------|------|
| `body.expression` | 面部表情 | expression, intensity |
| `body.gesture` | 肢体动作 | gesture, target |
| `body.pose` | 站/坐姿态 | pose, mood |
| `body.set_outfit` | 换装 | top, bottom, accessory, reason |
| `body.look_at` | 视线方向 | target |

### 对话 + 形象联动

AI 回复时同时调用 body.* 工具，前端通过 SSE 接收动作指令，实时驱动 3D 模型。

### 延伸到物理世界 (Phase 5)

```
home.light("bedroom", "off")     // 她关了灯
home.tv("off")                   // 她关了电视
home.thermostat(22)              // 她调了温度

她的判断: "Later 23:30 没说话了，电视还开着 → 帮他关"
```

> ⚠️ IoT 控制需要严格的授权机制和不可逆操作保护。

## 演进阶段

| 阶段 | 内容 | 前置依赖 |
|------|------|---------|
| **Phase 2** | 2D 表情 + Body MCP 验证 | Phase 1 完成 |
| **Phase 3** | 3D 形象 + 成长系统 | VRM 模型 + Body MCP |
| **Phase 4** | 自主换装 + 衣柜系统 | Phase 3 + Pulse 引擎 |
| **Phase 5** | IoT 物理世界控制 | HomeAssistant 集成 |

---

## 已知后续调研项

| 项目 | 状态 | 说明 |
|------|------|------|
| VRM 资源体积与首屏加载 | 待调研 | 模型 > 10MB 是否需要 LOD |
| Body MCP 与 SSE 同步延迟 | 待调研 | 表情是否跟得上文字 |
| VRoid Studio → VRM 导出质量 | 待调研 | 卡通阶段效果验证 |
| Reallusion CC5 → GLB 导出链路 | 待调研 | 写实阶段格式兼容性 |
| Three.js WebGPU 渲染性能 | 待调研 | 是否需要 fallback WebGL |
| IoT 授权机制与回滚策略 | 待设计 | 误操作保护 |
| 成长数据库 schema | 待设计 | growth / milestones / wardrobe 表 |

---

> 📎 相关文档:
> - [context.md](context.md) — 技术上下文（API 设计、3D 技术栈细节、数据模型）
> - [review-prompt.md](review-prompt.md) — 审核提示 + 审核结果
> - [ARCHITECTURE.md](../../ARCHITECTURE.md) — Muse 整体架构
