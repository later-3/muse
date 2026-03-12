/**
 * T11: Memory MCP Server
 *
 * MCP stdio server exposing Muse's Memory as 5 tools:
 *   search_memory, set_memory, get_user_profile, get_recent_episodes, add_episode
 *
 * Usage: opencode.json → mcp.memory-server → node muse/mcp/memory.mjs
 * Env:   MEMORY_DB_PATH (default: ./muse/data/memory.db)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { Memory } from '../core/memory.mjs'

// --- Config ---

const DB_PATH = process.env.MEMORY_DB_PATH || './muse/data/memory.db'
const AGENT_ID = process.env.AGENT_ID || 'muse'

// --- Tool Definitions ---

const TOOLS = [
  {
    name: 'search_memory',
    description: '搜索用户相关的记忆。当需要回忆用户偏好、习惯、个人信息、目标或历史事件时调用。\nscope 缩小范围: identity(身份), preference(偏好), goal(目标), general(其他)。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        type: { type: 'string', enum: ['semantic', 'episodic', 'all'], default: 'all', description: '搜索范围' },
        scope: { type: 'string', enum: ['identity', 'preference', 'goal', 'general', 'all'], default: 'all', description: '语义分类过滤' },
        limit: { type: 'number', default: 10, description: '返回数量上限' },
      },
      required: ['query'],
    },
  },
  {
    name: 'set_memory',
    description: '存储用户的新信息。当用户明确告知偏好/习惯/个人信息时主动调用。\nsource: user_stated(用户说的,高置信), ai_inferred(AI推断,中置信), ai_observed(行为观察,需验证)。\n注意: ai_inferred 不能覆盖 user_stated，ai_observed 只能追加低置信值。',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: '记忆标识 (如 user_name, fav_language)' },
        value: { type: 'string', description: '记忆内容' },
        category: { type: 'string', enum: ['identity', 'preference', 'goal', 'general'], default: 'general', description: '分类' },
        source: { type: 'string', enum: ['user_stated', 'ai_inferred', 'ai_observed'], default: 'user_stated', description: '来源' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'], default: 'high', description: '置信度' },
        tags: { type: 'array', items: { type: 'string' }, default: [], description: '标签' },
        meta: { type: 'object', default: {}, description: '扩展元数据 (预留 goal/thread/artifact)' },
        writer: { type: 'string', enum: ['main_session', 'hook', 'subagent', 'background', 'family_agent'], default: 'main_session', description: '写入者' },
        session_id: { type: 'string', description: '关联的 session ID' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'get_user_profile',
    description: '获取用户的完整画像，按层次结构组织。在对话开始或需要全面了解用户时调用。返回结构化视图: identity(身份), preferences(偏好), goals(目标), current_focus(近期关注)。',
    inputSchema: {
      type: 'object',
      properties: {
        sections: { type: 'array', items: { type: 'string' }, description: '指定返回的部分 (identity/preferences/goals/current_focus)' },
      },
    },
  },
  {
    name: 'get_recent_episodes',
    description: '获取最近的对话摘要。在需要回顾历史对话、了解之前聊过什么时调用。scope 可按 meta.related_goal 过滤。',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', default: 3, description: '最近几天 (默认 3)' },
        scope: { type: 'string', description: '过滤条件: goal key 或 thread id (匹配 meta.related_goal / meta.related_thread)' },
      },
    },
  },
  {
    name: 'add_episode',
    description: '记录本次对话的关键信息。每次有意义的对话结束时调用。通过 meta 关联到长期目标或生活线索。',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '摘要内容' },
        tags: { type: 'array', items: { type: 'string' }, default: [], description: '标签' },
        meta: { type: 'object', default: {}, description: '扩展: { related_goal, related_thread, artifact_refs }' },
        session_id: { type: 'string', description: '关联的 session ID (不传则自动生成)' },
        writer: { type: 'string', enum: ['main_session', 'hook', 'subagent', 'background', 'family_agent'], default: 'main_session', description: '写入者' },
      },
      required: ['summary'],
    },
  },
]

// --- Tool Handlers ---

function handleSearchMemory(memory, args) {
  const { query, type = 'all', scope = 'all', limit = 10 } = args

  const results = { semantic: [], episodic: [] }

  // Semantic search
  if (type === 'semantic' || type === 'all') {
    let hits = memory.searchMemories(query)
    if (scope !== 'all') {
      hits = hits.filter(h => h.category === scope)
    }
    results.semantic = hits.slice(0, limit).map(h => ({
      key: h.key,
      value: h.value,
      category: h.category,
      source: h.source,
      confidence: h.confidence || 'medium',
      tags: safeParseJson(h.tags, []),
      updated_at: h.updated_at,
    }))
  }

  // Episodic search
  if (type === 'episodic' || type === 'all') {
    const hits = memory.searchEpisodes(query, limit)
    results.episodic = hits.map(h => ({
      id: h.id,
      role: h.role,
      content: h.content?.slice(0, 200),
      summary: h.summary,
      created_at: h.created_at,
    }))
  }

  const total = results.semantic.length + results.episodic.length
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ total, ...results }, null, 2),
    }],
  }
}

function handleSetMemory(memory, args) {
  const { key, value, category, source, confidence, tags, meta, writer, session_id } = args

  if (!key || !value) {
    return errorResult('key and value are required')
  }

  const result = memory.setMemory(key, value, {
    category: category || 'general',
    source: source || 'user_stated',
    confidence: confidence || 'high',
    tags: tags || [],
    meta: meta || {},
    writer: writer || 'main_session',
    session_id: session_id || null,
  })

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  }
}

function handleGetUserProfile(memory, args) {
  const sections = args.sections || ['identity', 'preferences', 'goals', 'current_focus']
  const all = memory.listMemories()

  const profile = {
    identity: {},
    preferences: {},
    goals: [],
    current_focus: [],
    important_threads: [], // Phase 2: always empty, Phase 3 fills
  }

  // Build from semantic memories
  for (const m of all) {
    const entry = {
      value: m.value,
      source: m.source,
      confidence: m.confidence || 'medium',
      updated_at: m.updated_at,
    }

    // Aggregation: confidence=low doesn't enter identity/preferences
    const isLowConfidence = (m.confidence || 'medium') === 'low'

    if (m.category === 'identity' && !isLowConfidence) {
      if (sections.includes('identity')) {
        // Conflict: user_stated > ai_inferred > ai_observed
        const existing = profile.identity[m.key]
        if (!existing || sourcePriority(m.source) >= sourcePriority(existing.source)) {
          profile.identity[m.key] = entry
        }
      }
    } else if (m.category === 'preference' && !isLowConfidence) {
      if (sections.includes('preferences')) {
        const existing = profile.preferences[m.key]
        if (!existing || sourcePriority(m.source) >= sourcePriority(existing.source)) {
          profile.preferences[m.key] = entry
        }
      }
    } else if (m.category === 'goal') {
      if (sections.includes('goals')) {
        profile.goals.push({ key: m.key, value: m.value, source: m.source, updated_at: m.updated_at })
      }
    }
  }

  // current_focus: recent 7-day high-frequency tags
  if (sections.includes('current_focus')) {
    try {
      const recent = memory.getRecentEpisodes(7)
      const tagCount = {}
      for (const ep of recent) {
        const tags = safeParseJson(ep.tags, [])
        for (const t of tags) {
          tagCount[t] = (tagCount[t] || 0) + 1
        }
      }
      profile.current_focus = Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }))
    } catch {
      // If episodes unavailable, empty focus
    }
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(profile, null, 2),
    }],
  }
}

function handleGetRecentEpisodes(memory, args) {
  const days = args.days || 3
  const scope = args.scope || null
  let episodes = memory.getRecentEpisodes(days)

  // scope filter: match meta.related_goal or meta.related_thread
  if (scope) {
    episodes = episodes.filter(ep => {
      const meta = safeParseJson(ep.meta, {})
      return meta.related_goal === scope || meta.related_thread === scope
    })
  }

  const formatted = episodes.map(ep => ({
    id: ep.id,
    session_id: ep.session_id,
    role: ep.role,
    summary: ep.summary,
    content_preview: ep.content?.slice(0, 150),
    tags: safeParseJson(ep.tags, []),
    meta: safeParseJson(ep.meta, {}),
    writer: ep.writer || 'main_session',
    created_at: ep.created_at,
  }))

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ count: formatted.length, episodes: formatted }, null, 2),
    }],
  }
}

function handleAddEpisode(memory, args) {
  const { summary, tags, meta, session_id, writer } = args

  if (!summary) {
    return errorResult('summary is required')
  }

  const sessionId = session_id || `mcp-${Date.now()}`
  const actualWriter = writer || 'main_session'
  const id = memory.addEpisode(sessionId, 'assistant', summary, {
    summary,
    tags: tags || [],
    meta: meta || {},
    writer: actualWriter,
  })

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ episode_id: Number(id) }, null, 2),
    }],
  }
}

// --- Helpers ---

function sourcePriority(source) {
  const map = { user_stated: 3, ai_inferred: 2, ai_observed: 1, auto: 2 }
  return map[source] || 0
}

function safeParseJson(str, fallback) {
  if (!str) return fallback
  try { return JSON.parse(str) } catch { return fallback }
}

function errorResult(message) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  }
}

// --- Main ---

async function main() {
  // Init Memory
  const config = { memory: { dbPath: DB_PATH, maxEpisodicDays: 7 } }
  const memory = new Memory(config, AGENT_ID)
  await memory.start()

  // Init MCP Server
  const server = new Server(
    { name: 'muse-memory', version: '0.2.0' },
    { capabilities: { tools: {} } },
  )

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }))

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        case 'search_memory':
          return handleSearchMemory(memory, args || {})
        case 'set_memory':
          return handleSetMemory(memory, args || {})
        case 'get_user_profile':
          return handleGetUserProfile(memory, args || {})
        case 'get_recent_episodes':
          return handleGetRecentEpisodes(memory, args || {})
        case 'add_episode':
          return handleAddEpisode(memory, args || {})
        default:
          return errorResult(`Unknown tool: ${name}`)
      }
    } catch (e) {
      return errorResult(`Tool error: ${e.message}`)
    }
  })

  // Start stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await memory.stop()
    await server.close()
    process.exit(0)
  })
}

// Only start server when run directly, not when imported for testing
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''))
if (isMain) {
  main().catch(e => {
    console.error('Memory MCP Server failed:', e)
    process.exit(1)
  })
}

export { TOOLS, handleSearchMemory, handleSetMemory, handleGetUserProfile, handleGetRecentEpisodes, handleAddEpisode, sourcePriority, safeParseJson }
