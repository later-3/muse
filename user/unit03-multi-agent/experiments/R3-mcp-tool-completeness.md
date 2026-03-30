# R3: MCP 工具注册完整性检查

> **消险任务**: 检查 Muse MCP 工具体系的完整性和一致性  
> **分析对象**: `src/mcp/memory.mjs` (983 行)

---

## 工具清单审计

| 分类 | 工具名 | 参数数 | required | 有 description | 评估 |
|------|--------|--------|----------|---------------|------|
| **Memory** | search_memory | 4 | 1 | ✅ 详细 | ✅ |
| | set_memory | 9 | 2 | ✅ 含 source 说明 | ✅ |
| | get_user_profile | 1 | 0 | ✅ | ✅ |
| | get_recent_episodes | 2 | 0 | ✅ | ✅ |
| | add_episode | 5 | 1 | ✅ | ✅ |
| **Goals** | create_goal | 5 | 1 | ✅ 含示例 | ✅ |
| | list_goals | 2 | 0 | ✅ | ✅ |
| | update_goal | 4 | 1 | ✅ | ✅ |
| **Threads** | create_thread | 4 | 1 | ✅ | ✅ |
| | list_threads | 2 | 0 | ✅ | ✅ |
| | get_thread | 1 | 1 | ✅ | ✅ |
| **Telegram** | send_photo | 3 | 1 | ✅ | ✅ |
| | send_message | 2 | 1 | ✅ | ✅ |
| **Image** | generate_image | 4 | 1 | ✅ | ✅ |
| | search_image | 2 | 1 | ✅ | ✅ |
| **Planner** | workflow_create | 3 | 0 | ✅ | 🟡 无 required |
| | workflow_admin_transition | 5 | 2 | ✅ | ✅ |
| | workflow_inspect | 1 | 1 | ✅ | ✅ |
| | workflow_rollback | 3 | 3 | ✅ | ✅ |
| | workflow_status | 1 | 0 | ✅ | ✅ |
| | workflow_update | 3 | 2 | ✅ | ✅ |
| | handoff_to_member | 3 | 2 | ✅ | ✅ |
| | read_artifact | 2 | 2 | ✅ | ✅ |
| **Callback** | notify_planner | 4 | 3 | ✅ | ✅ |

**总计: 23 个 MCP 工具**

## 风险点

| # | 风险 | 等级 | 说明 |
|---|------|------|------|
| 1 | **角色工具隔离不完整** | 🟡 | Worker 能看到 Planner 的 workflow_create 等工具。应按角色注册不同工具集 |
| 2 | **Pexels API Key 硬编码** | 🔴 | `memory.mjs:709` 写了一个默认 API Key 在代码里 |
| 3 | **无工具调用频率限制** | 🟡 | LLM 可以无限调用 set_memory → 数据库膨胀 |
| 4 | **description 语言不统一** | 🟢 | 部分中文部分中英混合，不影响功能但不规范 |

## 整体评估: 🟢 7/10

工具体系较完整，description 质量高（含示例、场景说明）。核心风险是角色隔离和 API Key 暴露。
