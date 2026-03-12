# Phase 5 — 实体化

> **前置**: Phase 4 (受控自我开发 + 家族)
> **一句话**: 小缪有了身体——3D 形象、IoT 家居控制、实体硬件交互。

---

## 背景

Phase 4 完成后，Muse 已经具备完整的认知能力 (工具/技能/自我成长/家族)。Phase 5 让她从纯文字/屏幕走向**实体世界**——有可见的 3D 形象、能感知和控制物理环境。

## 主要内容

### 3D 形象 (Avatar)

- **VRM 模型** — VRoid Studio 制作，55 个人形骨骼 + 52 个表情维度
- **Web 渲染** — Three.js + @pixiv/three-vrm，从 CDN 加载 (零构建)
- **存储** — `muse/data/avatars/*.vrm`，按成长阶段切换模型
- **成长外观** — 对话越多、技能越多 → 外观越丰富 (解锁发型/服装/配饰)

### Body MCP Server (身体控制)

AI 通过 MCP 工具**直接控制身体**，不是后处理：

```
body.expression("happy")      — 表情
body.gesture("wave")           — 手势
body.pose("sitting")           — 姿态
body.set_outfit({...})         — 换装
body.look_at("user")           — 注视方向
```

链路: AI 回复时调用 body.* → Body MCP 更新状态 → SSE 推送 → 前端 3D 渲染

### 成长系统

| 维度 | 说明 | 举例 |
|------|------|------|
| 外观成长 | 对话/技能里程碑解锁新外观 | 回答 1000 次 → 解锁新发色 |
| 衣橱系统 | 收集/解锁/搭配服装配饰 | 学会 Rust → 解锁工程师外套 |
| 里程碑 | 记录她的成长轨迹 | "第一次用工具完成任务" |

### IoT 物理世界 (HomeAssistant)

```
记忆: "Later 通常 23:00 睡" + "他还没说晚安"
传感器: "卧室灯亮" + "电视开"
时间: 23:30
→ AI 推理: 大概率睡了但忘关
→ 调用: home.tv("off"), home.light("bedroom", "night_light")
→ 明天早安消息里提及
```

MCP 工具 → HomeAssistant HTTP API → 控制灯/开关/传感器

### 实体硬件

- 桌面机器人 / 智能音箱 — 她有物理存在感
- 摄像头/麦克风 — 多模态输入
- 触屏 — 表情和互动

## 与其他 Phase 的关系

| Phase | 关系 |
|-------|------|
| Phase 2 | Body MCP 验证 (2D 表情) 可在 Phase 2 做 POC |
| Phase 3 | VRM 3D 形象 + 成长外观系统 |
| Phase 4 | "她自己打扮自己" — 依赖受控自我开发能力 |

## 技术预研文档

- 3D/VRM/Body MCP 详细方案见 [phase1/t07-web-cockpit/context.md](../phase1/t07-web-cockpit/context.md)
- IoT HomeAssistant 集成见同文档第六章
