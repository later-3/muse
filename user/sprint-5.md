# Sprint 5：Architecture v2 + 资产处置矩阵

> **Sprint 目标：** 基于 Spike 经验重写轻量化 Blueprint，完成现有代码的 Retain/Refactor/Rewrite/Archive 分类。  
> **服务于：** Phase 4（架构重设计）  
> **前置条件：** Sprint 4 完成，3 个 Spike 中至少 2 个 pass

---

## 每日任务清单

### 第 1-2 天：Spike 经验提炼

- [ ] 从 3 个 Spike 中提取架构约束（什么必须有、什么不需要）
- [ ] 从 Design Principles v1 中提取设计准则
- [ ] 产出：`user/architecture/spike-to-architecture-notes.md`

### 第 3-5 天：Muse Architecture v2

- [ ] 写 Muse Architecture v2（轻量化，不超过现有 blueprint 的一半篇幅）
- [ ] 要求：每个模块必须标注服务哪个 MVP 锚点场景（S1/S2/S3）
- [ ] 要求：每个设计决策必须可追溯到 Spike 验证结果或研究证据
- [ ] 产出：`user/architecture/muse-architecture-v2.md`

### 第 6-7 天：资产处置矩阵

- [ ] 逐模块审查 `muse/src/` 现有代码
- [ ] 用四分法分类：🟢 Retain / 🟡 Refactor / 🔴 Rewrite / ⚫ Archive
- [ ] 对每个 Refactor/Rewrite 模块写出改造要点
- [ ] 产出：`user/architecture/asset-disposition-matrix.md`

### 第 8 天：Technical Design 规划

- [ ] 基于 Architecture v2 + 资产矩阵，列出 S1/S2/S3 各需要的 Technical Design
- [ ] 确定实现顺序（先 S2 harness？先 S1 对话？）
- [ ] 产出：`user/architecture/implementation-order.md`

### 第 9-10 天：Sprint 5 复盘

- [ ] mini-eval：
  - [ ] Architecture v2 覆盖 3 个锚点场景？
  - [ ] 资产矩阵完整？每个模块有明确分类？
  - [ ] 实现顺序合理？
- [ ] 写复盘：`user/sprint-5-retro.md`
- [ ] **判断：Phase 4 退出条件是否达标？**

---

## 交付物清单

| # | 交付物 | 状态 |
|---|-------|------|
| 1 | `user/architecture/spike-to-architecture-notes.md` | [ ] |
| 2 | `user/architecture/muse-architecture-v2.md` | [ ] |
| 3 | `user/architecture/asset-disposition-matrix.md` | [ ] |
| 4 | `user/architecture/implementation-order.md` | [ ] |
| 5 | `user/sprint-5-retro.md` | [ ] |

## 不做清单

- ❌ 不开始写产品代码（Sprint 6）
- ❌ 不做 7 层 Blueprint（轻量化）
