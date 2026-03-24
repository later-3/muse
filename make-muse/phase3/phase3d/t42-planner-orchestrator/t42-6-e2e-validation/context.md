# T42-6 上下文 — 端到端验证

## 背景

T42-1 到 T42-5 完成后，需要 E2E 验证整个 Planner 编排链路。验证不是单元测试，而是**真实启动 Planner 成员 + 执行者成员**，通过 MCP 工具交互完成工作流。

## 前置依赖

| 依赖 | 说明 |
|------|------|
| T42-1 | admin override + meta + rollback + driver 字段 |
| T42-2 | prompt 分叉 + gate 拦截 |
| T42-3 | create-member.sh + planner 成员目录 |
| T42-4 | Planner MCP 工具（6 个） |
| T42-5 | Planner AGENTS.md + 知识包 + Skill |

> ⚠️ **全部 T42-1 ~ T42-5 必须先完成才能做 T42-6。**

## 验证层次

| 层 | 内容 | 前置 |
|----|------|------|
| L1 集成测试 | 脚本化工具调用，mock MemberClient | T42-1/2/4 |
| L2 本地联调 | 真实启动 2 个 OpenCode 实例 | 全部 |
| L3 用户验收 | Later 通过 Telegram 驱动完整工作流 | 全部 + 部署 |

## 测试工作流定义

```json
{
  "id": "t42-e2e-test",
  "name": "T42 E2E 验证工作流",
  "driver": "planner",
  "participants": [
    { "role": "pua", "description": "写文档" }
  ],
  "initial": "write_doc",
  "nodes": {
    "write_doc": {
      "id": "write_doc",
      "type": "task",
      "participant": "pua",
      "objective": "编写测试文档",
      "instructions": ["创建 test-output.md"],
      "constraints": ["不修改 src/ 下的文件"],
      "output": { "artifact": "test-output.md" },
      "transitions": {
        "doc_done": { "target": "review", "actor": "agent" }
      }
    },
    "review": {
      "id": "review",
      "type": "review",
      "participant": "pua",
      "objective": "用户审核文档",
      "wait_for_user": true,
      "transitions": {
        "approved": { "target": "done", "actor": "user" },
        "rejected": { "target": "write_doc", "actor": "user" }
      }
    },
    "done": {
      "id": "done",
      "type": "end"
    }
  }
}
```
