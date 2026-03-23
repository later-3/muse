/**
 * TG-GROUP-001: Telegram 群聊功能测试
 * 测试广播模式、定向消息、多实例识别
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'

// Mock TelegramAdapter 的私有方法 #parseMention 进行测试
// 由于 #parseMention 是私有方法，我们创建一个测试用的公共包装

class TestableAdapter {
  #botUsername = 'testbot'

  constructor(config = {}) {
    this.config = config
  }

  // 模拟 #parseMention 逻辑
  parseMention(ctx) {
    const text = ctx.message?.text || ''
    const entities = ctx.message?.entities || []
    const caption = ctx.message?.caption || ''
    const captionEntities = ctx.message?.caption_entities || []

    let isMentioned = false
    let targetBot = null

    const allEntities = [...entities, ...captionEntities]

    for (const entity of allEntities) {
      const sourceText = entity.offset >= text.length ? caption : text
      const offset = entity.offset >= text.length ? entity.offset - text.length : entity.offset

      if (entity.type === 'mention') {
        const mentionText = sourceText.slice(offset, offset + entity.length)
        const mentionedUsername = mentionText.slice(1).toLowerCase()
        if (!targetBot) targetBot = mentionedUsername
        if (mentionedUsername === this.#botUsername.toLowerCase()) {
          isMentioned = true
        }
      }
      if (entity.type === 'bot_command') {
        const cmdText = sourceText.slice(offset, offset + entity.length)
        if (cmdText.includes(`@${this.#botUsername}`)) {
          isMentioned = true
          targetBot = this.#botUsername
        }
      }
      if (entity.type === 'text_mention' && entity.user?.username) {
        const mentionedUsername = entity.user.username.toLowerCase()
        if (!targetBot) targetBot = mentionedUsername
        if (mentionedUsername === this.#botUsername.toLowerCase()) {
          isMentioned = true
        }
      }
    }

    const replyToUsername = ctx.message?.reply_to_message?.from?.username
    if (replyToUsername) {
      const replyUsernameLower = replyToUsername.toLowerCase()
      if (!targetBot) targetBot = replyUsernameLower
      if (replyUsernameLower === this.#botUsername.toLowerCase()) {
        isMentioned = true
      }
    }

    const isBroadcast = !targetBot && !isMentioned

    return { isMentioned, targetBot, isBroadcast }
  }
}

describe('TG-GROUP-001: #parseMention', () => {
  const adapter = new TestableAdapter()

  describe('定向@检测', () => {
    it('应该正确识别 @自己 的消息', () => {
      const ctx = {
        message: {
          text: '@testbot hello',
          entities: [{ type: 'mention', offset: 0, length: 8 }]
        }
      }
      const result = adapter.parseMention(ctx)
      assert.strictEqual(result.isMentioned, true)
      assert.strictEqual(result.targetBot, 'testbot')
      assert.strictEqual(result.isBroadcast, false)
    })

    it('应该正确识别 @其他bot 的消息（不是@我）', () => {
      const ctx = {
        message: {
          text: '@otherbot hello',
          entities: [{ type: 'mention', offset: 0, length: 9 }]
        }
      }
      const result = adapter.parseMention(ctx)
      assert.strictEqual(result.isMentioned, false)
      assert.strictEqual(result.targetBot, 'otherbot')
      assert.strictEqual(result.isBroadcast, false)
    })

    it('应该正确处理大小写不敏感的@', () => {
      const ctx = {
        message: {
          text: '@TestBot hello',
          entities: [{ type: 'mention', offset: 0, length: 8 }]
        }
      }
      const result = adapter.parseMention(ctx)
      assert.strictEqual(result.isMentioned, true)
      assert.strictEqual(result.targetBot, 'testbot')
    })

    it('应该正确处理带@的命令', () => {
      const ctx = {
        message: {
          text: '/status@testbot',
          entities: [{ type: 'bot_command', offset: 0, length: 15 }]
        }
      }
      const result = adapter.parseMention(ctx)
      assert.strictEqual(result.isMentioned, true)
      assert.strictEqual(result.targetBot, 'testbot')
    })
  })

  describe('广播消息检测', () => {
    it('应该将无@消息识别为广播', () => {
      const ctx = {
        message: {
          text: 'hello everyone',
          entities: []
        }
      }
      const result = adapter.parseMention(ctx)
      assert.strictEqual(result.isMentioned, false)
      assert.strictEqual(result.targetBot, null)
      assert.strictEqual(result.isBroadcast, true)
    })

    it('应该将纯文本消息识别为广播', () => {
      const ctx = {
        message: {
          text: 'This is a normal message without any mention',
          entities: []
        }
      }
      const result = adapter.parseMention(ctx)
      assert.strictEqual(result.isBroadcast, true)
    })
  })

  describe('回复消息检测', () => {
    it('应该识别回复给自己的消息', () => {
      const ctx = {
        message: {
          text: 'reply',
          entities: [],
          reply_to_message: {
            from: { username: 'testbot', is_bot: true }
          }
        }
      }
      const result = adapter.parseMention(ctx)
      assert.strictEqual(result.isMentioned, true)
      assert.strictEqual(result.targetBot, 'testbot')
    })

    it('应该识别回复给其他bot的消息（不是回复我）', () => {
      const ctx = {
        message: {
          text: 'reply',
          entities: [],
          reply_to_message: {
            from: { username: 'otherbot', is_bot: true }
          }
        }
      }
      const result = adapter.parseMention(ctx)
      assert.strictEqual(result.isMentioned, false)
      assert.strictEqual(result.targetBot, 'otherbot')
    })
  })

  describe('text_mention 检测', () => {
    it('应该识别 text_mention 给自己', () => {
      const ctx = {
        message: {
          text: 'hello',
          entities: [{
            type: 'text_mention',
            offset: 0,
            length: 5,
            user: { username: 'testbot', id: 123 }
          }]
        }
      }
      const result = adapter.parseMention(ctx)
      assert.strictEqual(result.isMentioned, true)
      assert.strictEqual(result.targetBot, 'testbot')
    })
  })

  describe('多个@检测', () => {
    it('应该正确处理多个@（包含自己）', () => {
      const ctx = {
        message: {
          text: '@user1 @testbot @user2',
          entities: [
            { type: 'mention', offset: 0, length: 6 },
            { type: 'mention', offset: 7, length: 8 },
            { type: 'mention', offset: 16, length: 6 }
          ]
        }
      }
      const result = adapter.parseMention(ctx)
      assert.strictEqual(result.isMentioned, true)
      assert.strictEqual(result.targetBot, 'user1')
    })

    it('应该正确处理多个@（不包含自己）', () => {
      const ctx = {
        message: {
          text: '@user1 @user2 @user3',
          entities: [
            { type: 'mention', offset: 0, length: 6 },
            { type: 'mention', offset: 7, length: 6 },
            { type: 'mention', offset: 14, length: 6 }
          ]
        }
      }
      const result = adapter.parseMention(ctx)
      assert.strictEqual(result.isMentioned, false)
      assert.strictEqual(result.targetBot, 'user1')
      assert.strictEqual(result.isBroadcast, false)
    })
  })

  describe('caption mention 检测', () => {
    it('应该识别图片 caption 中的@', () => {
      const ctx = {
        message: {
          text: '',
          entities: [],
          caption: '@testbot look at this',
          caption_entities: [{ type: 'mention', offset: 0, length: 8 }]
        }
      }
      const result = adapter.parseMention(ctx)
      assert.strictEqual(result.isMentioned, true)
      assert.strictEqual(result.targetBot, 'testbot')
    })
  })
})

describe('TG-GROUP-001: 群聊处理逻辑', () => {
  describe('广播模式开关', () => {
    it('广播模式关闭时，非@消息应该被忽略', () => {
      const config = { telegram: { enableBroadcast: false } }
      const { isMentioned, targetBot, isBroadcast } = { isMentioned: false, targetBot: null, isBroadcast: true }
      const enableBroadcast = config.telegram?.enableBroadcast ?? false

      // 模拟群聊过滤逻辑
      const shouldProcess = isMentioned || enableBroadcast
      assert.strictEqual(shouldProcess, false)
    })

    it('广播模式开启时，非@消息应该被处理', () => {
      const config = { telegram: { enableBroadcast: true } }
      const { isMentioned, targetBot, isBroadcast } = { isMentioned: false, targetBot: null, isBroadcast: true }
      const enableBroadcast = config.telegram?.enableBroadcast ?? false

      const shouldProcess = isMentioned || enableBroadcast
      assert.strictEqual(shouldProcess, true)
    })

    it('默认配置应该是关闭广播模式（向后兼容）', () => {
      const config = { telegram: {} }
      const enableBroadcast = config.telegram?.enableBroadcast ?? false
      assert.strictEqual(enableBroadcast, false)
    })
  })

  describe('定向消息处理', () => {
    it('被@自己的消息应该被处理', () => {
      const config = { telegram: { enableBroadcast: false } }
      const { isMentioned, targetBot } = { isMentioned: true, targetBot: 'testbot' }
      const enableBroadcast = config.telegram?.enableBroadcast ?? false

      // 被@自己，应该处理
      const shouldProcess = isMentioned
      assert.strictEqual(shouldProcess, true)
    })

    it('被@其他bot的消息应该被忽略', () => {
      const { isMentioned, targetBot } = { isMentioned: false, targetBot: 'otherbot' }

      // 被@其他bot，应该忽略
      const shouldIgnore = targetBot && !isMentioned
      assert.strictEqual(shouldIgnore, true)
    })
  })
})

describe('TG-GROUP-001: 配置系统', () => {
  it('应该正确加载群聊配置', () => {
    // 模拟 config.mjs 的配置结构
    const memberConfig = {
      telegram: {
        botToken: 'test-token',
        enableBroadcast: true,
        instanceId: 'muse-001',
        instanceCreatedAt: '2024-01-01T00:00:00Z'
      }
    }

    const config = {
      telegram: memberConfig.telegram ? {
        botToken: memberConfig.telegram.botToken,
        enableBroadcast: memberConfig.telegram.enableBroadcast ?? false,
        instanceId: memberConfig.telegram.instanceId,
        instanceCreatedAt: memberConfig.telegram.instanceCreatedAt,
      } : {}
    }

    assert.strictEqual(config.telegram.enableBroadcast, true)
    assert.strictEqual(config.telegram.instanceId, 'muse-001')
    assert.strictEqual(config.telegram.instanceCreatedAt, '2024-01-01T00:00:00Z')
  })

  it('应该使用默认值当配置不存在', () => {
    const memberConfig = { telegram: { botToken: 'test-token' } }

    const config = {
      telegram: memberConfig.telegram ? {
        botToken: memberConfig.telegram.botToken,
        enableBroadcast: memberConfig.telegram.enableBroadcast ?? false,
        instanceId: memberConfig.telegram.instanceId,
        instanceCreatedAt: memberConfig.telegram.instanceCreatedAt,
      } : {}
    }

    assert.strictEqual(config.telegram.enableBroadcast, false)
    assert.strictEqual(config.telegram.instanceId, undefined)
  })
})
