/**
 * Muse Family Dashboard - Main Application
 * Handles member grid, polling, detail panel, and routing
 */

const API_BASE = ''
const POLL_INTERVAL = 5000

const state = {
  members: [],
  family: '',
  currentPage: 'overview',
  selectedMember: null,
  pollTimer: null,
  isLoading: false,
}

const elements = {}

function init() {
  cacheElements()
  bindEvents()
  loadMembers()
  startPolling()
  updatePageFromHash()
}

function cacheElements() {
  elements.sidebar = document.getElementById('sidebar')
  elements.mobileNav = document.getElementById('mobileNav')
  elements.menuToggle = document.getElementById('menuToggle')
  elements.overlay = document.getElementById('overlay')
  elements.pageTitle = document.getElementById('pageTitle')
  elements.onlineCount = document.getElementById('onlineCount')
  elements.familyName = document.getElementById('familyName')
  elements.lastUpdate = document.getElementById('lastUpdate')
  elements.skeletonGrid = document.getElementById('skeletonGrid')
  elements.memberGrid = document.getElementById('memberGrid')
  elements.emptyState = document.getElementById('emptyState')
  elements.detailPanel = document.getElementById('detailPanel')
  elements.closeDetail = document.getElementById('closeDetail')
  elements.detailContent = document.getElementById('detailContent')
  elements.toastContainer = document.getElementById('toastContainer')
  elements.navItems = document.querySelectorAll('.nav-item, .mobile-nav-item')
  elements.pages = document.querySelectorAll('.page')
}

function bindEvents() {
  elements.menuToggle?.addEventListener('click', toggleSidebar)
  elements.overlay?.addEventListener('click', closeAllPanels)
  elements.closeDetail?.addEventListener('click', closeDetailPanel)

  elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault()
      const page = item.dataset.page
      navigateTo(page)
    })
  })

  window.addEventListener('hashchange', updatePageFromHash)
  document.addEventListener('keydown', handleKeydown)
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    closeAllPanels()
  }
}

function toggleSidebar() {
  elements.sidebar.classList.toggle('open')
  elements.overlay.classList.toggle('show')
}

function closeAllPanels() {
  elements.sidebar.classList.remove('open')
  elements.overlay.classList.remove('show')
  closeDetailPanel()
}

function navigateTo(page) {
  state.currentPage = page
  window.location.hash = page

  elements.navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.page === page)
  })

  elements.pages.forEach(p => {
    p.classList.toggle('active', p.id === `page-${page}`)
  })

  const titles = {
    overview: '家族概览',
    chat: '对话',
    workflows: '工作流',
    memory: '记忆',
    settings: '配置',
  }
  elements.pageTitle.textContent = titles[page] || '家族概览'

  closeAllPanels()
}

function updatePageFromHash() {
  const hash = window.location.hash.slice(1) || 'overview'
  if (hash !== state.currentPage) {
    navigateTo(hash)
  }
}

async function loadMembers() {
  if (state.isLoading) return
  state.isLoading = true

  try {
    const response = await fetch(`${API_BASE}/api/family/members`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    state.family = data.family || 'Unknown'
    state.members = data.members || []

    updateFamilyInfo()
    updateOnlineCount()
    renderMembers()
    updateLastUpdate()
  } catch (error) {
    showToast('error', '加载失败', `无法获取成员列表: ${error.message}`)
    showEmptyState()
  } finally {
    state.isLoading = false
  }
}

function updateFamilyInfo() {
  if (elements.familyName) {
    elements.familyName.textContent = state.family
  }
}

function updateOnlineCount() {
  const onlineCount = state.members.filter(m => m.status === 'online').length
  if (elements.onlineCount) {
    elements.onlineCount.textContent = onlineCount
  }
}

function updateLastUpdate() {
  if (elements.lastUpdate) {
    const now = new Date()
    elements.lastUpdate.textContent = now.toLocaleTimeString('zh-CN')
  }
}

function renderMembers() {
  if (state.members.length === 0) {
    showEmptyState()
    return
  }

  hideSkeleton()
  elements.emptyState.style.display = 'none'
  elements.memberGrid.style.display = 'grid'

  const existingCards = elements.memberGrid.querySelectorAll('.member-card')
  existingCards.forEach(card => card.remove())

  state.members.forEach(member => {
    const card = createMemberCard(member)
    elements.memberGrid.appendChild(card)
  })
}

function createMemberCard(member) {
  const card = document.createElement('div')
  card.className = 'member-card'
  card.dataset.name = member.name

  const roleClass = getRoleClass(member.role)
  const statusClass = getStatusClass(member.status)
  const statusText = getStatusText(member.status)
  const avatarEmoji = getAvatarEmoji(member.role)

  card.innerHTML = `
    <div class="member-card-header">
      <div class="member-avatar">${avatarEmoji}</div>
      <div class="member-status ${statusClass}">
        <span class="status-dot"></span>
        <span>${statusText}</span>
      </div>
    </div>
    <div class="member-info">
      <div class="member-name">${escapeHtml(member.name)}</div>
      <div class="member-meta">
        <span class="role-tag ${roleClass}">${member.role}</span>
        ${member.port ? `<span class="member-port">:${member.port}</span>` : ''}
      </div>
      ${member.registeredAt ? `
        <div class="member-activity">
          启动于 ${formatTime(member.registeredAt)}
        </div>
      ` : ''}
    </div>
  `

  card.addEventListener('click', () => openDetailPanel(member))

  return card
}

function getRoleClass(role) {
  const roleMap = {
    planner: 'planner',
    pua: 'pua',
    coder: 'coder',
    arch: 'arch',
    nvwa: 'nvwa',
  }
  return roleMap[role] || 'default'
}

function getStatusClass(status) {
  const statusMap = {
    online: 'online',
    offline: 'offline',
    error: 'error',
  }
  return statusMap[status] || 'offline'
}

function getStatusText(status) {
  const textMap = {
    online: '在线',
    offline: '离线',
    error: '异常',
  }
  return textMap[status] || '离线'
}

function getAvatarEmoji(role) {
  const emojiMap = {
    planner: '📋',
    pua: '🎯',
    coder: '💻',
    arch: '🏗️',
    nvwa: '🎭',
  }
  return emojiMap[role] || '🤖'
}

function showSkeleton() {
  elements.skeletonGrid.style.display = 'grid'
  elements.memberGrid.style.display = 'none'
  elements.emptyState.style.display = 'none'
}

function hideSkeleton() {
  elements.skeletonGrid.style.display = 'none'
}

function showEmptyState() {
  hideSkeleton()
  elements.memberGrid.style.display = 'none'
  elements.emptyState.style.display = 'block'
}

async function openDetailPanel(member) {
  state.selectedMember = member

  const roleClass = getRoleClass(member.role)
  const statusClass = getStatusClass(member.status)
  const statusText = getStatusText(member.status)
  const avatarEmoji = getAvatarEmoji(member.role)

  // Render immediate data first, then fetch deep data
  elements.detailContent.innerHTML = `
    <div class="detail-section">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div class="member-avatar" style="width: 72px; height: 72px; font-size: 32px;">
          ${avatarEmoji}
        </div>
        <div>
          <div style="font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">
            ${escapeHtml(member.name)}
          </div>
          <div class="member-status ${statusClass}" style="display: inline-flex;">
            <span class="status-dot"></span>
            <span>${statusText}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="detail-section" id="detailIdentity">
      <div class="detail-section-title">身份信息</div>
      <div class="detail-item"><span class="detail-label">加载中...</span></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">基本信息</div>
      <div class="detail-item">
        <span class="detail-label">角色</span>
        <span class="detail-value">
          <span class="role-tag ${roleClass}">${member.role}</span>
        </span>
      </div>
      <div class="detail-item">
        <span class="detail-label">端口</span>
        <span class="detail-value">${member.port || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">PID</span>
        <span class="detail-value">${member.pid || 'N/A'}</span>
      </div>
    </div>

    <div class="detail-section" id="detailHealth">
      <div class="detail-section-title">健康状态</div>
      <div class="detail-item"><span class="detail-label">${member.status === 'online' ? '检查中...' : '离线'}</span></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">引擎信息</div>
      <div class="detail-item">
        <span class="detail-label">引擎地址</span>
        <span class="detail-value" style="font-size: 12px;">${member.engine || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">注册时间</span>
        <span class="detail-value">${member.registeredAt ? formatDateTime(member.registeredAt) : 'N/A'}</span>
      </div>
    </div>

    <div class="detail-actions">
      <button class="btn btn-primary" onclick="restartMember('${member.name}')">
        <span>🔄</span>
        <span>重启</span>
      </button>
      <button class="btn btn-secondary" onclick="closeDetailPanel()">
        <span>关闭</span>
      </button>
    </div>
  `

  elements.detailPanel.classList.add('open')
  elements.overlay.classList.add('show')

  // Fetch deep data in parallel
  fetchDetailData(member.name)
}

async function fetchDetailData(name) {
  // Fetch config (identity) + health in parallel
  const [configResult, healthResult] = await Promise.allSettled([
    fetch(`${API_BASE}/api/member/${encodeURIComponent(name)}/config`).then(r => r.ok ? r.json() : null),
    fetch(`${API_BASE}/api/member/${encodeURIComponent(name)}/health`).then(r => r.ok ? r.json() : null),
  ])

  // Bail if panel closed during fetch
  if (!state.selectedMember || state.selectedMember.name !== name) return

  // Render identity
  const identityEl = document.getElementById('detailIdentity')
  if (identityEl) {
    const cfg = configResult.status === 'fulfilled' ? configResult.value : null
    const identity = cfg?.identity
    if (identity) {
      identityEl.innerHTML = `
        <div class="detail-section-title">身份信息</div>
        <div class="detail-item">
          <span class="detail-label">名字</span>
          <span class="detail-value">${escapeHtml(identity.name || name)}</span>
        </div>
        ${identity.bio ? `<div class="detail-item">
          <span class="detail-label">简介</span>
          <span class="detail-value" style="font-size: 12px;">${escapeHtml(identity.bio)}</span>
        </div>` : ''}
        ${identity.mbti ? `<div class="detail-item">
          <span class="detail-label">MBTI</span>
          <span class="detail-value">${escapeHtml(identity.mbti)}</span>
        </div>` : ''}
      `
    } else {
      identityEl.innerHTML = `
        <div class="detail-section-title">身份信息</div>
        <div class="detail-item"><span class="detail-label" style="color: var(--text-muted);">未配置</span></div>
      `
    }
  }

  // Render health
  const healthEl = document.getElementById('detailHealth')
  if (healthEl) {
    const health = healthResult.status === 'fulfilled' ? healthResult.value : null
    if (health && health.ok) {
      const data = health.data || {}
      healthEl.innerHTML = `
        <div class="detail-section-title">健康状态</div>
        <div class="detail-item">
          <span class="detail-label">状态</span>
          <span class="detail-value" style="color: var(--status-online);">✅ 健康</span>
        </div>
        ${data.uptime ? `<div class="detail-item">
          <span class="detail-label">运行时长</span>
          <span class="detail-value">${formatUptime(data.uptime)}</span>
        </div>` : ''}
        ${data.sessions != null ? `<div class="detail-item">
          <span class="detail-label">会话数</span>
          <span class="detail-value">${data.sessions}</span>
        </div>` : ''}
      `
    } else if (health && health.status === 'offline') {
      healthEl.innerHTML = `
        <div class="detail-section-title">健康状态</div>
        <div class="detail-item">
          <span class="detail-label">状态</span>
          <span class="detail-value" style="color: var(--status-offline);">⚫ 离线</span>
        </div>
      `
    } else {
      healthEl.innerHTML = `
        <div class="detail-section-title">健康状态</div>
        <div class="detail-item">
          <span class="detail-label">状态</span>
          <span class="detail-value" style="color: var(--text-muted);">无法获取</span>
        </div>
      `
    }
  }
}

function formatUptime(seconds) {
  if (!seconds) return 'N/A'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function closeDetailPanel() {
  elements.detailPanel.classList.remove('open')
  if (!elements.sidebar.classList.contains('open')) {
    elements.overlay.classList.remove('show')
  }
  state.selectedMember = null
}

async function restartMember(name) {
  try {
    const response = await fetch(`${API_BASE}/api/member/${encodeURIComponent(name)}/restart`, {
      method: 'POST',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    showToast('success', '重启成功', `成员 ${name} 正在重启 (PID: ${data.newPid})`)
    closeDetailPanel()

    setTimeout(loadMembers, 2000)
  } catch (error) {
    showToast('error', '重启失败', error.message)
  }
}

function showToast(type, title, message) {
  const toast = document.createElement('div')
  toast.className = `toast ${type}`

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  }

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `

  elements.toastContainer.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateX(100%)'
    setTimeout(() => toast.remove(), 300)
  }, 5000)
}

function startPolling() {
  if (state.pollTimer) return
  state.pollTimer = setInterval(loadMembers, POLL_INTERVAL)
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer)
    state.pollTimer = null
  }
}

function escapeHtml(text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function formatTime(isoString) {
  if (!isoString) return 'N/A'
  const date = new Date(isoString)
  const now = new Date()
  const diff = now - date

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`

  return date.toLocaleDateString('zh-CN')
}

function formatDateTime(isoString) {
  if (!isoString) return 'N/A'
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN')
}

document.addEventListener('DOMContentLoaded', init)

window.addEventListener('beforeunload', stopPolling)

// ── Chat Module — Redesigned ──

const chatState = {
  selectedMember: null,
  selectedSession: null,
  sessions: [],
  messages: [],
  isLoading: false,
  pollTimer: null,
}

const chatEl = {} // element cache

function initChat() {
  cacheChatEl()
  bindChatEvents()
}

function cacheChatEl() {
  chatEl.contactList = document.getElementById('chatContactList')
  chatEl.welcome = document.getElementById('chatWelcome')
  chatEl.active = document.getElementById('chatActive')
  chatEl.convAvatar = document.getElementById('chatConvAvatar')
  chatEl.convName = document.getElementById('chatConvName')
  chatEl.convSessionName = document.getElementById('chatConvSessionName')
  chatEl.convStatus = document.getElementById('chatConvStatus')
  chatEl.newSessionBtn = document.getElementById('chatNewSessionBtn')
  chatEl.messages = document.getElementById('chatMessages')
  chatEl.scrollBottom = document.getElementById('chatScrollBottom')
  chatEl.input = document.getElementById('chatInput')
  chatEl.sendBtn = document.getElementById('chatSendBtn')
  chatEl.searchToggle = document.getElementById('chatSearchToggle')
  chatEl.searchBar = document.getElementById('chatSearchBar')
  chatEl.searchInput = document.getElementById('chatSearchInput')
}

function bindChatEvents() {
  chatEl.sendBtn?.addEventListener('click', sendChatMessage)
  chatEl.input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  })

  // Auto-expand textarea
  chatEl.input?.addEventListener('input', () => {
    const el = chatEl.input
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
    // Enable/disable send button
    chatEl.sendBtn.disabled = !el.value.trim()
  })

  chatEl.newSessionBtn?.addEventListener('click', createNewSession)

  // Scroll-to-bottom button
  chatEl.scrollBottom?.addEventListener('click', () => {
    chatEl.messages?.scrollTo({ top: chatEl.messages.scrollHeight, behavior: 'smooth' })
  })

  // Show/hide scroll button based on scroll position
  chatEl.messages?.addEventListener('scroll', () => {
    const el = chatEl.messages
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    if (chatEl.scrollBottom) {
      chatEl.scrollBottom.style.display = nearBottom ? 'none' : 'flex'
    }
  })

  // Search toggle
  chatEl.searchToggle?.addEventListener('click', () => {
    const isHidden = chatEl.searchBar.style.display === 'none'
    chatEl.searchBar.style.display = isHidden ? 'block' : 'none'
    if (isHidden) chatEl.searchInput?.focus()
  })
}

// ── Contact List ──

async function loadChatContacts() {
  if (!chatEl.contactList) return

  try {
    const res = await fetch('/api/family/members')
    const data = await res.json()
    const members = data.members || []

    // Sort: online first, then by name
    members.sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return -1
      if (a.status !== 'online' && b.status === 'online') return 1
      return a.name.localeCompare(b.name)
    })

    chatEl.contactList.innerHTML = members.map(m => {
      const isOnline = m.status === 'online'
      const emoji = getAvatarEmoji(m.role)
      return `
        <div class="chat-contact-item ${isOnline ? '' : 'offline-member'}"
             data-name="${escapeHtml(m.name)}" data-status="${m.status}">
          <div class="chat-contact-main">
            <div class="chat-contact-avatar">
              ${emoji}
              <span class="status-indicator ${isOnline ? 'online' : 'offline'}"></span>
            </div>
            <div class="chat-contact-info">
              <div class="chat-contact-name">${escapeHtml(m.name)}</div>
              <div class="chat-contact-role">${escapeHtml(m.role)}</div>
            </div>
            <div class="chat-contact-badge">
              <span class="chat-contact-expand">▼</span>
            </div>
          </div>
          <div class="chat-session-inline" data-member="${escapeHtml(m.name)}">
            <div class="chat-session-loading" style="font-size:12px;color:var(--text-muted);padding:4px 0;">加载会话…</div>
          </div>
        </div>
      `
    }).join('')

    // Bind click on contact main
    chatEl.contactList.querySelectorAll('.chat-contact-item').forEach(item => {
      const mainEl = item.querySelector('.chat-contact-main')
      mainEl?.addEventListener('click', () => selectChatContact(item.dataset.name))
    })
  } catch (e) {
    console.error('Failed to load chat contacts:', e)
    chatEl.contactList.innerHTML = '<div class="chat-contact-empty">加载失败</div>'
  }
}

async function selectChatContact(memberName) {
  if (!memberName) return

  const contactItems = chatEl.contactList?.querySelectorAll('.chat-contact-item')
  if (!contactItems) return

  // If same member clicked, toggle expand
  const clickedItem = chatEl.contactList.querySelector(`[data-name="${memberName}"]`)
  if (!clickedItem) return

  if (chatState.selectedMember === memberName) {
    clickedItem.classList.toggle('expanded')
    return
  }

  // Update selection
  contactItems.forEach(item => {
    item.classList.remove('active', 'expanded')
  })
  clickedItem.classList.add('active', 'expanded')
  chatState.selectedMember = memberName
  chatState.selectedSession = null
  chatState.messages = []

  // Check online
  if (clickedItem.dataset.status !== 'online') {
    showToast('warning', '离线', '该成员当前不在线')
    return
  }

  // Load sessions inline
  await loadInlineSessions(memberName)

  // Show conversation panel
  updateConversationHeader(memberName)
}

async function loadInlineSessions(memberName) {
  const inlineEl = chatEl.contactList?.querySelector(`.chat-session-inline[data-member="${memberName}"]`)
  if (!inlineEl) return

  try {
    const res = await fetch(`/api/member/${memberName}/oc/session`)
    const data = await res.json()
    chatState.sessions = Array.isArray(data) ? data : (data.sessions || [])

    let html = `<div class="chat-session-new-inline" data-action="new">＋ 新对话</div>`
    html += chatState.sessions.slice(0, 10).map(s => `
      <div class="chat-session-inline-item ${s.id === chatState.selectedSession ? 'active' : ''}"
           data-sid="${escapeHtml(s.id)}">
        <span class="session-icon">💬</span>
        ${escapeHtml(s.name || s.id.slice(0, 8))}
      </div>
    `).join('')

    inlineEl.innerHTML = html

    // Bind clicks
    inlineEl.querySelector('.chat-session-new-inline')?.addEventListener('click', (e) => {
      e.stopPropagation()
      createNewSession()
    })
    inlineEl.querySelectorAll('.chat-session-inline-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation()
        selectChatSession(item.dataset.sid)
      })
    })

    // Auto-select first session if none selected
    if (!chatState.selectedSession && chatState.sessions.length > 0) {
      selectChatSession(chatState.sessions[0].id)
    } else if (chatState.sessions.length === 0) {
      // No sessions — show welcome with prompt to create
      showChatActive(memberName, null)
    }
  } catch (e) {
    console.error('Failed to load sessions:', e)
    inlineEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:4px 0;">加载失败</div>'
  }
}

function updateConversationHeader(memberName) {
  if (chatEl.convAvatar) {
    const members = Array.from(chatEl.contactList?.querySelectorAll('.chat-contact-item') || [])
    const memberItem = members.find(el => el.dataset.name === memberName)
    const avatarEl = memberItem?.querySelector('.chat-contact-avatar')
    chatEl.convAvatar.textContent = avatarEl ? avatarEl.textContent.trim().charAt(0) || '🤖' : '🤖'
  }
  if (chatEl.convName) chatEl.convName.textContent = memberName
  if (chatEl.convStatus) {
    const item = chatEl.contactList?.querySelector(`[data-name="${memberName}"]`)
    const isOnline = item?.dataset.status === 'online'
    chatEl.convStatus.textContent = isOnline ? '● 在线' : '○ 离线'
    chatEl.convStatus.style.color = isOnline ? 'var(--status-online)' : 'var(--status-offline)'
  }
}

function showChatActive(memberName, sessionName) {
  if (chatEl.welcome) chatEl.welcome.style.display = 'none'
  if (chatEl.active) chatEl.active.style.display = 'flex'

  if (chatEl.convSessionName) {
    chatEl.convSessionName.textContent = sessionName || 'Session'
  }
}

// ── Session Management ──

async function createNewSession() {
  if (!chatState.selectedMember) return

  try {
    const res = await fetch(`/api/member/${chatState.selectedMember}/oc/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新对话' })
    })
    const data = await res.json()
    if (data.id) {
      await loadInlineSessions(chatState.selectedMember)
      await selectChatSession(data.id)
    }
  } catch (e) {
    console.error('Failed to create session:', e)
    showToast('error', '创建失败', '无法创建会话')
  }
}

async function selectChatSession(sessionId) {
  chatState.selectedSession = sessionId

  // Update inline session highlighting
  const inlineEl = chatEl.contactList?.querySelector(`.chat-session-inline[data-member="${chatState.selectedMember}"]`)
  inlineEl?.querySelectorAll('.chat-session-inline-item').forEach(item => {
    item.classList.toggle('active', item.dataset.sid === sessionId)
  })

  const session = chatState.sessions.find(s => s.id === sessionId)
  showChatActive(chatState.selectedMember, session?.name || sessionId.slice(0, 8))

  await loadChatMessages()
  startChatPolling()
}

// ── Messages ──

async function loadChatMessages() {
  if (!chatState.selectedMember || !chatState.selectedSession) return

  try {
    const res = await fetch(`/api/member/${chatState.selectedMember}/oc/session/${chatState.selectedSession}/message`)
    const data = await res.json()
    chatState.messages = Array.isArray(data) ? data : (data.messages || [])
    renderChatMessages()
  } catch (e) {
    console.error('Failed to load messages:', e)
  }
}

function renderChatMessages() {
  if (!chatEl.messages) return

  const memberName = chatState.selectedMember || 'AI'
  const emoji = getAvatarEmoji(getMemberRole(chatState.selectedMember))

  let html = ''
  let lastDate = ''

  for (const m of chatState.messages) {
    const isUser = m.role === 'user'
    const content = renderMarkdownFull(extractTextFromParts(m.parts))
    const time = formatMessageTime(m.createdAt)
    const dateStr = formatMessageDate(m.createdAt)

    // Insert time separator for new dates
    if (dateStr && dateStr !== lastDate) {
      html += `<div class="chat-time-separator"><span>${escapeHtml(dateStr)}</span></div>`
      lastDate = dateStr
    }

    html += `
      <div class="chat-msg ${isUser ? 'user' : 'assistant'}">
        <div class="chat-msg-avatar">${isUser ? '👤' : emoji}</div>
        <div class="chat-msg-body">
          <div class="chat-msg-bubble">${content}</div>
          <div class="chat-msg-time">${time}</div>
        </div>
      </div>
    `
  }

  chatEl.messages.innerHTML = html
  chatEl.messages.scrollTop = chatEl.messages.scrollHeight
}

function getMemberRole(memberName) {
  const item = chatEl.contactList?.querySelector(`[data-name="${memberName}"]`)
  return item?.querySelector('.chat-contact-role')?.textContent || 'default'
}

/**
 * Extract text content from OpenCode message parts array
 */
function extractTextFromParts(parts) {
  if (!parts || !Array.isArray(parts)) return ''
  return parts
    .filter(p => p.type === 'text')
    .map(p => p.text || '')
    .join('\n')
}

/**
 * Full markdown renderer — supports code blocks, headings, lists, blockquotes, bold, italic, inline code
 */
function renderMarkdownFull(text) {
  if (!text) return ''

  // Escape HTML first
  let html = escapeHtml(text)

  // Code blocks: ```lang\ncode\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`
  })

  // Headings: ### Heading
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // Blockquotes: > text
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')

  // Unordered lists: - item
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic: *text*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  // Line breaks
  html = html.replace(/\n/g, '<br>')

  return html
}

function formatMessageTime(ts) {
  if (!ts) return ''
  // OpenCode may use epoch seconds (number) or ISO string
  let date
  if (typeof ts === 'number') {
    date = new Date(ts < 1e12 ? ts * 1000 : ts)
  } else {
    date = new Date(ts)
  }
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatMessageDate(ts) {
  if (!ts) return ''
  let date
  if (typeof ts === 'number') {
    date = new Date(ts < 1e12 ? ts * 1000 : ts)
  } else {
    date = new Date(ts)
  }
  if (isNaN(date.getTime())) return ''
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return '今天'
  if (date.toDateString() === yesterday.toDateString()) return '昨天'
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

// ── Send Message ──

async function sendChatMessage() {
  if (!chatEl.input || chatState.isLoading) return

  const content = chatEl.input.value.trim()
  if (!content) return
  if (!chatState.selectedMember || !chatState.selectedSession) {
    showToast('warning', '未选择', '请先选择成员和会话')
    return
  }

  const memberItem = chatEl.contactList?.querySelector(`[data-name="${chatState.selectedMember}"]`)
  if (memberItem?.dataset.status !== 'online') {
    showToast('warning', '离线', '该成员当前不在线')
    return
  }

  chatState.isLoading = true
  chatEl.input.value = ''
  chatEl.input.style.height = 'auto'
  chatEl.input.disabled = true
  chatEl.sendBtn.disabled = true

  // Show thinking indicator
  const thinkingId = 'thinking-' + Date.now()
  const emoji = getAvatarEmoji(getMemberRole(chatState.selectedMember))
  const thinkingEl = document.createElement('div')
  thinkingEl.id = thinkingId
  thinkingEl.className = 'chat-msg assistant'
  thinkingEl.innerHTML = `
    <div class="chat-msg-avatar">${emoji}</div>
    <div class="chat-msg-body">
      <div class="chat-msg-bubble">
        <div class="chat-msg-thinking">
          <span class="thinking-dots"><span></span><span></span><span></span></span>
          正在思考…
        </div>
      </div>
    </div>
  `
  chatEl.messages.appendChild(thinkingEl)
  chatEl.messages.scrollTop = chatEl.messages.scrollHeight

  try {
    await fetch(`/api/member/${chatState.selectedMember}/oc/session/${chatState.selectedSession}/prompt_async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ type: 'text', text: content }] })
    })

    thinkingEl.remove()
    await pollForResponse()
  } catch (e) {
    console.error('Failed to send message:', e)
    thinkingEl.remove()
    showToast('error', '发送失败', '无法发送消息')
  } finally {
    chatState.isLoading = false
    chatEl.input.disabled = false
    chatEl.sendBtn.disabled = !chatEl.input.value.trim()
    chatEl.input.focus()
  }
}

async function pollForResponse() {
  let attempts = 0
  const maxAttempts = 90

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 1000))
    await loadChatMessages()

    const lastMsg = chatState.messages[chatState.messages.length - 1]
    if (lastMsg && lastMsg.role === 'assistant') {
      break
    }
    attempts++
  }
}

function startChatPolling() {
  stopChatPolling()
  chatState.pollTimer = setInterval(loadChatMessages, 3000)
}

function stopChatPolling() {
  if (chatState.pollTimer) {
    clearInterval(chatState.pollTimer)
    chatState.pollTimer = null
  }
}

// ── Initialize ──

document.addEventListener('DOMContentLoaded', () => {
  initChat()
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.target.id === 'page-chat' && m.target.classList.contains('active')) {
        loadChatContacts()
      }
    })
  })
  const chatPage = document.getElementById('page-chat')
  if (chatPage) observer.observe(chatPage, { attributes: true, attributeFilter: ['class'] })
})

