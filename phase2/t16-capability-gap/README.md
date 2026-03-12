# T16: Capability Gap Journal — 缺口管理

> **第四批** — 依赖 T14 + T15

## 目标

不会时不沉默 — 进入缺口记录 → 告知用户 → 提出成长提议。

## 子任务

1. GapEntry 数据结构 (input/missing/tried/result/proposal)
2. Memory gap 表
3. 自动触发: PerceptionIngress 收到未知类型 → 查 Registry → 记录 Gap
4. 告知用户: "我暂时不会处理语音，需要 transcribe 能力"
5. 成长提议: "如果安装 whisper MCP，我就能听懂语音了"
6. Web 驾驶舱: Gap 列表页面

## 验收

- 收到语音 → Gap Journal 有记录
- Telegram 回复 "我暂时不会处理语音"
- Web 驾驶舱能看到 Gap 列表
- Gap 记录包含成长提议
