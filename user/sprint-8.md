# Sprint 8：Eval 固化 + Portfolio 整理

> **Sprint 目标：** 将全程 mini-eval 固化为正式 Eval 框架，整理面试 Portfolio。  
> **服务于：** Phase 6（Eval 体系化）+ Phase 7（复盘与知识沉淀）  
> **前置条件：** Sprint 7 完成，S1/S2/S3 全部跑通

---

## 每日任务清单

### 第 1-2 天：Eval 框架设计

- [ ] 回顾全程 mini-eval 经验，提炼评估维度
- [ ] 设计 Eval 框架：评估什么、怎么评、多久评一次
- [ ] 调研 LLM-as-Judge 方法（DeepEval / Ragas / OpenAI Evals）
- [ ] 产出：`user/eval/eval-framework.md`

### 第 3-4 天：Eval 实现

- [ ] 实现基础 Eval 脚本：对话质量评估
- [ ] 实现 harness 任务成功率评估
- [ ] 跑一次基准测试
- [ ] 产出基准报告：`user/eval/baseline-report.md`

### 第 5-6 天：Failure Postmortem

- [ ] 回顾整个项目的失败经历（Spike 失败、架构漂移、返工等）
- [ ] 写 1 份可面试用的 failure postmortem
- [ ] 产出：`user/portfolio/failure-postmortem.md`

### 第 7-8 天：Demo + 博客

- [ ] 录制 S1+S2+S3 的端到端 demo（视频或 GIF）
- [ ] 写 1 篇技术博客草稿（选一个最有深度的主题）
- [ ] 产出：
  - `user/portfolio/demo/` (录屏)
  - `user/portfolio/blog-draft.md`

### 第 9 天：Capstone — 非 Muse 小 Agent 应用

- [ ] 用同一套 RDD + Spike + Eval 方法，1-2 天做一个非 Muse 的小 Agent 应用
  - 例如：自动 PR Review Agent / 简历筛选 Agent / 研报摘要 Agent
  - 目的：证明你的方法可迁移，不是只会做 Muse
- [ ] 产出：`user/portfolio/capstone/`（代码 + 简短设计说明）

### 第 10 天：面试准备 + 最终复盘

- [ ] 整理面试故事清单：
  - "设计一个 Agent 系统" → Muse 架构故事
  - "如何做 multi-agent 协作" → harness 故事
  - "Agent 的记忆如何设计" → Memory Spike 故事
  - "遇到过什么 Agent 失败" → postmortem 故事
  - "如何评估 Agent 质量" → Eval 框架故事
  - **"你的方法能迁移到别的项目吗" → Capstone 故事**
- [ ] 产出：`user/portfolio/interview-stories.md`
- [ ] 4 个月回顾：
  - [ ] 目标 A 达标？（Muse Basic v1 全部 5 项能力达标）
  - [ ] 目标 B 达标？（demo + postmortem + 博客 + 面试故事 + **Capstone**）
  - [ ] 掌握了哪些 Agent 工程技能？
  - [ ] 还有什么不足需要补？
- [ ] 写最终复盘：`user/sprint-8-retro.md`
- [ ] 更新 README.md：标记项目当前状态

---

## 交付物清单

| # | 交付物 | 状态 |
|---|-------|------|
| 1 | `user/eval/eval-framework.md` | [ ] |
| 2 | `user/eval/baseline-report.md` | [ ] |
| 3 | `user/portfolio/failure-postmortem.md` | [ ] |
| 4 | `user/portfolio/demo/` (录屏) | [ ] |
| 5 | `user/portfolio/blog-draft.md` | [ ] |
| 6 | `user/portfolio/interview-stories.md` | [ ] |
| 7 | `user/sprint-8-retro.md` | [ ] |

## 最终产出：面试证明包

```
user/portfolio/
├── demo/                    ← S1+S2+S2b+S3 端到端演示
├── capstone/               ← 非 Muse 小 Agent 应用（证明可迁移）
├── failure-postmortem.md    ← 可讲的失败故事
├── blog-draft.md            ← 技术博客
└── interview-stories.md     ← 面试故事清单
```
