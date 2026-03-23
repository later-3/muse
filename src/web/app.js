// ===== Muse Web Cockpit — app.js =====
// T20: Web 驾驶舱重组 (Phase 3A)

// ===== API Client =====
async function safeFetch(path, fallback = null) {
  try {
    const res = await fetch(path)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    return json.ok ? json.data : fallback
  } catch {
    return fallback
  }
}

const API = {
  async get(path) { const res = await fetch(path); return res.json() },
  async post(path, body) {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res.json()
  },
  async put(path, body) {
    const res = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res.json()
  },
}

// ===== Utils =====
const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => document.querySelectorAll(sel)
let connected = false

function toast(msg) {
  const el = $('#toast')
  el.textContent = msg
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2500)
}

function formatUptime(secs) {
  if (secs < 60) return `${secs}秒`
  if (secs < 3600) return `${Math.floor(secs / 60)}分${secs % 60}秒`
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}小时${m}分`
}

function esc(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sysLog(msg) {
  const el = $('#sys-log')
  if (!el) return
  const time = new Date().toLocaleTimeString()
  const prefix = el.textContent ? '\n' : ''
  el.textContent += `${prefix}[${time}] ${msg}`
  el.scrollTop = el.scrollHeight
}

function setConnectionStatus(ok) {
  connected = ok
  $('#header-subtitle').textContent = ok
    ? '✅ 小缪在线'
    : '❌ 小缪还在睡觉...'
}

// ===== Dev Mode =====
function isDevMode() {
  const url = new URL(location.href)
  if (url.searchParams.get('dev') === '1') {
    localStorage.setItem('muse_dev', '1')
    return true
  }
  return localStorage.getItem('muse_dev') === '1'
}

if (isDevMode()) {
  $$('.dev-only').forEach(el => el.style.display = '')
}

// ===== Tab Navigation =====
$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.remove('active'))
    $$('.page').forEach(p => p.classList.remove('active'))
    tab.classList.add('active')
    $(`#page-${tab.dataset.tab}`).classList.add('active')

    const name = tab.dataset.tab
    if (name === 'home') loadHome()
    if (name === 'chat') loadChatHistory()
    if (name === 'mind') loadMindSection()
    if (name === 'dev') loadDev()
  })
})

// ===== Mind Sub-Tab Navigation =====
$$('#mind-tabs .pill').forEach(pill => {
  pill.addEventListener('click', () => {
    $$('#mind-tabs .pill').forEach(p => p.classList.remove('active'))
    pill.classList.add('active')
    $$('.mind-section').forEach(s => s.classList.remove('active'))
    $(`#mind-${pill.dataset.section}`).classList.add('active')
    loadMindSection(pill.dataset.section)
  })
})

function loadMindSection(section) {
  if (!section) section = $('#mind-tabs .pill.active')?.dataset?.section || 'identity'
  if (section === 'identity') loadIdentity()
  if (section === 'memories') loadMemory()
  if (section === 'capabilities') loadCapabilities()
  if (section === 'gaps') loadGaps()
}

// ===== HOME PAGE =====
async function loadHome() {
  await Promise.all([loadSelfCheck(), loadGrowth(), loadStats()])
}

async function loadSelfCheck() {
  const container = $('#check-layers')
  container.innerHTML = '<div class="loading"><div class="spinner"></div>正在体检...</div>'

  const data = await safeFetch('/api/selfcheck')
  if (!data) {
    setConnectionStatus(false)
    container.innerHTML = '<div class="empty"><div class="empty-icon">😴</div>小缪还在睡觉，连不上后端...</div>'
    return
  }

  setConnectionStatus(true)

  const layers = [
    { key: 'system', title: '🔧 系统', icon: data.overall },
    { key: 'selfModel', title: '🧠 自知', icon: null },
    { key: 'life', title: '💓 生命力', icon: null },
  ]

  container.innerHTML = layers.map(layer => {
    const section = data[layer.key]
    if (!section || section._note) {
      return `<div class="check-layer">
        <div class="check-layer-head"><span class="check-layer-title">${layer.title}</span><span>⏳</span></div>
        <div class="check-layer-items" style="color:var(--text-muted)">待 Phase 3B 上线</div>
      </div>`
    }

    const items = Object.entries(section).map(([k, v]) => {
      if (typeof v !== 'object' || !v?.status) return ''
      const label = k.replace(/([A-Z])/g, ' $1').trim()
      return `<div>${v.status} ${label}: ${v.detail || ''}</div>`
    }).filter(Boolean).join('')

    return `<div class="check-layer">
      <div class="check-layer-head"><span class="check-layer-title">${layer.title}</span></div>
      <div class="check-layer-items">${items || '<span style="color:var(--text-muted)">无数据</span>'}</div>
    </div>`
  }).join('')
}

async function loadGrowth() {
  const grid = $('#growth-grid')
  const [caps, gapsData] = await Promise.all([
    safeFetch('/api/capabilities'),
    safeFetch('/api/gaps'),
  ])

  const capCount = caps?.length ?? 0
  const gaps = gapsData?.entries ?? []
  const aware = gaps.filter(g => g.reason === 'unsupported')
  const needsHelp = gaps.filter(g => g.reason === 'missing_capability' || g.reason === 'route_unavailable')

  grid.innerHTML = `
    <div class="growth-card" style="border-left: 3px solid var(--green)">
      <div class="label">✅ 已会</div>
      <div class="value">${capCount}</div>
      <div class="hint">已注册的能力和感知</div>
    </div>
    <div class="growth-card" style="border-left: 3px solid var(--purple)">
      <div class="label">📚 在学</div>
      <div class="value">—</div>
      <div class="hint">Phase 3B 上线后展示</div>
    </div>
    <div class="growth-card" style="border-left: 3px solid var(--yellow)">
      <div class="label">💡 不会但已意识到</div>
      <div class="value">${aware.length}</div>
      <div class="hint">${aware.length > 0 ? aware.map(g => g.type).join(', ') : '暂无'}</div>
    </div>
    <div class="growth-card" style="border-left: 3px solid var(--red)">
      <div class="label">🆘 需要帮助</div>
      <div class="value">${needsHelp.length}</div>
      <div class="hint">${needsHelp.length > 0 ? needsHelp.map(g => g.type).join(', ') : '暂无'}</div>
    </div>`
}

async function loadStats() {
  const grid = $('#stats-grid')
  const status = await safeFetch('/api/status')
  if (!status) {
    grid.innerHTML = '<div class="empty">无法加载统计数据</div>'
    return
  }
  grid.innerHTML = `
    <div class="status-item">
      <div class="label">⏱ 运行时间</div>
      <div class="value" style="font-size:1.2rem">${formatUptime(status.uptime || 0)}</div>
    </div>
    <div class="status-item">
      <div class="label">💬 对话数</div>
      <div class="value">${status.memory?.totalEpisodes ?? '—'}</div>
    </div>
    <div class="status-item">
      <div class="label">📂 会话数</div>
      <div class="value">${status.memory?.totalSessions ?? '—'}</div>
    </div>`
}

// ===== CHAT PAGE =====
const chatMessages = $('#chat-messages')
const chatInput = $('#chat-input')
const chatSend = $('#chat-send')
let chatHistoryLoaded = false

function addMessage(role, text) {
  const el = document.createElement('div')
  el.className = `msg ${role}`
  el.textContent = text
  chatMessages.appendChild(el)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

async function loadChatHistory() {
  if (chatHistoryLoaded) return
  const data = await safeFetch('/api/chat/history?n=20')
  if (data && data.length > 0) {
    // Clear the initial greeting
    chatMessages.innerHTML = ''
    for (const ep of data) {
      addMessage(ep.role === 'user' ? 'user' : 'assistant', ep.content?.slice(0, 500) || '')
    }
    chatHistoryLoaded = true
  }
}

async function sendChat() {
  const text = chatInput.value.trim()
  if (!text) return
  chatInput.value = ''
  addMessage('user', text)
  chatSend.disabled = true
  chatSend.textContent = '...'
  try {
    const res = await API.post('/api/chat', { text })
    if (res.ok) {
      addMessage('assistant', res.data.text || '(无回复)')
    } else {
      addMessage('assistant', '❌ ' + (res.error || '发送失败'))
    }
  } catch (e) {
    addMessage('assistant', '❌ 网络错误: ' + e.message)
  } finally {
    chatSend.disabled = false
    chatSend.textContent = '发送'
  }
}

chatSend.addEventListener('click', sendChat)
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() }
})

// ===== MIND PAGE — Identity =====
const TRAIT_DIMS = [
  { key: 'humor', label: '幽默感', min: '严肃正式', max: '幽默风趣' },
  { key: 'warmth', label: '温暖度', min: '理性客观', max: '温暖贴心' },
  { key: 'initiative', label: '主动性', min: '被动等待', max: '主动积极' },
  { key: 'precision', label: '严谨度', min: '大而化之', max: '严谨细致' },
  { key: 'verbosity', label: '话多程度', min: '言简意赅', max: '话比较多' },
]
let identityData = null

async function loadIdentity() {
  try {
    const res = await API.get('/api/identity')
    if (!res.ok) return
    identityData = res.data
    renderIdentity()
  } catch (e) { toast('加载身份失败: ' + e.message) }
}

function renderIdentity() {
  if (!identityData) return
  $('#id-name').value = identityData.identity?.name || ''
  $('#id-nickname').value = identityData.identity?.nickname || ''
  $('#id-mbti').value = identityData.psychology?.mbti || ''
  $('#id-bio').value = identityData.identity?.bio || ''

  const container = $('#personality-sliders')
  const traits = identityData.psychology?.traits || {}
  container.innerHTML = TRAIT_DIMS.map(dim => {
    const raw = traits[dim.key] ?? 0.5
    const pct = Math.round(raw * 100)
    return `
      <div class="slider-group">
        <div class="slider-header">
          <span class="slider-label">${dim.label}</span>
          <span class="slider-value" id="val-${dim.key}">${pct}%</span>
        </div>
        <input type="range" min="0" max="100" value="${pct}"
               data-key="${dim.key}"
               oninput="document.getElementById('val-${dim.key}').textContent=this.value+'%'; updateJsonPreview()">
        <div class="slider-ends"><span>${dim.min}</span><span>${dim.max}</span></div>
      </div>`
  }).join('')
  updateJsonPreview()
}

function getIdentityPatch() {
  const traits = {}
  $$('#personality-sliders input[type="range"]').forEach(s => {
    traits[s.dataset.key] = parseInt(s.value, 10) / 100
  })
  return {
    identity: { name: $('#id-name').value, nickname: $('#id-nickname').value, bio: $('#id-bio').value },
    psychology: { mbti: $('#id-mbti').value, traits },
  }
}

window.updateJsonPreview = function () {
  const patch = getIdentityPatch()
  $('#json-preview').textContent = JSON.stringify(patch, null, 2)
}

$('#id-save').addEventListener('click', async () => {
  try {
    const patch = getIdentityPatch()
    const res = await API.put('/api/identity', patch)
    if (res.ok) { identityData = res.data; renderIdentity(); toast('✅ 身份已保存!') }
    else { toast('❌ 保存失败: ' + res.error) }
  } catch (e) { toast('❌ 保存失败: ' + e.message) }
})
$('#id-reload').addEventListener('click', loadIdentity)
;['id-name', 'id-nickname', 'id-mbti', 'id-bio'].forEach(id => {
  $(`#${id}`).addEventListener('input', updateJsonPreview)
})

// ===== MIND PAGE — Memory =====
let memoryType = 'episodic'

$$('#memory-tabs .pill').forEach(pill => {
  pill.addEventListener('click', () => {
    $$('#memory-tabs .pill').forEach(p => p.classList.remove('active'))
    pill.classList.add('active')
    memoryType = pill.dataset.type
    loadMemory()
  })
})
$('#memory-search-btn').addEventListener('click', loadMemory)
$('#memory-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadMemory() })

async function loadMemory() {
  const q = $('#memory-search').value.trim()
  const list = $('#memory-list')
  list.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>'
  try {
    const path = memoryType === 'semantic'
      ? `/api/memory/semantic${q ? `?q=${encodeURIComponent(q)}` : ''}`
      : `/api/memory/episodic${q ? `?q=${encodeURIComponent(q)}` : '?days=7'}`
    const res = await API.get(path)
    if (!res.ok || !res.data?.length) {
      list.innerHTML = '<div class="empty"><div class="empty-icon">💭</div>暂无记忆</div>'
      return
    }
    if (memoryType === 'semantic') {
      list.innerHTML = res.data.map(m => `
        <div class="memory-item">
          <div class="memory-key">${esc(m.key)}</div>
          <div class="memory-value">${esc(m.value)}</div>
          <div class="memory-meta">${m.category || ''} · ${m.updated_at || ''}</div>
        </div>`).join('')
    } else {
      list.innerHTML = res.data.map(m => `
        <div class="memory-item">
          <div class="memory-key">${m.role === 'user' ? '👤' : '🎭'} ${esc(m.role)}</div>
          <div class="memory-value">${esc(m.content?.slice(0, 200) || '')}</div>
          <div class="memory-meta">${m.created_at || ''}</div>
        </div>`).join('')
    }
  } catch (e) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">❌</div>${esc(e.message)}</div>`
  }
}

// ===== MIND PAGE — Capabilities =====
async function loadCapabilities() {
  const container = $('#cap-list')
  const data = await safeFetch('/api/capabilities')
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">💪</div>暂无已注册能力</div>'
    return
  }
  container.innerHTML = data.map(cap => `
    <div class="cap-item">
      <div class="memory-key">${esc(cap.name || cap.id)}</div>
      <div class="memory-value">${esc(cap.description || '')}</div>
      <div class="memory-meta">类型: ${cap.type || '—'}</div>
    </div>`).join('')
}

// ===== MIND PAGE — Gaps =====
async function loadGaps() {
  const container = $('#gap-list')
  const data = await safeFetch('/api/gaps')
  const entries = data?.entries ?? []
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div>暂无已知缺口</div>'
    return
  }
  container.innerHTML = entries.map(g => `
    <div class="gap-item">
      <div class="memory-key">${g.reason === 'unsupported' ? '💡' : '🆘'} ${esc(g.type)}</div>
      <div class="memory-value">原因: ${esc(g.reason)} · 来源: ${esc(g.source)}</div>
      <div class="memory-meta">${g.detail ? esc(g.detail) : ''} · ${g.timestamp || ''}</div>
    </div>`).join('')
}

// ===== DEV PAGE =====
async function loadDev() {
  // selfCheck raw JSON
  const selfcheck = await safeFetch('/api/selfcheck')
  $('#dev-selfcheck').textContent = selfcheck ? JSON.stringify(selfcheck, null, 2) : '无法加载'

  // Executions
  const execData = await safeFetch('/api/executions')
  const execContainer = $('#dev-executions')
  const entries = execData?.entries ?? []
  if (entries.length === 0) {
    execContainer.innerHTML = '<div class="empty"><div class="empty-icon">📋</div>暂无执行记录</div>'
  } else {
    execContainer.innerHTML = entries.slice(0, 50).map(e => `
      <div class="exec-item">
        <span class="exec-route">${esc(e.route)}</span>
        <span> · ${e.success ? '✅' : '❌'} · ${e.duration ?? '?'}ms</span>
        <div class="exec-time">${e.timestamp || ''}</div>
      </div>`).join('')
  }

  // System status
  try {
    const res = await API.get('/api/health')
    if (!res.ok) return
    const eng = res.data.engine || {}
    const web = res.data.web || {}
    $('#brain-status').innerHTML = `
      <div class="sys-row"><span>状态</span><span>${eng.ok ? '🟢 在线' : '🔴 离线'}</span></div>
      <div class="sys-row"><span>详情</span><span>${eng.detail ? JSON.stringify(eng.detail) : '—'}</span></div>`
    $('#web-status').innerHTML = `
      <div class="sys-row"><span>状态</span><span>${web.ok ? '🟢 在线' : '🔴 离线'}</span></div>
      <div class="sys-row"><span>端口</span><span>${web.detail?.port ?? '—'}</span></div>
      <div class="sys-row"><span>运行时间</span><span>${formatUptime(web.detail?.uptime ?? 0)}</span></div>`
  } catch (e) { sysLog('加载失败: ' + e.message) }
}

// Dev controls
$('#sys-test')?.addEventListener('click', async () => {
  sysLog('正在测试连接...')
  try {
    const res = await API.post('/api/system/test')
    sysLog(res.ok ? '✅ 连接正常' : '❌ ' + res.error)
    toast(res.ok ? '连接正常 ✅' : '连接失败 ❌')
  } catch (e) { sysLog('❌ ' + e.message) }
})

$('#sys-restart')?.addEventListener('click', async () => {
  if (!confirm('确定要重启大脑吗？')) return
  sysLog('正在重启大脑...')
  try {
    const res = await API.post('/api/system/restart-brain')
    sysLog(res.ok ? '✅ 大脑已重启' : '❌ ' + res.error)
    toast(res.ok ? '大脑已重启 ✅' : '重启失败 ❌')
    loadDev()
  } catch (e) { sysLog('❌ ' + e.message) }
})

// ===== Init =====
;(async () => {
  await loadHome()
  if (connected && isDevMode()) {
    sysLog('✅ 后端已连接 (Dev Mode)')
  }
})()
