# oc21: 触发 Compaction

> **USOLB:** `[U]`使用 `[O]`观察hook `[L]`日志 | **Bloom:** 1 — 观察 | **理论:** 03b §Compaction

---

## 操作步骤

### Step 1: 和 Muse 进行一次非常长的对话

连续发 15-20 条消息（每条有实质内容），直到上下文窗口接近上限。

### Step 2: 观察是否触发 Compaction

```bash
# 看日志里有没有 compaction 相关输出
grep -i "compact\|compress\|truncat" families/later-muse-family/pua/data/logs/muse_*.log
```

### Step 3: 用 hook 观察 (如果有 session.compacting 事件)

在 event-logger.mjs 里加:
```javascript
hooks.on('session.compacting', (event) => {
  console.log('🗜️ COMPACTION 触发!', {
    beforeTokens: event.beforeTokens,
    afterTokens: event.afterTokens,
  })
})
```

---

## 观察记录

| 问题 | 记录 |
|------|------|
| 发了多少条消息后触发？ | （填写） |
| 压缩前 token 数？ | （填写） |
| 压缩后 token 数？ | （填写） |
| 压缩策略是什么？(截断/摘要/其他) | （填写） |
| 压缩后 Muse 还记得前面的内容吗？ | （填写） |
