/**
 * exp02 — 最简 Orchestrator 动态分配 Worker
 *
 * 巩固 Day 02 学习: Orchestrator-Worker 编排模式
 * - Orchestrator 根据任务类型选择合适的 Worker
 * - Worker 独立执行并返回结果
 * - Orchestrator 聚合判断是否需要下一轮
 */

function createWorker(name, canHandle, execute) {
  return { name, canHandle, execute }
}

async function orchestrate(task, workers, { maxRounds = 3 } = {}) {
  const trace = []
  let round = 0
  let remaining = task

  while (round < maxRounds && remaining) {
    round++
    const matched = workers.find(w => w.canHandle(remaining))
    if (!matched) {
      trace.push({ round, error: `no worker can handle: ${remaining}` })
      break
    }

    const result = await matched.execute(remaining)
    trace.push({ round, worker: matched.name, input: remaining, result })

    // Worker 可以返回 { done: true } 或 { next: '继续任务' }
    if (result.done) break
    remaining = result.next || null
  }

  return { totalRounds: round, trace, finalResult: trace[trace.length - 1]?.result }
}

export { createWorker, orchestrate }
