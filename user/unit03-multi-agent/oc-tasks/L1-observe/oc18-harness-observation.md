# oc30: 触发一次 Muse Harness 工作流

> **USOLB:** `[U]`使用 `[L]`日志
> **Bloom Level:** 1 — 观察
> **对应理论:** 02a §Orchestrator-Workers
> **目标:** 给 planner 发复杂任务，观察它怎么拆分、怎么派给 arch/coder

---

## 操作步骤

### Step 1: 启动 Muse planner

```bash
./start.sh later-muse-family pua   # pua 就是 planner 角色
```

### Step 2: 发一个需要多角色协作的任务

通过 Telegram 给 pua 发:
```
帮我在 Muse 项目里加一个健康检查 API endpoint，返回 { status: 'ok', uptime: xxx }
```

> 这个任务足够复杂，planner 应该会拆分给 arch(设计) 和 coder(编码)。

### Step 3: 观察日志

```bash
# 看 planner 的日志
tail -f families/later-muse-family/members/planner/data/logs/muse_*.log

# 看 arch/coder 是否被触发
tail -f families/later-muse-family/members/arch/data/logs/muse_*.log
```

---

## 观察记录

### Q1: planner 拆了几个子任务？
```
（填写）
```

### Q2: 每个子任务派给了谁？(arch? coder? reviewer?)
```
（填写）
```

### Q3: 子任务之间是顺序执行还是并行？
```
（填写: 对应 BEA 的 Chain 还是 Parallel？）
```

### Q4: 有没有看到 handoff 事件？
```
（填写）
```

### Q5: 最终结果是怎么汇总的？
```
（填写: 对应 Orchestrator-Workers 的 "综合结果" 步骤）
```
