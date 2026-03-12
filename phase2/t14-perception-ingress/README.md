# T14: Perception Ingress — 感知统一层

> **第三批** — 与 T14.5/T15 并行

## 目标

把 Telegram 从"通道"升级为"器官"，建立标准化感知输入对象。

## 两层架构

### Sense Adapter (器官适配层)

每个器官怎么接世界，接法不同:

| 器官 | 接法 | Phase |
|------|------|-------|
| Telegram text | Telegraf message handler | P2 ✅ |
| Telegram photo | Telegraf photo handler + file download | P2 ✅ |
| Telegram audio | Telegraf voice handler + file download | P2 (Gap) |
| Telegram video | Telegraf video handler + file download | P2 (Gap) |
| Camera | 定时截帧 / 事件触发 | P5 |
| FileSystem | fs.watch / chokidar | P3 |
| IoT | HomeAssistant webhook | P5 |

新增器官 = 新增一个 Sense Adapter。

### Perception Ingress (感知统一层)

所有 Adapter 输出统一成 PerceptionObject:

```js
{
  source: 'telegram',
  type: 'text' | 'audio' | 'image' | 'video' | 'file' | 'event',
  userId: 'later',
  artifact: { kind, mime, localPath },
  textFallback: '...',
  timestamp: '...'
}
```

## 子任务

1. PerceptionObject 数据结构定义
2. Sense Adapter 接口定义 (每个器官实现此接口)
3. Telegram text Adapter → PerceptionObject
4. Telegram photo Adapter → PerceptionObject
5. 未支持类型 (audio/video/file) → 触发 Capability Gap 流程
6. 预留: 其他器官 Adapter 接口

## 验收

- 所有 Telegram 输入经过 Sense Adapter → PerceptionIngress 标准化
- 发送 audio/video → 触发 Gap 流程 (不是静默忽略)
- 新增器官只需实现 Sense Adapter 接口
