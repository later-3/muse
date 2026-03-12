/**
 * T08-1 Cerebellum 单元测试
 *
 * 使用 node:http mock server 模式 (同 engine.test.mjs)
 * 12 项测试覆盖: 健康检查、心跳、进程管理、会话清理、诊断可观测性
 *
 * 修复审核反馈:
 *   - session GC 通过 runSessionGC() 直接调用验证 (不依赖定时器)
 *   - start() 失败后验证 #running=false 状态回滚
 *   - DELETE 检查 res.ok — 验证 500 不计入 cleaned
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Cerebellum } from './cerebellum.mjs'

// --- Mock Server Helpers ---

function createMockServer(handler) {
  return new Promise(resolve => {
    const server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, port })
    })
  })
}

function closeServer(server) {
  return new Promise(resolve => server.close(resolve))
}

function makeConfig(port, overrides = {}) {
  return {
    engine: {
      host: 'http://127.0.0.1',
      port,
      workspace: '/tmp/test-workspace',
    },
    daemon: {
      heartbeatIntervalMs: 100,   // 快速心跳 (测试用)
      maxFailures: 3,
      sessionGCIntervalMs: 999_999, // 极长间隔，GC 全靠手动触发
      ...overrides,
    },
  }
}

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// --- Tests ---

describe('Cerebellum — 健康检查', () => {
  it('1. 健康检查成功 — /global/health 返回 200', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum(makeConfig(port))
    const h = await cerebellum.health()
    assert.equal(h.detail.cortex, 'healthy')

    await closeServer(server)
  })

  it('2. 健康检查失败 — 无 server 运行', async () => {
    const cerebellum = new Cerebellum(makeConfig(19999))
    const h = await cerebellum.health()
    assert.equal(h.detail.cortex, 'unreachable')
  })

  it('2b. 健康检查降级 — /global/health 失败但 /provider 成功', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return res.writeHead(503).end()
      if (req.url === '/provider') return jsonResponse(res, [])
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum(makeConfig(port))
    const h = await cerebellum.health()
    assert.equal(h.detail.cortex, 'healthy')

    await closeServer(server)
  })
})

describe('Cerebellum — 心跳监控', () => {
  it('3. 心跳成功 → consecutiveFailures 归零 + 心跳历史记录', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum(makeConfig(port))
    await cerebellum.start()
    await sleep(350)

    const h = await cerebellum.health()
    assert.equal(h.detail.consecutiveFailures, 0)
    assert.ok(h.detail.heartbeatHistory.length > 0, '应有心跳历史')
    assert.equal(h.detail.heartbeatHistory[0].ok, true)

    await cerebellum.stop()
    await closeServer(server)
  })

  it('4. 心跳连续失败触发重启 (attach 模式下不 crash)', async () => {
    let serverRunning = true
    const { server, port } = await createMockServer((req, res) => {
      if (!serverRunning) { res.writeHead(503).end(); return }
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum(makeConfig(port, { maxFailures: 2 }))
    await cerebellum.start()
    await sleep(250)

    // 模拟大脑挂掉
    serverRunning = false
    await sleep(500)

    const h = await cerebellum.health()
    assert.ok(h.detail.lastFailureReason !== null, '应有失败原因记录')

    await cerebellum.stop()
    await closeServer(server)
  })

  it('5. 心跳恢复后 consecutiveFailures 归零', async () => {
    let respondHealthy = true
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') {
        if (respondHealthy) return jsonResponse(res, { healthy: true })
        return res.writeHead(503).end()
      }
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum(makeConfig(port))
    await cerebellum.start()
    await sleep(150)

    respondHealthy = false
    await sleep(150)

    let h = await cerebellum.health()
    assert.ok(h.detail.consecutiveFailures > 0, '失败计数应 > 0')

    respondHealthy = true
    await sleep(200)

    h = await cerebellum.health()
    assert.equal(h.detail.consecutiveFailures, 0, '恢复后计数应归零')

    await cerebellum.stop()
    await closeServer(server)
  })
})

describe('Cerebellum — 会话清理 (通过 runSessionGC 直接验证)', () => {
  it('6. 过期 session (>24h) 被 DELETE', async () => {
    const deletedIds = []
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/session' && req.method === 'GET') {
        return jsonResponse(res, [
          { id: 'expired-1', createdAt: new Date(Date.now() - 25 * 3600_000).toISOString() },
          { id: 'expired-2', updatedAt: new Date(Date.now() - 48 * 3600_000).toISOString() },
          { id: 'fresh', createdAt: new Date().toISOString() },
        ])
      }
      if (req.method === 'DELETE' && req.url.startsWith('/session/')) {
        deletedIds.push(req.url.split('/').pop())
        return jsonResponse(res, { ok: true })
      }
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum(makeConfig(port))
    await cerebellum.start()

    // 直接调用 runSessionGC — 不依赖定时器
    await cerebellum.runSessionGC()

    const h = await cerebellum.health()
    assert.ok(h.detail.lastGCResult !== null, '应有 GC 结果')
    assert.equal(h.detail.lastGCResult.ok, true)
    assert.equal(h.detail.lastGCResult.cleaned, 2, '应清理 2 个过期 session')
    assert.equal(h.detail.lastGCResult.total, 3, '共 3 个 session')

    assert.deepEqual(deletedIds.sort(), ['expired-1', 'expired-2'].sort())

    await cerebellum.stop()
    await closeServer(server)
  })

  it('7. 未过期 session (<24h) 保留', async () => {
    const deletedIds = []
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/session' && req.method === 'GET') {
        return jsonResponse(res, [
          { id: 'recent-1', createdAt: new Date(Date.now() - 3600_000).toISOString() },
          { id: 'recent-2', updatedAt: new Date().toISOString() },
        ])
      }
      if (req.method === 'DELETE') {
        deletedIds.push(req.url)
        return res.writeHead(200).end()
      }
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum(makeConfig(port))
    await cerebellum.start()

    await cerebellum.runSessionGC()

    assert.equal(deletedIds.length, 0, '新 session 不应被删除')

    const h = await cerebellum.health()
    assert.equal(h.detail.lastGCResult.ok, true)
    assert.equal(h.detail.lastGCResult.cleaned, 0)

    await cerebellum.stop()
    await closeServer(server)
  })

  it('7b. DELETE 返回 500 不计入 cleaned (不乐观计数)', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/session' && req.method === 'GET') {
        return jsonResponse(res, [
          { id: 'expired', createdAt: new Date(Date.now() - 25 * 3600_000).toISOString() },
        ])
      }
      if (req.method === 'DELETE') {
        // 模拟 OpenCode 返回 500
        return res.writeHead(500).end('Internal Server Error')
      }
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum(makeConfig(port))
    await cerebellum.start()

    await cerebellum.runSessionGC()

    const h = await cerebellum.health()
    assert.equal(h.detail.lastGCResult.ok, true)
    assert.equal(h.detail.lastGCResult.cleaned, 0, 'DELETE 500 不应计入 cleaned')

    await cerebellum.stop()
    await closeServer(server)
  })
})

describe('Cerebellum — start 模式', () => {
  it('8. start — attach 模式 (已有大脑)', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum(makeConfig(port))
    await cerebellum.start()

    const h = await cerebellum.health()
    assert.equal(h.ok, true)
    assert.equal(h.detail.ownsCortex, false, 'attach 模式不拥有大脑进程')
    assert.equal(h.detail.cortex, 'healthy')

    await cerebellum.stop()
    await closeServer(server)
  })

  it('9. start — spawn 失败后 #running=false (状态回滚)', async () => {
    const cerebellum = new Cerebellum(makeConfig(19998))

    try {
      await cerebellum.start()
      assert.fail('应该抛出启动超时错误')
    } catch (err) {
      assert.ok(err.message.includes('启动超时'), `错误信息应包含"启动超时"`)
    }

    // 关键验证: 启动失败后 health().ok 必须是 false
    const h = await cerebellum.health()
    assert.equal(h.ok, false, '启动失败后 ok 应为 false')
    assert.equal(h.detail.cerebellum, 'stopped', '启动失败后应为 stopped')
    assert.ok(h.detail.lastFailureReason.includes('start failed'), '应记录失败原因')

    await cerebellum.stop()
  })
})

describe('Cerebellum — stop', () => {
  it('10. stop — 优雅关闭', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum(makeConfig(port))
    await cerebellum.start()
    await cerebellum.stop()

    const h = await cerebellum.health()
    assert.equal(h.ok, false)
    assert.equal(h.detail.cerebellum, 'stopped')

    await closeServer(server)
  })
})

describe('Cerebellum — 诊断可观测性', () => {
  it('11. health() 返回完整诊断信息', async () => {
    const { server, port } = await createMockServer((req, res) => {
      if (req.url === '/global/health') return jsonResponse(res, { healthy: true })
      if (req.url === '/session' && req.method === 'GET') return jsonResponse(res, [])
      res.writeHead(404).end()
    })

    const cerebellum = new Cerebellum(makeConfig(port))
    await cerebellum.start()

    // 等几次心跳 + 手动触发 GC
    await sleep(350)
    await cerebellum.runSessionGC()

    const h = await cerebellum.health()

    // 基础字段
    assert.equal(typeof h.ok, 'boolean')
    assert.equal(typeof h.detail.cerebellum, 'string')
    assert.equal(typeof h.detail.cortex, 'string')
    assert.equal(typeof h.detail.consecutiveFailures, 'number')
    assert.equal(typeof h.detail.ownsCortex, 'boolean')

    // 诊断可观测性一等产物
    assert.ok('lastRestartTime' in h.detail, '应包含 lastRestartTime')
    assert.ok('lastFailureReason' in h.detail, '应包含 lastFailureReason')
    assert.ok(Array.isArray(h.detail.heartbeatHistory), '应包含 heartbeatHistory 数组')
    assert.ok(h.detail.heartbeatHistory.length > 0, '应有心跳历史记录')
    assert.ok('lastGCResult' in h.detail, '应包含 lastGCResult')

    // 心跳条目格式
    const entry = h.detail.heartbeatHistory[0]
    assert.equal(typeof entry.ok, 'boolean')
    assert.equal(typeof entry.time, 'string')

    // GC 结果格式 (因为手动触发过)
    assert.ok(h.detail.lastGCResult !== null, 'GC 结果不应为 null')
    assert.equal(h.detail.lastGCResult.ok, true)
    assert.equal(typeof h.detail.lastGCResult.cleaned, 'number')

    await cerebellum.stop()
    await closeServer(server)
  })
})
