/**
 * T47: Workflow Visualization Module
 * Shows workflow instances list (active/archived) + detail view with SVG state graph,
 * history timeline, bindings table, and artifacts viewer.
 */

const wfState = {
  instances: null,      // { active: [], archived: [] }
  selectedId: null,     // current instance id
  activeTab: 'active',  // 'active' | 'archived'
  detailData: null,     // { state, definition, artifacts }
}

const wfEl = {}

function initWorkflow() {
  wfEl.layout = document.getElementById('workflowLayout')
}

async function loadWorkflowPage() {
  if (!wfEl.layout) return

  try {
    const res = await fetch('/api/workflow/instances')
    wfState.instances = await res.json()
  } catch {
    wfState.instances = { active: [], archived: [] }
  }

  wfState.selectedId = null
  renderWorkflowList()
}

// ── Instance List ──

function renderWorkflowList() {
  const data = wfState.instances
  if (!data) return

  const activeCount = (data.active || []).length
  const archivedCount = (data.archived || []).length

  wfEl.layout.innerHTML = `
    <div class="page-header">
      <h2>📋 工作流</h2>
      <div class="wf-summary">${activeCount} 活跃 · ${archivedCount} 归档</div>
    </div>

    <div class="wf-tabs">
      <button class="wf-tab ${wfState.activeTab === 'active' ? 'active' : ''}" data-tab="active">
        活跃 <span class="wf-tab-count">${activeCount}</span>
      </button>
      <button class="wf-tab ${wfState.activeTab === 'archived' ? 'active' : ''}" data-tab="archived">
        归档 <span class="wf-tab-count">${archivedCount}</span>
      </button>
    </div>

    <div class="wf-card-grid" id="wfCardGrid">
      ${renderInstanceCards(wfState.activeTab === 'active' ? data.active : data.archived)}
    </div>
  `

  // Bind tab clicks
  wfEl.layout.querySelectorAll('.wf-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      wfState.activeTab = tab.dataset.tab
      renderWorkflowList()
    })
  })

  // Bind card clicks
  wfEl.layout.querySelectorAll('.wf-card').forEach(card => {
    card.addEventListener('click', () => loadWorkflowDetail(card.dataset.id))
  })
}

function renderInstanceCards(instances) {
  if (!instances || instances.length === 0) {
    return '<div class="memory-empty">暂无工作流实例</div>'
  }

  return instances.map(inst => {
    const statusClass = inst.status === 'completed' ? 'completed'
      : inst.status === 'aborted' ? 'aborted'
      : 'running'
    const statusLabel = inst.status === 'completed' ? '✅ 已完成'
      : inst.status === 'aborted' ? '❌ 已中止'
      : '🔄 进行中'
    const savedDate = inst.savedAt ? new Date(inst.savedAt).toLocaleString('zh-CN') : '--'
    const nodeLabel = inst.currentNode || '--'

    return `
      <div class="wf-card" data-id="${escapeHtml(inst.instanceId)}">
        <div class="wf-card-header">
          <div class="wf-card-name">${escapeHtml(inst.workflowId)}</div>
          <span class="wf-status-badge ${statusClass}">${statusLabel}</span>
        </div>
        <div class="wf-card-body">
          <div class="wf-card-field">
            <span class="wf-card-label">当前节点</span>
            <span class="wf-card-value wf-node-badge">${escapeHtml(nodeLabel)}</span>
          </div>
          <div class="wf-card-field">
            <span class="wf-card-label">实例 ID</span>
            <span class="wf-card-value" style="font-family:monospace;font-size:11px;">${escapeHtml(inst.instanceId.slice(0, 20))}</span>
          </div>
          <div class="wf-card-meta">
            <span>📝 ${inst.historyLength} 步</span>
            <span>📎 ${inst.artifactCount} 产出</span>
            <span>👥 ${inst.bindingCount} 绑定</span>
          </div>
        </div>
        <div class="wf-card-footer">${savedDate}</div>
      </div>
    `
  }).join('')
}

// ── Instance Detail ──

async function loadWorkflowDetail(instanceId) {
  wfState.selectedId = instanceId

  // Show loading
  wfEl.layout.innerHTML = `
    <div class="wf-detail-header">
      <button class="wf-back-btn" id="wfBackBtn">← 返回列表</button>
      <span class="wf-detail-id" style="font-family:monospace;font-size:13px;color:var(--text-muted);">${escapeHtml(instanceId)}</span>
    </div>
    <div class="memory-loading">
      <div style="font-size: 36px; margin-bottom: 12px;">⏳</div>
      <div style="color: var(--text-muted);">加载详情…</div>
    </div>
  `
  document.getElementById('wfBackBtn')?.addEventListener('click', () => {
    wfState.selectedId = null
    renderWorkflowList()
  })

  // Fetch all data in parallel
  const [stateRes, defRes, artRes] = await Promise.allSettled([
    fetch(`/api/workflow/${instanceId}/state`).then(r => r.json()),
    fetch(`/api/workflow/${instanceId}/definition`).then(r => r.json()),
    fetch(`/api/workflow/${instanceId}/artifacts`).then(r => r.json()),
  ])

  const stateData = stateRes.status === 'fulfilled' ? stateRes.value : {}
  const defData = defRes.status === 'fulfilled' ? defRes.value : {}
  const artData = artRes.status === 'fulfilled' ? artRes.value : {}

  wfState.detailData = { state: stateData, definition: defData, artifacts: artData }

  renderWorkflowDetail()
}

function renderWorkflowDetail() {
  const { state, definition, artifacts } = wfState.detailData
  const sm = state.smState || {}
  const nodes = definition.nodes || {}
  const history = sm.history || []
  const bindings = state.bindings || []
  const artList = (artifacts.artifacts || [])

  const statusClass = sm.status === 'completed' ? 'completed' : sm.status === 'aborted' ? 'aborted' : 'running'
  const statusLabel = sm.status === 'completed' ? '✅ 已完成' : sm.status === 'aborted' ? '❌ 已中止' : '🔄 进行中'

  wfEl.layout.innerHTML = `
    <div class="wf-detail-header">
      <button class="wf-back-btn" id="wfBackBtn">← 返回列表</button>
      <div class="wf-detail-title">
        <span style="font-weight:700;font-size:18px;">${escapeHtml(definition.name || state.workflowId || '--')}</span>
        <span class="wf-status-badge ${statusClass}">${statusLabel}</span>
      </div>
      <span class="wf-detail-id" style="font-family:monospace;font-size:12px;color:var(--text-muted);">${escapeHtml(wfState.selectedId)}</span>
    </div>

    <!-- SVG State Graph -->
    <div class="memory-section">
      <div class="memory-section-header">
        <div class="memory-section-title">🔀 状态流转图</div>
      </div>
      <div class="wf-graph-container" id="wfGraph">
        ${renderSvgGraph(nodes, sm, definition)}
      </div>
    </div>

    <!-- Two columns: History + Bindings/Artifacts -->
    <div class="wf-detail-columns">
      <!-- History Timeline -->
      <div class="memory-section">
        <div class="memory-section-header">
          <div class="memory-section-title">🕐 流转历史</div>
          <span class="memory-stat-label">${history.length} 步</span>
        </div>
        <div class="memory-section-body" id="wfHistory">
          ${renderHistoryTimeline(history)}
        </div>
      </div>

      <div>
        <!-- Bindings -->
        <div class="memory-section" style="margin-bottom: var(--space-5);">
          <div class="memory-section-header">
            <div class="memory-section-title">👥 参与者绑定</div>
          </div>
          <div class="memory-section-body">
            ${renderBindingsTable(bindings)}
          </div>
        </div>

        <!-- Artifacts -->
        <div class="memory-section">
          <div class="memory-section-header">
            <div class="memory-section-title">📎 产出物</div>
            <span class="memory-stat-label">${artList.length} 个</span>
          </div>
          <div class="memory-section-body" id="wfArtifacts">
            ${renderArtifactsList(artList)}
          </div>
        </div>
      </div>
    </div>
  `

  // Bind back button
  document.getElementById('wfBackBtn')?.addEventListener('click', () => {
    wfState.selectedId = null
    renderWorkflowList()
  })

  // Bind artifact expand
  wfEl.layout.querySelectorAll('.wf-artifact-item').forEach(item => {
    item.addEventListener('click', () => toggleArtifact(item.dataset.name))
  })
}

// ── SVG State Graph ──

function renderSvgGraph(nodes, sm, definition) {
  const nodeIds = Object.keys(nodes)
  if (nodeIds.length === 0) return '<div class="memory-empty">无节点定义</div>'

  // Build visited set from history
  const visited = new Set()
  const history = sm.history || []
  for (const h of history) {
    if (h.from) visited.add(h.from)
    if (h.to) visited.add(h.to)
  }

  const currentNode = sm.current_node
  const nodeW = 140
  const nodeH = 60
  const gapX = 50
  const paddingX = 30
  const paddingY = 30
  const totalW = paddingX * 2 + nodeIds.length * nodeW + (nodeIds.length - 1) * gapX
  const totalH = paddingY * 2 + nodeH + 40 // 40 for role label below

  // Build transition edges
  const edges = []
  nodeIds.forEach((nid, i) => {
    const node = nodes[nid]
    if (!node.transitions) return
    for (const [event, t] of Object.entries(node.transitions)) {
      const targetIdx = nodeIds.indexOf(t.target)
      if (targetIdx >= 0) {
        edges.push({ from: i, to: targetIdx, event })
      }
    }
  })

  let svg = `<svg viewBox="0 0 ${totalW} ${totalH}" class="wf-svg">`

  // Defs: arrow marker
  svg += `<defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="var(--text-muted)"/>
    </marker>
    <marker id="arrowhead-accent" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="var(--accent)"/>
    </marker>
  </defs>`

  // Draw edges
  for (const edge of edges) {
    const x1 = paddingX + edge.from * (nodeW + gapX) + nodeW
    const y1 = paddingY + nodeH / 2
    const x2 = paddingX + edge.to * (nodeW + gapX)
    const y2 = paddingY + nodeH / 2

    if (edge.to > edge.from) {
      // Forward edge — straight line
      const marker = visited.has(nodeIds[edge.from]) && visited.has(nodeIds[edge.to]) ? 'arrowhead-accent' : 'arrowhead'
      const color = visited.has(nodeIds[edge.from]) && visited.has(nodeIds[edge.to]) ? 'var(--accent)' : 'rgba(0,0,0,0.15)'
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" marker-end="url(#${marker})"/>`
    } else {
      // Backward edge (loop) — curved path below nodes
      const loopY = paddingY + nodeH + 25
      svg += `<path d="M ${x1} ${y1} C ${x1 + 20} ${loopY}, ${x2 - 20} ${loopY}, ${x2} ${y2}"
        fill="none" stroke="rgba(0,0,0,0.1)" stroke-width="1.5" stroke-dasharray="4 3"
        marker-end="url(#arrowhead)"/>`
    }
  }

  // Draw nodes
  nodeIds.forEach((nid, i) => {
    const node = nodes[nid]
    const x = paddingX + i * (nodeW + gapX)
    const y = paddingY
    const isCurrent = nid === currentNode
    const isVisited = visited.has(nid)
    const isTerminal = node.type === 'terminal'

    let fill, stroke, textColor
    if (isCurrent) {
      fill = 'var(--accent)'; stroke = 'var(--accent-dark)'; textColor = 'white'
    } else if (isTerminal && isVisited) {
      fill = 'var(--status-online)'; stroke = '#388E3C'; textColor = 'white'
    } else if (isVisited) {
      fill = 'rgba(76,175,80,0.15)'; stroke = 'var(--status-online)'; textColor = 'var(--text-primary)'
    } else {
      fill = 'rgba(0,0,0,0.04)'; stroke = 'rgba(0,0,0,0.12)'; textColor = 'var(--text-muted)'
    }

    const rx = isTerminal ? nodeH / 2 : 10

    // Node rect
    svg += `<rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="${rx}" ry="${rx}"
      fill="${fill}" stroke="${stroke}" stroke-width="${isCurrent ? 2.5 : 1.5}"/>`

    // Pulse animation on current node
    if (isCurrent) {
      svg += `<rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="${rx}" ry="${rx}"
        fill="none" stroke="var(--accent)" stroke-width="2" opacity="0.5">
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="stroke-width" values="2;5;2" dur="2s" repeatCount="indefinite"/>
      </rect>`
    }

    // Node name
    svg += `<text x="${x + nodeW / 2}" y="${y + nodeH / 2 + 1}" text-anchor="middle" dominant-baseline="middle"
      fill="${textColor}" font-size="13" font-weight="${isCurrent ? 700 : 500}" font-family="inherit">${escapeHtml(nid)}</text>`

    // Role label below node
    const role = node.participant || (isTerminal ? '' : '')
    if (role) {
      const roleColor = getRoleColor(role)
      svg += `<rect x="${x + nodeW / 2 - 25}" y="${y + nodeH + 6}" width="50" height="18" rx="9"
        fill="${roleColor}" opacity="0.15"/>`
      svg += `<text x="${x + nodeW / 2}" y="${y + nodeH + 16}" text-anchor="middle" dominant-baseline="middle"
        fill="${roleColor}" font-size="10" font-weight="600">${escapeHtml(role)}</text>`
    }
  })

  svg += '</svg>'
  return svg
}

function getRoleColor(role) {
  const map = {
    planner: '#9C27B0',
    pua: '#FF9800',
    coder: '#2196F3',
    arch: '#4CAF50',
    nvwa: '#E91E63',
  }
  return map[role] || '#607D8B'
}

// ── History Timeline ──

function renderHistoryTimeline(history) {
  if (!history || history.length === 0) return '<div class="memory-empty">暂无历史记录</div>'

  return history.map((h, i) => {
    const from = h.from || '(start)'
    const to = h.to || '?'
    const actor = h.actor || 'system'
    const ts = h.ts ? new Date(h.ts).toLocaleString('zh-CN') : '--'

    const actorClass = actor === 'user' ? 'user' : actor === 'system' ? 'system' : 'agent'
    const isLast = i === history.length - 1

    return `
      <div class="wf-timeline-item ${isLast ? 'current' : ''}">
        <div class="wf-timeline-dot ${actorClass}"></div>
        <div class="wf-timeline-content">
          <div class="wf-timeline-transition">
            <span class="wf-timeline-from">${escapeHtml(from)}</span>
            <span class="wf-timeline-arrow">→</span>
            <span class="wf-timeline-to">${escapeHtml(to)}</span>
          </div>
          <div class="wf-timeline-meta">
            <span class="wf-timeline-event">${escapeHtml(h.event || '')}</span>
            <span class="wf-timeline-actor ${actorClass}">${escapeHtml(actor)}</span>
            <span class="wf-timeline-time">${ts}</span>
          </div>
          ${h.meta ? `<div class="wf-timeline-evidence" title="${escapeHtml(h.meta.evidence || '')}">📋 ${escapeHtml(h.meta.on_behalf_of || '')}</div>` : ''}
        </div>
      </div>
    `
  }).join('')
}

// ── Bindings Table ──

function renderBindingsTable(bindings) {
  if (!bindings || bindings.length === 0) return '<div class="memory-empty">暂无绑定</div>'

  let html = '<div class="wf-bindings-table">'
  for (const b of bindings) {
    const isPlaceholder = b.placeholder || b.sessionId === 'unknown' || (b.sessionId || '').startsWith('unknown')
    html += `
      <div class="wf-binding-row ${isPlaceholder ? 'placeholder' : ''}">
        <span class="wf-binding-role" style="color:${getRoleColor(b.role)}">${escapeHtml(b.role)}</span>
        <span class="wf-binding-session">${isPlaceholder ? '⏳ 待绑定' : escapeHtml((b.sessionId || '').slice(0, 16))}</span>
      </div>
    `
  }
  html += '</div>'
  return html
}

// ── Artifacts List ──

function renderArtifactsList(artifacts) {
  if (!artifacts || artifacts.length === 0) return '<div class="memory-empty">暂无产出物</div>'

  return artifacts.map(a => {
    const sizeKb = (a.size / 1024).toFixed(1)
    return `
      <div class="wf-artifact-item" data-name="${escapeHtml(a.name)}">
        <div class="wf-artifact-header">
          <span class="wf-artifact-icon">📄</span>
          <span class="wf-artifact-name">${escapeHtml(a.name)}</span>
          <span class="wf-artifact-size">${sizeKb} KB</span>
          <span class="wf-artifact-expand">▼</span>
        </div>
        <div class="wf-artifact-body" id="wfArt-${escapeHtml(a.name)}" style="display:none;">
          <div style="text-align:center;color:var(--text-muted);padding:var(--space-4);">加载中…</div>
        </div>
      </div>
    `
  }).join('')
}

async function toggleArtifact(name) {
  const body = document.getElementById(`wfArt-${name}`)
  if (!body) return

  if (body.style.display === 'none') {
    body.style.display = 'block'
    // Load content if not loaded
    if (body.dataset.loaded !== 'true') {
      try {
        const res = await fetch(`/api/workflow/${wfState.selectedId}/artifacts/${name}`)
        const data = await res.json()
        if (data.content) {
          body.innerHTML = `<pre class="wf-artifact-code">${escapeHtml(data.content)}</pre>`
        } else {
          body.innerHTML = '<div class="memory-empty">无法加载内容</div>'
        }
        body.dataset.loaded = 'true'
      } catch {
        body.innerHTML = '<div class="memory-empty">加载失败</div>'
      }
    }
  } else {
    body.style.display = 'none'
  }

  // Toggle expand icon
  const item = body.closest('.wf-artifact-item')
  const icon = item?.querySelector('.wf-artifact-expand')
  if (icon) icon.textContent = body.style.display === 'none' ? '▼' : '▲'
}

// ── Initialize ──

document.addEventListener('DOMContentLoaded', () => {
  initWorkflow()

  const wfPage = document.getElementById('page-workflows')
  if (!wfPage) return

  // Observer for SPA tab switches
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.target.id === 'page-workflows' && m.target.classList.contains('active')) {
        loadWorkflowPage()
      }
    })
  })
  observer.observe(wfPage, { attributes: true, attributeFilter: ['class'] })

  // Check if already active on initial load
  if (wfPage.classList.contains('active')) {
    loadWorkflowPage()
  }

  // Also listen for hash changes (direct navigation)
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#workflows' && wfPage.classList.contains('active')) {
      if (!wfState.instances) loadWorkflowPage()
    }
  })
})
