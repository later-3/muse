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
