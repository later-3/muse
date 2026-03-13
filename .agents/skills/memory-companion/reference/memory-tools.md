# Memory MCP 工具参考

> memory-companion Skill 的工具参数速查。

## set_memory

```json
{
  "key": "favorite_language",     // 记忆键名
  "value": "Rust",                // 记忆值
  "category": "preference",      // identity | preference | goal | general
  "source": "user_stated",       // user_stated | ai_inferred | ai_observed
  "confidence": "high",          // high | medium | low
  "tags": ["programming"],       // 可选标签数组
  "meta": {}                     // 可选元数据
}
```

## search_memory

```json
{
  "query": "编程语言",            // 自然语言搜索词
  "type": "semantic",            // semantic | episodic | all
  "scope": "preference"          // identity | preference | goal | general (可选)
}
```

## get_user_profile

```json
{
  "sections": ["identity", "preferences"]  // identity | preferences | goals | all
}
```

## get_recent_episodes

```json
{
  "days": 3,                     // 最近几天
  "scope": {                     // 可选过滤
    "related_goal": "learn-rust"
  }
}
```

## add_episode

```json
{
  "summary": "讨论了 Rust 学习路径",   // 摘要
  "tags": ["rust", "learning"],        // 标签
  "meta": {                            // 可选关联
    "related_goal": "learn-rust"
  }
}
```
