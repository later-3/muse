# T14: Perception Ingress — 感知统一层

> **第三批** — 与 T10.5/T15 并行

## 目标

把 Telegram 从"通道"升级为"器官"，建立标准化感知输入对象。

## 子任务

1. PerceptionObject 数据结构定义
2. Telegram text → PerceptionObject
3. Telegram photo → PerceptionObject
4. 未支持类型 (audio/video/file) → 触发 Capability Gap 流程
5. 预留: 其他器官接入接口 (P3: filesystem, P5: camera/IoT)

## 验收

- 所有 Telegram 输入经过 PerceptionIngress 标准化
- 发送 audio/video → 触发 Gap 流程 (不是静默忽略)
- 新增器官只需实现 → PerceptionObject 的转换函数
