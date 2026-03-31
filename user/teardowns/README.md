# 优秀项目拆解 — 站在巨人肩膀上

> **目的：** 拆解行业顶级 Agent 项目，提取可复用的设计模式
> **原则：** AI 读源码 + 提取精华 → 你看精华 + 理解架构 → 面试能讲
> **独立于 oc-tasks，互相引用但不耦合**

---

## 📋 拆解清单

| 编号 | 项目 | ⭐ | 定位 | 状态 |
|------|------|----|------|------|
| **T1** | [learn-claude-code](learn-claude-code/) | 44k | Harness 12步拆解 (Python) | [AI✓] 框架 + s01-s06 |
| **T2** | [nanobot](nanobot/) | 37k | 超轻量 OpenClaw (99%更少代码) | [ ] 待拆 |
| **T3** | [claw0](claw0/) | — | Always-on Agent 教学 | [ ] 待拆 |
| **T4** | [openclaw](openclaw/) | — | 产品级 Agent (13+ IM平台) | [ ] 待拆 |

---

## 🔬 拆解方法论

每个项目的拆解笔记遵循 **5 段式**：

```
1. 一句话    — 这个模块解决什么问题
2. 核心代码  — 关键 30-50 行（AI 提取，有注释）
3. 架构图    — ASCII / Mermaid 调用链
4. Muse 映射 — 我们的对应代码在哪（文件+行号）
5. 面试能讲  — 一个 STAR 片段 / 面试问答
```

---

## 📐 和 oc-tasks 的关系

```
teardowns/                    oc-tasks/
  独立的项目拆解                学习任务 + 实战 demo
  ↓                           ↓
  "他们怎么做的"              "我们在 OpenCode 上怎么做的"
  
  互相引用:
  teardowns 里写: → 对应 oc01
  oc-tasks 里写:  → 详见 teardowns/learn-claude-code/s01
  
  各自完整，互不依赖
```

---

## 📅 拆解节奏

| 阶段 | 时间 | 拆什么 |
|------|------|--------|
| 现在 | W2 | **T1** learn-claude-code s01-s12 全拆 |
| 下周 | W3 | **T2** nanobot + **T3** claw0 |
| Week 4 | W4 | **T4** openclaw + 综合对比 |
