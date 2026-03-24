/**
 * T15: Capability Registry 测试
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CapabilityRegistry, buildRegistry } from './registry.mjs'

describe('T15: CapabilityRegistry', () => {
  it('registerSense + querySense 正确', () => {
    const reg = new CapabilityRegistry()
    reg.registerSense({ id: 'telegram_text', label: '文字消息', status: 'available', adapter: 'TelegramSense', since: 'T14' })

    const sense = reg.querySense('telegram_text')
    assert.equal(sense.id, 'telegram_text')
    assert.equal(sense.status, 'available')
    assert.equal(sense.adapter, 'TelegramSense')
  })

  it('registerCapability + queryCapability 正确', () => {
    const reg = new CapabilityRegistry()
    reg.registerCapability({ id: 'remember_user', label: '用户记忆', provider: 'mcp', tool: 'memory-server', status: 'available', since: 'T11' })

    const cap = reg.queryCapability('remember_user')
    assert.equal(cap.id, 'remember_user')
    assert.equal(cap.provider, 'mcp')
    assert.equal(cap.tool, 'memory-server')
    assert.equal(cap.status, 'available')
  })

  it('查询不存在的 sense → null', () => {
    const reg = new CapabilityRegistry()
    assert.equal(reg.querySense('nonexistent'), null)
  })

  it('查询不存在的 capability → null', () => {
    const reg = new CapabilityRegistry()
    assert.equal(reg.queryCapability('fly'), null)
  })

  it('list() 返回所有项，senses 和 capabilities 分开', () => {
    const reg = new CapabilityRegistry()
    reg.registerSense({ id: 's1', label: 'S1', status: 'available' })
    reg.registerSense({ id: 's2', label: 'S2', status: 'unavailable' })
    reg.registerCapability({ id: 'c1', label: 'C1', provider: 'native', status: 'available' })

    const result = reg.list()
    assert.equal(result.senses.length, 2)
    assert.equal(result.capabilities.length, 1)
    assert.equal(result.senses[0].id, 's1')
    assert.equal(result.capabilities[0].id, 'c1')
  })

  it('summary() 包含可用和缺失信息', () => {
    const reg = new CapabilityRegistry()
    reg.registerSense({ id: 's1', label: '文字', status: 'available' })
    reg.registerSense({ id: 's2', label: '语音', status: 'unavailable' })
    reg.registerCapability({ id: 'c1', label: '记忆', provider: 'mcp', status: 'available' })
    reg.registerCapability({ id: 'c2', label: '语音转写', provider: 'none', status: 'missing' })

    const summary = reg.summary()
    assert.ok(summary.includes('文字✅'))
    assert.ok(summary.includes('语音❌'))
    assert.ok(summary.includes('记忆✅'))
    assert.ok(summary.includes('语音转写❌'))
    assert.ok(summary.includes('感官:'))
    assert.ok(summary.includes('能力:'))
  })

  it('registerSense 无 id → throw', () => {
    const reg = new CapabilityRegistry()
    assert.throws(() => reg.registerSense({ label: 'no id' }), /id/)
  })

  it('registerCapability 无 id → throw', () => {
    const reg = new CapabilityRegistry()
    assert.throws(() => reg.registerCapability({ label: 'no id' }), /id/)
  })
})

describe('T15: buildRegistry()', () => {
  it('创建完整 registry 且包含所有预期条目', () => {
    const reg = buildRegistry()
    const { senses, capabilities } = reg.list()

    // 至少 6 个 senses
    assert.ok(senses.length >= 6, `senses 数量: ${senses.length}`)

    // 至少 8 个 capabilities
    assert.ok(capabilities.length >= 8, `capabilities 数量: ${capabilities.length}`)

    // 关键 senses 存在
    assert.ok(reg.querySense('telegram_text'))
    assert.ok(reg.querySense('telegram_photo'))
    assert.equal(reg.querySense('telegram_audio').status, 'available')

    // 关键 capabilities 存在
    assert.ok(reg.queryCapability('remember_user'))
    assert.ok(reg.queryCapability('search_web'))
    assert.equal(reg.queryCapability('transcribe_audio').status, 'available')
  })

  it('summary() 不报错且非空', () => {
    const reg = buildRegistry()
    const summary = reg.summary()
    assert.ok(summary.length > 20, '摘要应有内容')
    assert.ok(summary.includes('✅'))
    assert.ok(summary.includes('❌'))
  })
})
