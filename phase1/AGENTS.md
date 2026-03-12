# phase1/ — MVP 任务地图

> 详细任务规划和依赖图见 [README.md](./README.md)
> 踩坑记录见 [EXPERIENCE.md](./EXPERIENCE.md)

## 当前进度

- ✅ T01 脚手架 → T02 身份 → T03 引擎 → T04 记忆 → T05 编排 → T06 Telegram → T07 Web
- ⬜ **T08 小脑** ← 下一个任务
- ⬜ T09 集成联调

## 关键路径

T01 → T03/T04 → T05 → T06 → T09（T07/T08 可并行）

## 任务目录结构

每个 `t0X/` 目录包含:
- `README.md` — 技术方案
- `review-prompt.md` — 审核提示词（给审核 agent 看）
- `context.md` — 审核时的上下文补充

## 审核流程

1. 开发完成后写 `review-prompt.md`
2. 把代码和 review-prompt 给另一个 agent 审核
3. 审核反馈追加到 review-prompt.md 末尾
4. 修复问题，重新审核直到通过

## 开发时注意

- 每个任务有独立测试: `node --test muse/xxx.test.mjs`
- 改动后一定跑测试，不要盲提交
- 经验教训写到 EXPERIENCE.md（按 BUG-XXX 编号）
