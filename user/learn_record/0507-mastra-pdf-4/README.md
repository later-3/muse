# Mastra PDF 专题 (4/4) — Patterns 下篇：Evals、Security、生产化清单

> **日期：** 2026-05-07（Thu）
> **路线图位置：** 专题加餐 · Mastra Agent PDF 课（第 4 天，共 4 天）
> **定位：** 🟥 精通级（今天 1.5h = 50min 理论 + 25min 走读 + 10min 自检）
> **PDF 来源：**
> - `user/reference/Patterns for Building AI Agents_1.pdf`
> - `user/reference/principles_2nd_edition_updated.pdf`

---

## 🎯 今日目标

学完之后能回答这 3 个问题：
1. **生产级 Agent 为什么必须先列 failure modes，再谈优化？** 这和普通软件测试思维有什么不同？
2. **SME 标注、生产数据、LLM-as-judge 应该怎样串成闭环？** 怎么避免“离线测得好，上线就翻车”？
3. **什么是 Lethal Trifecta？** 为什么它几乎是所有生产 Agent 的安全底线？

---

## 📋 今日任务

| # | 任务 | 时间 | 状态 |
|---|------|------|------|
| 1 | 读下方知识精华（Patterns Part III-IV） | 50min | [ ] |
| 2 | 📂 走读 → `unit03-multi-agent/oc-tasks/L3-analyze/oc22-harness-audit.md` | 10min | [ ] |
| 3 | 📂 走读 → `unit03-multi-agent/oc-tasks/L3-analyze/oc23-eval-framework.md` | 10min | [ ] |
| 4 | 📂 走读 → `unit01-agent-core/oc-tasks/L3-analyze/oc06-aci-audit.md` | 5min | [ ] |
| 5 | 做自检清单 + 面试题 | 5min | [ ] |

---

## 📖 知识精华（AI 为你提炼）

> 今日主读：`Patterns for Building AI Agents` Part III-IV。  
> 这是整套专题里最“生产化”的一天。前 3 天回答“怎么搭”，今天回答“怎么证明它有效、怎么确保它不出事”。

### 📚 参考锚点

- `[ref-pat-10]` Patterns Ch10 `List Failure Modes`
- `[ref-pat-11]` Patterns Ch11 `List Critical Business Metrics`
- `[ref-pat-12]` Patterns Ch12 `Cross-Reference Failure Modes and Success Metrics`
- `[ref-pat-13]` Patterns Ch13 `Iterate Against Your Evals`
- `[ref-pat-14]` Patterns Ch14 `Create an Eval Test Suite`
- `[ref-pat-15]` Patterns Ch15 `Have SMEs Label Data`
- `[ref-pat-16]` Patterns Ch16 `Create Datasets from Production Data`
- `[ref-pat-17]` Patterns Ch17 `Evaluate Production Data`
- `[ref-pat-18]` Patterns Ch18 `Prevent the Lethal Trifecta`
- `[ref-pat-19]` Patterns Ch19 `Sandbox Code Execution`
- `[ref-pat-20]` Patterns Ch20 `Granular Agent Access Control`
- `[ref-pat-21]` Patterns Ch21 `Agent Guardrails`
- `[ref-pri-27]` Principles Ch27-Ch29 `Evals`

### 生产 Agent 的第一原则：先定义“怎么坏”，再定义“怎么好”

[ref-pat-10] 这本书把 eval 工作顺序颠倒过来了，这是它最值钱的地方：

- 很多人一上来就问“指标是什么”
- 但书里先问“它会怎么失败”

这是 Agent 系统和普通 CRUD 系统最大的区别之一。

普通软件常见问题：

- 页面崩
- 接口 500
- 数据库超时

Agent 常见问题：

- 回答看起来像对，其实错
- 工具调了，但调错
- 检索到了，但用错
- 逻辑没崩，但业务上不可接受

所以第一步不是只盯“准确率”，而是先列：

- 幻觉类
- 漏答类
- 越权类
- 业务误判类
- 工具误用类

### 北极星指标不是准确率，而是业务损失函数

[ref-pat-11] 直接提醒你：

> Accuracy metrics 不一定等于 business success。

#### 应该看哪 3 层指标

1. **基础准确率指标**
   - false positive
   - false negative
   - overall accuracy
2. **领域结果指标**
   - 法务：漏掉关键条款
   - 金融：错误放行金额
   - 教育：成绩提升
3. **人工团队指标**
   - 节省多少审阅时间
   - 人工复核比率是否下降

**关键结论：**

Agent 的北极星指标必须和业务后果绑定，而不是只和模型分数绑定。

### Failure Mode × Metric：把“问题列表”变成“路线图”

[ref-pat-12] 给了一个很 PM 但非常实用的视角：

- 失败模式只是库存清单
- 指标只是数字仪表盘
- 只有把两者交叉，才知道下一轮应该修什么

#### 典型闭环

1. SME 看真实输出，标 failure mode
2. PM 把 failure mode 和北极星指标对上
3. Eng 针对优先 failure bucket 做实验
4. PM 再根据历史数据决定是否上线

这个思路比“大家一拍脑袋说模型不够聪明”强太多，因为它把工程迭代变成了有方向的。

### Evals 不是装饰，是回归保护网

[ref-pat-13] 到 `[ref-pat-14]` 的核心非常工程化：

- 每次改 Prompt
- 每次切模型
- 每次改工具
- 每次改 Memory

都应该在 eval 数据集上回归测试。

#### 这本书推荐的 Eval Test Suite 组成

- 一批 benchmark 数据
- 一组明确指标
- 一个 eval runner
- 一条 CI 规则

#### 数据怎么来？

3 个来源：

1. 合成数据
2. 内部用户/可信外部用户数据
3. SME 做的 golden dataset

书里的态度也很清楚：

- 早期可以先用 synthetic
- 但后期必须逐渐换成 production data

### SME 标注：不要让工程师假装自己是领域专家

[ref-pat-15] 有一句非常值得记：

很多 Agent 不是 developer tool，所以工程师并不是领域专家。

如果你在做：

- 医疗
- 法务
- 财务
- 教育

那最后说“答得对不对”的，不该只是工程师。

#### SME 标注至少要收什么

- 总体评级
- 类别标签
- 可选主观反馈

#### 这本书额外强调的两个点

1. **最好给 SME 完整 trace**
   - 用户输入
   - 工具调用
   - LLM 推理
2. **界面要符合业务语境**
   - 评邮件就渲染成邮件
   - 评合同就保留合同上下文

这意味着：

- 标注不是一个 CSV 问题
- 标注是一个可视化 review workflow 问题

### Production Data：离线集不代表线上现实

[ref-pat-16] 和 `[ref-pat-17]` 强调：

- 真实用户会不停换问题类型
- 生产分布会漂移
- 所以数据集必须版本化、持续更新

#### 生产数据闭环应该长这样

1. 线上采样 traces
2. 自动 evaluator 初筛
3. Guardrail / CI / 失败案例打标
4. SME 复核高价值样本
5. 进入 versioned dataset
6. 反馈回 eval runner 和下一轮迭代

#### LLM-as-judge 最适合做什么？

- 快速做 pass/fail
- 做 good/fair/poor 这种等级分
- 低成本扫大盘

这本书特别建议：

- 少用 `1-10` 数值评分
- 多用二元或分类评分

原因很简单：

- LLM 擅长文字判断
- 不擅长高精度数值打分

### 安全部分的核心：Lethal Trifecta

[ref-pat-18] 是整本 `Patterns` 最该硬背的安全概念。

Lethal Trifecta 三角：

1. **能访问私有数据**
2. **会处理不可信输入**
3. **能向外部发消息或执行外发动作**

三者同时存在时，prompt injection 就可能把私有数据偷出去。

#### 为什么这三个条件这么致命？

因为攻击链刚好闭环：

- 攻击者在网页/文档/issue 里塞恶意提示
- Agent 读取了这段不可信内容
- Agent 又有权访问内部信息
- 还能发邮件 / 发 PR / 回消息

于是泄露发生。

#### 书里给的关键建议

> **拿掉三角形中的任意一条边，就能打断攻击。**

最容易优先拿掉的，往往是：

- 外发能力
- 或外发能力的默认权限

### Sandbox / Granular Access / Guardrails：生产安全三件套

#### 1. Sandbox Code Execution `[ref-pat-19]`

如果 Agent 能执行代码，就必须进沙箱。

防的不是只有：

- `rm -rf`
- 偷密钥
- 挖矿

还要防：

- 长时间占满资源
- 容器逃逸
- 非法内容托管

书里强调：

- 启动速度要快
- 资源要受限
- 长任务要能被观测

#### 2. Granular Access Control `[ref-pat-20]`

Agent 的权限控制应比人类用户更细。

推荐方向：

- 工具级权限，而不是只看角色级权限
- JIT 凭证，而不是长期大权限 key
- Planning mode 下默认低权限

这点非常适合你现在的开发方式：

- 先看计划
- 再决定是否执行

#### 3. Agent Guardrails `[ref-pat-21]`

分两层：

- **Input guardrails**
  - prompt injection
  - jailbreak
  - PII
  - off-topic
- **Output guardrails**
  - 泄露
  - 幻觉
  - 毒性
  - 偏见

书里还有一个实用提醒：

- output streaming 时不只是最后检查
- 还要逐 chunk 检查

### 把 `Principles` 和 `Patterns` 合起来后的生产化清单

学完 2 本书，Mastra Agent 的最小生产闭环应该至少有：

1. 清晰 Agent / Tool 边界
2. Workflow 或显式控制流
3. 结构化 tracing
4. Streaming 更新
5. Eval test suite
6. 生产数据采样与版本化
7. SME review 机制
8. HITL / planning mode
9. Guardrails
10. 工具级权限控制
11. 必要时的代码沙箱

### 今天最该吸收的 7 个工程结论

1. **先列 failure modes，再谈优化路线。**
2. **业务指标必须绑定业务后果，不只绑定模型准确率。**
3. **Eval dataset 早期可合成，后期必须生产化。**
4. **SME 是 Agent 质量闭环中的正式角色，不是可选项。**
5. **LLM-as-judge 适合做筛查和分层，不适合假装精准打分。**
6. **Lethal Trifecta 是生产 Agent 的安全底线概念。**
7. **Guardrail、沙箱、细粒度权限要一起看，不能只靠 Prompt。**

### 这几个概念不要混

- **业务指标 ≠ 模型指标**：准确率高不代表业务风险低
- **Trace review ≠ Eval suite**：前者看个例，后者做系统回归
- **SME 评审 ≠ 众包标注**：SME 的价值在领域判断，不只是打标签
- **Guardrail ≠ Access Control**：一个管内容，一个管权限
- **Sandbox ≠ Permission**：沙箱解决执行隔离，权限解决能不能做

---

## 🔧 实践任务

### 任务 1：从 Harness Audit 看“failure mode inventory”

> 📂 去看 → `unit03-multi-agent/oc-tasks/L3-analyze/oc22-harness-audit.md`

做完要回答：

1. 这个系统最容易出现的 3 个 failure modes 是什么？
2. 哪个 failure mode 影响最大？
3. 哪个最适合先写成 eval？

### 任务 2：从 Eval Framework 看“评估脚手架”

> 📂 去看 → `unit03-multi-agent/oc-tasks/L3-analyze/oc23-eval-framework.md`

做完要回答：

1. 现在的评估是在测 step，还是在测 whole system？
2. 哪个指标其实只是技术指标，不是业务指标？
3. 哪些案例适合交给 LLM-as-judge，哪些必须人工看？

### 任务 3：从 ACI Audit 反看安全边界

> 📂 去看 → `unit01-agent-core/oc-tasks/L3-analyze/oc06-aci-audit.md`

做完要回答：

1. 哪个工具如果权限过大，会直接踩进 Lethal Trifecta？
2. 哪个工具应该拆成 read-only / write 两个版本？
3. 哪个动作最该加 planning mode 或人工确认？

---

## 🔗 深入资源（可选，需要时看）

| 资源 | 路径 | 作用 |
|---|---|---|
| Harness Audit | `unit03-multi-agent/oc-tasks/L3-analyze/oc22-harness-audit.md` | 对齐 failure mode 视角 |
| Eval Framework | `unit03-multi-agent/oc-tasks/L3-analyze/oc23-eval-framework.md` | 对齐评估脚手架 |
| Memory Audit | `unit04-state-memory/oc-tasks/L3-analyze/oc30-memory-audit.md` | 对齐长期质量与上下文失真 |

---

## 🧠 与 Muse/项目 的映射

- **Evals**
  - Muse 的 prompt / memory / tool routing 修改，后续都应该进 eval 套件
- **Observability**
  - `trace-reader` 和 Muse 日志天然适合做 production sample review
- **SME 角色**
  - 对 Muse 来说，SME 可能不是医生/律师，而是“Later 自己 + 实际用户 + 业务理解者”
- **Lethal Trifecta**
  - 一旦 Muse 能读私有资料、处理外部内容、再调用外发工具，就必须把这三角画出来
- **Planning Mode**
  - 很适合用于文件修改、数据库写入、对外发送类能力
- **Guardrails**
  - Prompt injection guard、PII guard、topic guard 都应是独立能力，而不是只写在 system prompt

---

## ✅ 自检清单

- [ ] **能列出至少 5 类常见 failure mode**
- [ ] **知道为什么业务指标不能只看准确率**
- [ ] **能解释 failure mode × metric 的交叉矩阵有什么用**
- [ ] **知道 Eval Test Suite 至少包含：数据、指标、runner、CI**
- [ ] **知道 SME 标注需要完整 trace 和合适 review UI**
- [ ] **知道 production dataset 要版本化**
- [ ] **知道 LLM-as-judge 更适合分类评分，不适合高精数值评分**
- [ ] **能背出 Lethal Trifecta 的 3 个条件**
- [ ] **知道 sandbox / access control / guardrail 各自解决什么**
- [ ] **能说出一个应该进 planning mode 的 Muse 动作**

### 面试题积累（2 题）

**Q1：如果一个 Agent 离线评测 95 分，但上线后用户投诉很多，你会怎么排查？**

> 你的回答：___
>
> 参考：先看 production traces，判断是否是数据分布漂移；再看 benchmark 是否只覆盖合成数据；再让 SME 标注线上坏例；然后把新 failure mode 加进 versioned dataset，重跑 eval 并对齐业务指标。

**Q2：请解释什么是 Lethal Trifecta，以及你会如何在系统设计上拆掉这三角。**

> 你的回答：___
>
> 参考：三角是私有数据访问 + 不可信输入 + 外发能力。只要去掉任一边就能打断攻击链。工程上可做：限制外发工具默认权限、把执行放进沙箱、加输入处理器和 output guard、拆 read/write 工具、加 planning mode。

---

## 📝 学习笔记

✅ 理论：
✅ 关键洞察：
❓ 问题：
💡 映射：
