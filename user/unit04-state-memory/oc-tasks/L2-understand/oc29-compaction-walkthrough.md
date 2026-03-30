# oc29: 走读 OpenCode Compaction 机制

> **USOLB:** `[S]`源码 | **Bloom:** 2 — 理解 | **理论:** 03b §Compaction

---

## 走读: OpenCode 的 Compaction

参考: KI `opencode_core.md`

### 触发条件

| 问题 | 答案 (附源码) |
|------|-------------|
| 什么时候触发 compaction？ | （填写） |
| token 阈值是多少？ | （填写） |
| 谁决定要不要压缩？ | （填写） |

### 压缩策略

| 问题 | 答案 |
|------|------|
| 用什么方法压缩？(截断/LLM摘要/混合) | （填写） |
| 压缩时保留什么？丢弃什么？ | （填写） |
| system prompt 会被压缩吗？ | （填写） |

### Hook 接口

| Hook 名 | 时机 | 可以干什么 |
|---------|------|----------|
| session.compacting | （填写） | 注入自定义压缩逻辑 |

---

## 和 Muse 的关系

| 问题 | 答案 |
|------|------|
| Muse 有自定义 compaction 吗？ | （检查 plugin hooks） |
| 需不需要自定义？（保留身份信息） | （填写） |
