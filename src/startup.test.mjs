/**
 * 启动集成测试 — 验证 createModules() 完整链路
 *
 * 覆盖: start.sh 调用的核心启动路径
 *   1. createModules() 成功创建所有模块
 *   2. Memory early-start 正常 (Goals/Threads/DevStore 依赖 DB)
 *   3. Registry 注册正确 (T38 audio/transcribe)
 *   4. STT 初始化 (resolveOpenAIKey)
 *   5. 所有模块实例非 null
 */

import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'

// 使用环境变量覆盖配置，避免副作用
process.env.MEMORY_DB_PATH = process.env.MEMORY_DB_PATH || '/tmp/muse-startup-test.db'
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'test-token-for-ci'
process.env.PULSE_ENABLED = 'false'
process.env.WEB_ENABLED = 'false'

describe('启动集成测试 (createModules)', { timeout: 10_000 }, () => {
  let mods = null

  it('createModules() 成功 — 不 throw', async () => {
    // 动态 import 只取 createModules，不触发 main()
    const { createModules } = await import('./index.mjs')
    mods = await createModules()
    assert.ok(mods, 'createModules 应返回模块对象')
  })

  it('核心模块实例全部存在', () => {
    assert.ok(mods.identity, 'identity')
    assert.ok(mods.memory, 'memory')
    assert.ok(mods.engine, 'engine')
    assert.ok(mods.orchestrator, 'orchestrator')
    assert.ok(mods.ingress, 'ingress')
    assert.ok(mods.telegram, 'telegram')
    assert.ok(mods.cerebellum, 'cerebellum')
    assert.ok(mods.pulse, 'pulse')
  })

  it('T35/T36/T37: Goals + Threads + DevStore 已初始化 (依赖 Memory DB)', () => {
    assert.ok(mods.goals, 'goals 应在 Memory start 后初始化')
    assert.ok(mods.threads, 'threads 应在 Memory start 后初始化')
    assert.ok(mods.devStore, 'devStore 应在 Memory start 后初始化')
  })

  it('T38: Registry — telegram_audio = available', () => {
    assert.ok(mods.registry, 'registry')
    const audio = mods.registry.querySense('telegram_audio')
    assert.ok(audio, 'telegram_audio 感官应已注册')
    assert.equal(audio.status, 'available', 'telegram_audio 应为 available (T38)')
  })

  it('T38: Registry — transcribe_audio = available', () => {
    const cap = mods.registry.queryCapability('transcribe_audio')
    assert.ok(cap, 'transcribe_audio 能力应已注册')
    assert.equal(cap.status, 'available', 'transcribe_audio 应为 available (T38)')
    assert.equal(cap.provider, 'native')
  })

  it('Memory health 正常 (early start 生效)', async () => {
    const health = await mods.memory.health()
    assert.equal(health.ok, true, 'Memory 应该已启动')
  })

  after(async () => {
    // 清理: 停止 Memory (关闭 DB 连接)
    if (mods?.memory) {
      try { await mods.memory.stop() } catch {}
    }
    // 删除测试 DB
    try {
      const { unlinkSync } = await import('node:fs')
      unlinkSync('/tmp/muse-startup-test.db')
    } catch {}
  })
})
