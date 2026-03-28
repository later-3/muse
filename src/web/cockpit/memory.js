/**
 * Muse Family Dashboard - Memory Panel
 * Shows semantic memories, episodic stats, and conversation history for each member
 */

const memoryState = {
  selectedMember: null,
  members: [],
  semantic: [],
  stats: null,
  recent: [],
}

const memEl = {}

function initMemory() {
  memEl.layout = document.getElementById('memoryLayout')
}

async function loadMemoryPage() {
  if (!memEl.layout) return

  // Load members first
  try {
    const res = await fetch('/api/family/members')
    const data = await res.json()
    memoryState.members = data.members || []
  } catch {
    memoryState.members = []
  }

  renderMemoryShell()

  // Auto-select first online member
  const firstOnline = memoryState.members.find(m => m.status === 'online')
  if (firstOnline) {
    await selectMemoryMember(firstOnline.name)
  } else if (memoryState.members.length > 0) {
    await selectMemoryMember(memoryState.members[0].name)
  }
}

function renderMemoryShell() {
  const memberOptions = memoryState.members.map(m =>
    `<option value="${escapeHtml(m.name)}" ${m.name === memoryState.selectedMember ? 'selected' : ''}>` +
    `${escapeHtml(m.name)} (${m.role})` +
    `</option>`
  ).join('')

  memEl.layout.innerHTML = `
    <div class="page-header">
      <h2>🧠 成员记忆</h2>
      <select class="memory-member-select" id="memoryMemberSelect">
        <option value="">选择成员…</option>
        ${memberOptions}
      </select>
    </div>

    <!-- Stats Row -->
    <div class="memory-stats-grid" id="memoryStats">
      ${renderStatCards(null)}
    </div>

    <!-- Two-column: Semantic + Timeline -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5);">
      <!-- Semantic Memory -->
      <div class="memory-section">
        <div class="memory-section-header">
          <div class="memory-section-title">📌 语义记忆 (Key-Value)</div>
          <span class="memory-stat-label" id="semanticCount">0 条</span>
        </div>
        <div class="memory-section-body" id="semanticBody">
          <div class="memory-empty">选择成员查看记忆数据</div>
        </div>
      </div>

      <!-- Recent Episodes -->
      <div class="memory-section">
        <div class="memory-section-header">
          <div class="memory-section-title">📝 最近对话 (7天)</div>
          <span class="memory-stat-label" id="recentCount">0 条</span>
        </div>
        <div class="memory-section-body" id="recentBody">
          <div class="memory-empty">选择成员查看对话历史</div>
        </div>
      </div>
    </div>
  `

  // Bind member selector
  const selector = document.getElementById('memoryMemberSelect')
  selector?.addEventListener('change', (e) => {
    if (e.target.value) selectMemoryMember(e.target.value)
  })
}

function renderStatCards(stats) {
  const s = stats?.episodic || {}
  const semCount = stats?.semanticCount || 0
  return `
    <div class="memory-stat-card">
      <div class="memory-stat-icon">💬</div>
      <div class="memory-stat-value">${s.totalSessions || 0}</div>
      <div class="memory-stat-label">会话总数</div>
    </div>
    <div class="memory-stat-card">
      <div class="memory-stat-icon">📨</div>
      <div class="memory-stat-value">${s.totalMessages || 0}</div>
      <div class="memory-stat-label">消息总数</div>
    </div>
    <div class="memory-stat-card">
      <div class="memory-stat-icon">🔤</div>
      <div class="memory-stat-value">${formatTokens(s.totalTokens)}</div>
      <div class="memory-stat-label">Token 消耗</div>
    </div>
    <div class="memory-stat-card">
      <div class="memory-stat-icon">📌</div>
      <div class="memory-stat-value">${semCount}</div>
      <div class="memory-stat-label">语义记忆</div>
    </div>
  `
}

function formatTokens(n) {
  if (!n || n === 0) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

async function selectMemoryMember(name) {
  memoryState.selectedMember = name

  // Update selector
  const selector = document.getElementById('memoryMemberSelect')
  if (selector) selector.value = name

  // Fetch all memory data in parallel
  const [semanticRes, statsRes, recentRes] = await Promise.allSettled([
    fetch(`/api/member/${name}/memory/semantic`).then(r => r.json()),
    fetch(`/api/member/${name}/memory/stats`).then(r => r.json()),
    fetch(`/api/member/${name}/memory/recent`).then(r => r.json()),
  ])

  const semanticData = semanticRes.status === 'fulfilled' ? semanticRes.value : {}
  const statsData = statsRes.status === 'fulfilled' ? statsRes.value : {}
  const recentData = recentRes.status === 'fulfilled' ? recentRes.value : {}

  // Update stats
  const statsGrid = document.getElementById('memoryStats')
  if (statsGrid) statsGrid.innerHTML = renderStatCards(statsData)

  // Render semantic memories
  renderSemanticMemories(semanticData.memories || [])

  // Render recent episodes
  renderRecentEpisodes(recentData.episodes || [])
}

function renderSemanticMemories(memories) {
  const body = document.getElementById('semanticBody')
  const countEl = document.getElementById('semanticCount')
  if (countEl) countEl.textContent = `${memories.length} 条`

  if (!body) return
  if (memories.length === 0) {
    body.innerHTML = '<div class="memory-empty">暂无语义记忆</div>'
    return
  }

  // Group by category
  const groups = {}
  for (const m of memories) {
    const cat = m.category || 'general'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(m)
  }

  let html = ''
  for (const [cat, items] of Object.entries(groups)) {
    html += `<div style="margin-bottom:var(--space-3);"><span class="memory-category-badge">${escapeHtml(cat)}</span></div>`
    for (const item of items) {
      html += `
        <div class="memory-kv-item">
          <div class="memory-kv-key">${escapeHtml(item.key)}</div>
          <div class="memory-kv-value">${escapeHtml(item.value)}</div>
          <div class="memory-kv-meta">
            <span title="来源">${escapeHtml(item.source || '')}</span>
          </div>
        </div>
      `
    }
  }
  body.innerHTML = html
}

function renderRecentEpisodes(episodes) {
  const body = document.getElementById('recentBody')
  const countEl = document.getElementById('recentCount')
  if (countEl) countEl.textContent = `${episodes.length} 条`

  if (!body) return
  if (episodes.length === 0) {
    body.innerHTML = '<div class="memory-empty">最近 7 天无对话记录</div>'
    return
  }

  let html = ''
  let lastDate = ''

  for (const ep of episodes) {
    const dateStr = ep.created_at ? new Date(ep.created_at).toLocaleDateString('zh-CN') : ''
    if (dateStr && dateStr !== lastDate) {
      html += `<div style="font-size:12px;font-weight:600;color:var(--text-muted);padding:var(--space-2) 0;margin-top:var(--space-2);border-top:1px solid rgba(0,0,0,0.06);">${escapeHtml(dateStr)}</div>`
      lastDate = dateStr
    }

    const isUser = ep.role === 'user'
    const preview = (ep.summary || ep.content || '').slice(0, 120)

    html += `
      <div class="memory-timeline-item">
        <div class="memory-timeline-header">
          <span class="memory-timeline-role ${isUser ? 'user' : 'assistant'}">${isUser ? '用户' : 'AI'}</span>
          <span class="memory-timeline-time">${ep.created_at ? new Date(ep.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
        <div class="memory-timeline-content">${escapeHtml(preview)}</div>
      </div>
    `
  }

  body.innerHTML = html
}

// ── Initialize ──

document.addEventListener('DOMContentLoaded', () => {
  initMemory()

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.target.id === 'page-memory' && m.target.classList.contains('active')) {
        loadMemoryPage()
      }
    })
  })
  const memoryPage = document.getElementById('page-memory')
  if (memoryPage) observer.observe(memoryPage, { attributes: true, attributeFilter: ['class'] })
})
