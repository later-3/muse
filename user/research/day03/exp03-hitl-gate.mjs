/**
 * exp03 — 人类审批 Gate (HITL)
 *
 * 巩固 Day 03: Human-in-the-Loop 模式
 * - 高风险动作被拦截
 * - 等待人类审批（模拟 approve/reject）
 * - 审批后继续或中止
 */

function createGate({ riskClassifier, onPending }) {
  const pending = new Map()
  let nextId = 1

  return {
    async submit(action) {
      const risk = riskClassifier(action)
      if (risk === 'low') return { approved: true, auto: true, action }

      const id = `gate-${nextId++}`
      const entry = { id, action, risk, status: 'pending', createdAt: Date.now() }
      pending.set(id, entry)
      if (onPending) onPending(entry)
      return { approved: false, gateId: id, status: 'pending', risk }
    },

    approve(gateId, reason) {
      const entry = pending.get(gateId)
      if (!entry) return { error: 'not found' }
      if (entry.status !== 'pending') return { error: `already ${entry.status}` }
      entry.status = 'approved'
      entry.reason = reason
      entry.resolvedAt = Date.now()
      return { approved: true, action: entry.action, gateId }
    },

    reject(gateId, reason) {
      const entry = pending.get(gateId)
      if (!entry) return { error: 'not found' }
      if (entry.status !== 'pending') return { error: `already ${entry.status}` }
      entry.status = 'rejected'
      entry.reason = reason
      entry.resolvedAt = Date.now()
      return { rejected: true, gateId, reason }
    },

    getPending() { return [...pending.values()].filter(e => e.status === 'pending') },
    getAll() { return [...pending.values()] },
  }
}

export { createGate }
