# T02 身份系统 — 评审请求

你好，你是一个资深软件架构师。请评审下面的 T02 身份系统技术方案。

---

## 项目背景

我们在开发 **Muse**，一个终身 AI 助手。技术栈：Node.js ESM + OpenCode REST API + SQLite + telegraf。

### 已完成

**T01 项目脚手架**（已通过评审并实现）：
- `package.json`: ESM, Node 20, better-sqlite3/telegraf/dotenv
- `muse/config.mjs`: 配置系统 + `validateConfig()` fail-fast
- `muse/logger.mjs`: 结构化日志 `createLogger(module)` → `[time][level][module]`
- `muse/index.mjs`: 入口 + 配置校验
- 架构约束: 模块依赖方向 `adapters/web/daemon → orchestrator → engine/memory/identity`
- 生命周期接口: 所有模块实现 `start()/stop()/health()`

### 当前任务

T02 身份系统 — 定义助手人格 + 生成 system prompt。

### 参考项目

- **ZeroClaw** (Rust): AIEOS 规范定义 AI 身份，含 identity/psychology/linguistics/motivations/capabilities/physicality/history/interests 8 个 section
- **OpenClaw** (TypeScript): 多 Agent 多 Channel 身份配置，层级优先级覆盖

---

## 评审材料

请阅读以下文件然后评审：

- `phase1/t02-identity/README.md` — T02 技术方案

---

## 评审角度

1. **identity.json 格式设计**: JSON schema 是否合理？字段是否够用？有没有遗漏？
2. **性格→Prompt 映射**: 滑块值(0-1)转为文字描述的方案是否可行？有没有更好的方式？
3. **System Prompt 质量**: buildSystemPrompt() 生成的 prompt 是否能有效引导模型行为？
4. **热更新方案**: watchFile 监听文件变更的方式是否稳定？有没有坑？
5. **与 T01 的衔接**: 是否正确遵循了生命周期接口和依赖方向？
6. **可行性**: 可以直接开始开发了吗？有没有疑问？

请用中文给出专业评审意见。

---

## 评审结论

结论：方案方向正确，`identity.json + system prompt + 热更新` 这条线在 Phase 1 可以落地；但按当前文档，**还不建议直接开始开发**。至少有 `4` 个高优先级问题需要先补齐，否则实现阶段会出现配置损坏、生命周期不完整、测试与实现不一致的问题。

### 1. 高优先级问题

#### 1.1 `stop()` 实现不完整

`core/identity.mjs` 示例代码里只导入了：

```js
import { readFileSync, writeFileSync, watchFile } from 'node:fs'
```

但 `stop()` 中调用了 `unwatchFile(this.#path)`。如果按当前代码实现，执行 `stop()` 会直接抛 `ReferenceError`，没有真正满足 T01 的生命周期接口要求。

#### 1.2 `update()` 的浅合并会破坏嵌套配置

当前方案：

```js
this.#data = { ...this.#data, ...newData }
```

这只适合平铺对象，不适合 `identity.json` 这种嵌套结构。  
例如 Web 只更新 `psychology.traits.humor`，很可能把 `psychology.mbti` 或其他 traits 一起覆盖掉。这里必须改成：

- 深合并
- 写盘前校验 schema
- 最好使用原子写入

否则一次局部编辑就可能把身份配置写坏。

#### 1.3 性格滑块映射与规格不一致

文档表格定义了 `5` 个滑块在 `3` 个区间下的映射，但示例代码只处理了部分“高值”分支：

- `humor < 0.4` 没实现
- `warmth < 0.4` 没实现
- `initiative < 0.4` 没实现
- `precision < 0.4` 没实现
- 只有 `verbosity` 同时处理了高低两个分支

而测试方案中又明确写了：

```text
humor=0.2 → prompt 含“严肃”
```

这说明当前“文档规格”和“示例实现”已经冲突，测试按现在的实现会失败。

#### 1.4 缺少 machine-readable schema

现在只有 JSON 示例，没有正式 schema。  
对于一个会被 Web 编辑、还支持热更新的配置系统，至少需要定义：

- 必填字段
- 数值范围（traits 必须在 `0..1`）
- 枚举值（如 `language`、`formality`）
- 数组长度限制（如 `catchphrases`、`values`）

没有 schema，运行时只能靠 `JSON.parse()` 兜底，配置一旦写错，问题会拖到模型行为层才暴露。

### 2. 分项评审

#### 2.1 `identity.json` 格式设计

基础结构是合理的，Phase 1 保留 `identity / psychology / linguistics / motivations / boundaries` 这 `5` 个 section，复杂度控制得不错。

但建议补这 `3` 类元信息：

- `id`：身份配置唯一标识
- `updatedAt`：最近更新时间
- `schemaVersion`：未来兼容迁移用

另外，建议把 `traits` 的合法 key 也固定下来，不要允许任意扩展，否则 Web 和 Prompt Builder 很难保持一致。

#### 2.2 性格 → Prompt 映射

“滑块 `0-1` → 三档文字描述”是可行的，适合 Phase 1。  
但不建议把阈值判断直接散落在 `buildSystemPrompt()` 里，建议拆成两步：

1. `traits -> labels`
2. `labels -> prompt fragments`

这样后面调整阈值、补充更多 traits、做多语言时，不需要重写整个 prompt 模板。

#### 2.3 System Prompt 质量

当前 prompt 更像“人格简介”，还不算“系统约束”。  
它能表达角色和风格，但缺少稳定控制模型行为的硬规则，至少还应补：

- 默认回答语言
- 默认回答长度/简洁度
- 遇到不确定信息时如何表达
- 禁止伪造记忆/经历/事实
- 工具能力边界由谁负责
- 当“主动建议”和“简洁回答”冲突时的优先级

建议把 prompt 固定为 `4` 层：

1. role
2. style
3. behavioral rules
4. safety boundaries

人格描述是软约束，规则和优先级才是硬约束。

#### 2.4 热更新方案

`watchFile(..., { interval: 2000 })` 在 Phase 1 可以接受，但要明确它的局限：

- 轮询不是实时，存在 `2s` 延迟
- 连续保存可能重复触发
- 写文件进行到一半时，reload 可能读到不完整 JSON

建议最少补 `2` 个保护：

1. Web 保存时采用“临时文件 + rename”原子替换
2. reload 失败时保留 `last-known-good` 配置，不污染当前内存态

#### 2.5 与 T01 的衔接

依赖方向上是正确的：`identity` 属于内核模块，`Web` 只是调用 `update()`。  
生命周期接口形式上也对，但质量上还没闭环：

- `start()` 有
- `health()` 有
- `stop()` 当前实现不可用
- 没有正式配置校验
- 没有坏配置回退机制

因此与 T01 是“方向一致”，但还没达到“可稳定集成”的标准。

#### 2.6 可行性

可以做，但不建议按当前文档原样开工。  
我建议先补完下面 `5` 项，再进入实现：

1. `identity.schema.json`
2. 深合并策略
3. 原子写入策略
4. prompt 固定骨架
5. 热更新失败回退机制

### 3. 建议的最小修正集

为了不拖慢 Phase 1 节奏，建议只做最小必要增强：

1. 增加 `identity.schema.json`
2. `update()` 改为深合并 + schema 校验
3. `buildSystemPrompt()` 改成“固定模板 + traits 映射结果填充”
4. `watchFile` 保留，但增加 `last-known-good`
5. `stop()` 补齐 `unwatchFile` 导入与测试
6. 明确 Phase 1 只支持 `global identity`，但接口预留后续 `override` 能力

### 4. 最终结论

最终判断：**方案可行，但当前版本还不能算“可直接开发”**。  
如果先补掉上面 `4` 个高优先级问题，这个 T02 就能在不破坏 T01 架构约束的前提下稳妥推进。

---

## T02 开发结果审核（提交 `354f614`）

结论：`T02` 的实现质量明显高于最初方案，之前评审指出的核心问题大部分已经修复，包括：

- 补齐了生命周期接口
- 加入了 traits/schema 校验
- `update()` 改成了深合并
- 写盘采用了 `tmp + rename` 原子写入
- prompt 改成了 `4` 层结构
- 增加了 `17/17` 自动化测试

我本地复核后，当前仍有 `3` 个需要处理的点，其中 `2` 个是实现问题，`1` 个是测试覆盖缺口。

### 1. 发现的问题

#### 1.1 `data` getter 暴露了可变内部状态

`muse/core/identity.mjs` 里这段注释写的是“只读副本”：

```js
/** 获取当前身份数据（只读副本） */
get data() {
  return this.#data
}
```

但实际上返回的是内部对象引用，不是副本。调用方可以直接修改：

```js
identity.data.psychology.traits.humor = 999
```

这样会绕过：

- `update()` 的深合并
- `#validate()` 的 schema 校验
- `updatedAt` 更新
- 持久化写盘

这会破坏模块边界。建议改成：

```js
get data() {
  return structuredClone(this.#data)
}
```

或者把注释改成“返回内部状态引用，禁止外部修改”，但前者更稳。

#### 1.2 `DEFAULT_IDENTITY.updatedAt` 在模块加载时就固定了

当前实现：

```js
const DEFAULT_IDENTITY = {
  ...
  updatedAt: new Date().toISOString(),
  ...
}
```

这个时间戳只会在模块 import 时计算一次。  
如果进程启动后过了很久才第一次创建默认 `identity.json`，文件里写入的 `updatedAt` 不是实际创建时间，而是进程加载模块的时间。

建议把默认配置改成工厂函数，例如：

```js
function createDefaultIdentity() {
  return {
    ...,
    updatedAt: new Date().toISOString(),
  }
}
```

再在 `#load()` 里调用。

#### 1.3 “last-known-good 回退”测试没有真正覆盖热更新失败路径

测试里这段：

```js
writeFileSync(config.identity.path, '{ invalid json !!!', 'utf-8')
assert.equal(identity.data.identity.name, '小缪')
```

只能证明“文件被写坏后，内存里的旧对象还在”，但没有真正触发 `watchFile` 回调，也没有验证 reload 失败时是否真的依赖 `last-known-good` 继续工作。

当前测试并不能证明：

- 热更新回调会进入失败分支
- 失败后实例状态仍然可用
- 后续再次写入有效配置后可以恢复

建议把 reload 逻辑抽成可单测的方法，例如 `reloadFromDisk()`，然后：

1. 先加载有效配置
2. 写坏文件
3. 调用 `reloadFromDisk()`，断言保留旧值
4. 再写回有效文件
5. 再次 `reloadFromDisk()`，断言成功恢复

### 2. 简短评价

除了上面 `3` 点，T02 其余关键实现是成立的：

- `traits -> labels -> prompt` 两段式映射是对的
- `4` 层 prompt 骨架比最初方案更稳
- 深合并策略满足 Web 局部更新场景
- 原子写入方案是合理的 Phase 1 做法
- `node --test muse/core/identity.test.mjs` 复跑通过，结果为 `17/17`

因此，`T02` 目前可以视为“**基本可合并，但建议补一轮小修**”。

---

## T01 开发结果补充审核（提交 `627e79e`）

结论：`T01` 作为脚手架是能用的，`config/logger/index/package.json` 这些基础设施已经搭起来了，目录和依赖方向也没有明显跑偏。但从“后续任务的稳定底座”角度看，当前还有 `3` 个比较实质的问题，建议在后续任务开始前顺手修掉。

### 1. 发现的问题

#### 1.1 `validateConfig()` 直接 `process.exit(1)`，降低了可组合性和可测试性

当前实现：

```js
export function validateConfig() {
  ...
  if (errors.length > 0) {
    console.error(...)
    process.exit(1)
  }
}
```

这对 CLI 入口是方便的，但它把“校验逻辑”和“进程退出策略”耦合死了。后续如果：

- Web 驾驶舱想显示配置错误而不是直接退出
- 测试想断言错误列表
- 守护进程想上报健康状态

都会很别扭。

更好的结构是：

1. `validateConfig(config)` 返回错误数组或直接 `throw`
2. `index.mjs` 决定是否打印并退出

现在测试里也只能通过 monkey patch `process.exit` 来验证，这本身就说明接口设计偏硬。

#### 1.2 非数字端口不会被正确拦截

当前代码使用：

```js
port: parseInt(process.env.OPENCODE_PORT || '4096', 10)
```

后面校验是：

```js
if (config.engine.port < 1 || config.engine.port > 65535) ...
```

如果环境变量是：

```text
OPENCODE_PORT=abc
```

那么 `parseInt('abc', 10)` 会得到 `NaN`，而：

```js
NaN < 1
NaN > 65535
```

都会是 `false`，结果这个非法值会直接溜过去。  
`WEB_PORT`、`MAX_EPISODIC_DAYS`、`HEARTBEAT_INTERVAL` 等同类字段也有一样的问题。

建议统一改成：

```js
if (!Number.isInteger(config.engine.port) || config.engine.port < 1 || config.engine.port > 65535) ...
```

#### 1.3 `config` 在模块加载时冻结了环境快照，长生命周期场景可维护性一般

`config.mjs` 顶层直接导出了：

```js
export const config = { ...process.env... }
```

这意味着它在 import 时就读取了一次环境变量，之后不会再变。  
这对纯 CLI 启动问题不大，但对长期运行、热重载、测试隔离都不够友好。当前测试已经不得不使用：

```js
await import('./config.mjs?t=' + Date.now())
```

来强行绕过模块缓存。

如果后续 Phase 1/2 里配置还会扩展，建议尽早改成：

- `loadConfig()` 返回新对象
- `validateConfig(cfg)` 校验传入对象
- 入口再缓存成 `const config = loadConfig()`

这样结构更清晰，也更利于测试。

### 2. 简短评价

T01 已经完成了脚手架最核心的 `4` 件事：

- 建立了 Node 20 + ESM 的运行基线
- 有了统一配置入口
- 有了统一日志格式
- 有了一个最小可启动入口

这些足够支撑 T02 继续开发。  
但如果把它看成长期底座，建议尽快把“配置校验与退出策略解耦”“NaN 校验补齐”“配置加载函数化”这 `3` 点补上，否则后续任务会持续在这些小问题上绕弯。

### 3. 总体判断

综合看：

- `T01`：**可作为 Phase 1 底座继续使用，但建议补一轮配置系统小修**
- `T02`：**功能已基本完成，建议补完 `data getter / updatedAt / 热更新回退测试` 后收口**
