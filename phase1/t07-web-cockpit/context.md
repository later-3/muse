# T07 技术上下文

## 一、Phase 1 HTTP API 设计

### 端点列表

```
GET  /                          → SPA HTML 页面
GET  /api/health                → 系统总体健康
GET  /api/status                → 运行统计
GET  /api/identity              → 身份配置
PUT  /api/identity              → 更新身份配置
GET  /api/memory/semantic?q=    → 语义记忆（搜索）
GET  /api/memory/episodic?days= → 情景记忆（筛选）
GET  /api/config                → 配置（脱敏）
POST /api/chat                  → 发送消息（在线对话）
GET  /api/chat/history?n=       → 最近对话
POST /api/system/restart-brain  → 重启大脑
POST /api/system/restart-cerebellum → 重启小脑
GET  /api/system/logs?lines=    → 查看日志
POST /api/system/test           → 测试连接
```

### 响应格式

```json
{
  "ok": true,
  "data": { ... },
  "error": null
}
```

### 技术约束

- **后端**: `node:http` — 零依赖，不用 Express/Koa
- **前端**: 单 HTML 文件，内嵌 `<style>` + `<script>`
- **认证**: Phase 1 本地运行无需认证，预留 Bearer token 接口
- **端口**: 默认 3000（`WEB_PORT` 环境变量），不与 OpenCode 4096 冲突

---

## 二、SPA 前端设计规范

### 暗色主题

```css
:root {
  --bg-primary: #0d1117;      /* 页面背景 */
  --bg-card: #161b22;         /* 卡片背景 */
  --bg-input: #21262d;        /* 输入框 */
  --border: #30363d;          /* 边框 */
  --text-primary: #e6edf3;    /* 主文字 */
  --text-secondary: #8b949e;  /* 次文字 */
  --accent: #58a6ff;          /* 主色调 (蓝) */
  --accent-green: #3fb950;    /* 成功/在线 */
  --accent-red: #f85149;      /* 错误/离线 */
  --accent-yellow: #d29922;   /* 警告 */
  --font: 'Inter', -apple-system, sans-serif;
  --radius: 12px;
}
```

### 微动画

| 元素 | 动画 | CSS |
|------|------|-----|
| 卡片 hover | scale + shadow | `transform: scale(1.02); box-shadow: 0 8px 24px rgba(0,0,0,0.2)` |
| Tab 切换 | slide + fade | `transition: transform 0.3s, opacity 0.2s` |
| 状态灯 | 脉冲 | `animation: pulse 2s infinite` |
| 数字变化 | 计数器 | requestAnimationFrame 递增 |
| 加载 | 骨架屏 | `animation: shimmer 1.5s infinite` |

### Tab 导航

```
  [概览] [对话] [身份] [记忆] [系统]
```

SPA 路由不用 hash 也不用 pushState，用 `data-tab` 属性 + `display:none/block` 切换。

---

## 三、3D 技术栈 (Phase 2-3)

### VRM 格式

VRM = glTF 2.0 + 人形扩展，由 VRoid/Pixiv 定义：

| 特性 | 说明 |
|------|------|
| 标准骨骼 | 55 个人形骨骼点（HumanoidBone） |
| 表情 | BlendShapes: 52+ 表情维度（眉、嘴、眼...） |
| 注视 | LookAt: 程序化控制视线方向 |
| 物理 | SpringBone: 头发/衣服物理摆动 |
| 材质 | MToon: 卡通←→写实可调 shader |

### 库依赖 (Phase 3)

```json
{
  "three": "^0.170.0",
  "@pixiv/three-vrm": "^3.0.0"
}
```

从 CDN 加载（保持零构建）:
```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "@pixiv/three-vrm": "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3.0.0/lib/three-vrm.module.min.js"
  }
}
</script>
```

### 模型制作流程

```
VRoid Studio (免费, macOS)
  → 创建 5 个阶段的基础模型
  → 导出 .vrm 文件
  → 存放 muse/data/avatars/
  → 按成长阶段切换加载哪个模型
```

---

## 四、Body MCP Server (Phase 2)

### 架构

```
┌─ Body MCP Server ────────────────────────┐
│                                           │
│  MCP stdio 协议                           │
│  ↕                                        │
│  OpenCode ← 注册为 MCP Server            │
│  ↕                                        │
│  工具调用:                                │
│    body.expression("happy")               │
│    body.gesture("wave")                   │
│    body.pose("sitting")                   │
│    body.set_outfit({...})                 │
│    body.look_at("user")                   │
│  ↕                                        │
│  状态存储: muse/data/body-state.json      │
│  ↕                                        │
│  SSE 推送 → 前端 3D 渲染更新              │
│                                           │
└───────────────────────────────────────────┘
```

### 与对话的协作

1. AI 收到消息
2. AI 思考并回复
3. AI 同时调用 `body.*` 工具
4. Body MCP 更新状态 + 通过 SSE 推送
5. 前端渲染引擎收到 SSE → 更新 3D 模型

不是文字后处理 → 是 AI 直接决定身体状态。

---

## 五、成长系统数据模型 (Phase 3)

### SQLite 表

```sql
CREATE TABLE IF NOT EXISTS growth (
  agent_id TEXT DEFAULT 'muse',
  dimension TEXT NOT NULL,     -- 'appearance', 'knowledge', 'emotion', ...
  key TEXT NOT NULL,
  value REAL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agent_id, dimension, key)
);

CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT DEFAULT 'muse',
  title TEXT NOT NULL,
  description TEXT,
  achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  category TEXT               -- 'knowledge', 'social', 'creation', ...
);

CREATE TABLE IF NOT EXISTS wardrobe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT DEFAULT 'muse',
  item_type TEXT NOT NULL,     -- 'top', 'bottom', 'accessory', ...
  item_name TEXT NOT NULL,
  source TEXT,                 -- 'default', 'earned', 'gift', 'purchased'
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 六、IoT 物理世界 (Phase 5 预研)

### HomeAssistant 集成

```
MCP 工具 → HTTP API → HomeAssistant
  home.light("bedroom", "off")
  → POST http://homeassistant.local:8123/api/services/light/turn_off
    { "entity_id": "light.bedroom" }
```

### 她的判断链

```
记忆: "Later 通常 23:00 睡" + "他还没说晚安"
传感器: "卧室灯亮" + "电视开"
时间: 23:30
→ AI 推理: 大概率睡了但忘关
→ 调用: home.tv("off"), home.light("bedroom", "night_light")
→ 记忆: 存储 "帮 Later 关了电视和灯"
→ 明天: 早安消息里提及
```
