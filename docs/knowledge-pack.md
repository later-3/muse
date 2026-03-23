# Muse 知识包体系

> 每个 Muse 成员需要上下文才能做好决策。知识包体系定义了知识的组织方式和加载机制。

## 核心原则

1. **不造新入口** — 真相源只有 AGENTS.md + 现有文档，不引入新加载链路
2. **不注入全文** — prompt 只放路径和摘要，AI 用 read 按需读取
3. **顺着 OpenCode 长** — 利用 read 自动带出局部 AGENTS.md 的特性
4. **不加重负担** — 常驻 token 只增加 5-10 行

## 四层架构

```
Layer 1: AGENTS.md           身份+原则+约束           永远在，≤60 行
Layer 2: 局部 AGENTS.md      目录级知识/约束           read 时自动带出
Layer 3: INDEX.md            知识导航清单              可选，AI 需要时读
Layer 4: 现有文档             架构/哲学/配置/踩坑        AI 按需 read
```

### Layer 1: AGENTS.md

只放身份 + 原则 + 约束 + 一行指向：

```markdown
## 知识导航
执行任务前先 read `knowledge/INDEX.md` 获取知识清单。
```

不放架构知识、不放模块说明、不放项目状态。

### Layer 2: 局部 AGENTS.md

利用 OpenCode 特性：AI read 某目录下文件时，自动加载该目录的 AGENTS.md。在关键目录放短文件：

| 目录 | 内容 |
|------|------|
| `muse/src/workflow/` | 工作流引擎目录，核心模块说明 |
| `muse/src/family/` | Family 通信层，registry/handoff/member-client |
| `muse/src/plugin/hooks/` | Hook 系统，workflow-prompt/workflow-gate |
| `muse/docs/` | Muse 产品文档目录，architecture/philosophy/config |

每个文件 5-10 行。AI 在 read 代码时**自动获得上下文**，不用额外注入。

### Layer 3: INDEX.md

放在 `families/{family}/knowledge/INDEX.md`，是一个导航目录：

```markdown
# Muse 知识导航

| 主题 | 文件 | 说明 |
|------|------|------|
| 系统架构 | muse/docs/architecture.md | 5 层架构 |
| 设计哲学 | muse/docs/philosophy.md | 6 个原则 |
| 配置参考 | muse/docs/configuration.md | 环境变量+模块 |
| 踩坑记录 | phase1/EXPERIENCE.md | BUG-001~015 |
| 项目状态 | muse/PROJECT_STATE.json | 当前演进 |
| 演进愿景 | ARCHITECTURE.md | 大脑/小脑/Pulse |
| 开发规范 | .agents/workflows/dev-convention.md | ESM/test/commit |
```

不是加载入口，不含元数据，就是给 AI 看的地图。

### Layer 4: 现有文档

`muse/docs/`, `ARCHITECTURE.md`, `PHILOSOPHY.md` 维持原位，不复制。

## 工作流上下文

节点声明 `read_first`（路径列表），prompt 只说"先读这些"：

```json
"tech_design": {
  "input": { "artifacts": ["task-brief.md"] },
  "read_first": [
    "muse/docs/architecture.md",
    "muse/docs/philosophy.md"
  ]
}
```

`compileNodePrompt` 注入：
```
## 前置阅读
执行前先 read 以下文件（不要跳过）：
- muse/docs/architecture.md
- muse/docs/philosophy.md
```

不注入全文，只注入路径。AI 自己去 read，内容进对话上下文而非 system prompt。

## 后续演进方向

- **session 复用**：同角色跨节点保活 session，已读文档留在上下文
- **知识版本化**：INDEX.md 加 updated 字段，AI 判断是否需要重读
- **自动生成**：从代码结构自动生成局部 AGENTS.md
