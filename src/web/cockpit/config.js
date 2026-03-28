/**
 * T46: Configuration Management — Config Page Logic
 * Separate file from app.js to avoid conflicts with T45 chat page
 *
 * Handles: identity editor, personality sliders, model config, JSON preview
 */

const CONFIG_API = ''

// ── State ──
const configState = {
  selectedMember: null,
  identity: null,
  model: null,
  members: [],
  dirty: false,
}

// ── Init ──
function initConfigPage() {
  const page = document.getElementById('page-settings')
  if (!page) return

  page.innerHTML = `
    <div class="config-layout">
      <div class="config-sidebar">
        <div class="config-section-title">成员列表</div>
        <div id="configMemberList" class="config-member-list"></div>
      </div>
      <div class="config-main" id="configMain">
        <div class="config-placeholder">
          <div style="font-size: 48px; margin-bottom: 16px;">⚙️</div>
          <div style="color: var(--text-muted);">选择一个成员来编辑配置</div>
        </div>
      </div>
    </div>
  `

  loadConfigMembers()
}

async function loadConfigMembers() {
  try {
    const r = await fetch(`${CONFIG_API}/api/family/members`)
    const data = await r.json()
    configState.members = data.members || []
    renderConfigMemberList()
  } catch { /* ignore */ }
}

function renderConfigMemberList() {
  const list = document.getElementById('configMemberList')
  if (!list) return

  list.innerHTML = configState.members.map(m => `
    <div class="config-member-item ${configState.selectedMember === m.name ? 'active' : ''}"
         onclick="selectConfigMember('${m.name}')">
      <span class="config-member-dot ${m.status === 'online' ? 'online' : 'offline'}"></span>
      <span class="config-member-name">${escapeHtml(m.name)}</span>
      <span class="config-member-role">${m.role}</span>
    </div>
  `).join('')
}

async function selectConfigMember(name) {
  configState.selectedMember = name
  configState.dirty = false
  renderConfigMemberList()

  const main = document.getElementById('configMain')
  main.innerHTML = '<div class="config-placeholder"><div style="color: var(--text-muted);">加载中...</div></div>'

  // Fetch identity + model in parallel
  const [idRes, modelRes] = await Promise.allSettled([
    fetch(`${CONFIG_API}/api/member/${encodeURIComponent(name)}/identity`).then(r => r.ok ? r.json() : null),
    fetch(`${CONFIG_API}/api/member/${encodeURIComponent(name)}/model`).then(r => r.ok ? r.json() : null),
  ])

  configState.identity = idRes.status === 'fulfilled' ? idRes.value : null
  configState.model = modelRes.status === 'fulfilled' ? modelRes.value : null

  renderConfigEditor(name)
}

function renderConfigEditor(name) {
  const main = document.getElementById('configMain')
  const id = configState.identity
  const identity = id?.identity || {}
  const psychology = id?.psychology || {}
  const traits = psychology.traits || {}
  const model = configState.model || {}

  main.innerHTML = `
    <div class="config-editor">
      <div class="config-editor-header">
        <h2 class="config-editor-title">${escapeHtml(name)}</h2>
        <div class="config-editor-actions">
          <button class="btn btn-primary" onclick="saveIdentity('${name}')" id="btnSaveIdentity">
            💾 保存身份
          </button>
        </div>
      </div>

      <!-- 身份信息 -->
      <div class="config-card">
        <div class="config-card-title">🎭 身份信息</div>
        <div class="config-field">
          <label class="config-label">名字</label>
          <input type="text" class="config-input" id="cfgName"
                 value="${escapeHtml(identity.name || '')}"
                 oninput="markDirty()" placeholder="AI 的名字">
        </div>
        <div class="config-field">
          <label class="config-label">昵称</label>
          <input type="text" class="config-input" id="cfgNickname"
                 value="${escapeHtml(identity.nickname || '')}"
                 oninput="markDirty()" placeholder="昵称">
        </div>
        <div class="config-field">
          <label class="config-label">简介</label>
          <textarea class="config-textarea" id="cfgBio"
                    oninput="markDirty()" placeholder="角色简介">${escapeHtml(identity.bio || '')}</textarea>
        </div>
        <div class="config-field">
          <label class="config-label">主人</label>
          <input type="text" class="config-input" id="cfgOwner"
                 value="${escapeHtml(identity.owner || '')}"
                 oninput="markDirty()" placeholder="主人名字">
        </div>
      </div>

      <!-- 性格维度 -->
      <div class="config-card">
        <div class="config-card-title">🧠 性格维度</div>
        <div class="config-field">
          <label class="config-label">MBTI</label>
          <input type="text" class="config-input" id="cfgMbti"
                 value="${escapeHtml(psychology.mbti || '')}"
                 oninput="markDirty()" placeholder="如 ENFP, INTJ 等" maxlength="4"
                 style="width: 120px; text-transform: uppercase;">
        </div>
        ${renderTraitSlider('humor', '幽默感', traits.humor)}
        ${renderTraitSlider('warmth', '温暖度', traits.warmth)}
        ${renderTraitSlider('initiative', '主动性', traits.initiative)}
        ${renderTraitSlider('precision', '精确度', traits.precision)}
        ${renderTraitSlider('verbosity', '话多度', traits.verbosity)}
      </div>

      <!-- 模型配置 -->
      <div class="config-card">
        <div class="config-card-title">🤖 模型配置</div>
        <div class="config-field">
          <label class="config-label">主模型</label>
          <input type="text" class="config-input" id="cfgModel"
                 value="${escapeHtml(model.model || '')}"
                 placeholder="如 anthropic/claude-sonnet-4-20250514">
        </div>
        <div class="config-field">
          <label class="config-label">辅助模型</label>
          <input type="text" class="config-input" id="cfgSmallModel"
                 value="${escapeHtml(model.small_model || '')}"
                 placeholder="如 anthropic/claude-haiku">
        </div>
        <div class="config-field" style="margin-top: 12px;">
          <button class="btn btn-warning" onclick="saveModel('${name}')">
            🔄 保存模型 + 重启
          </button>
          <span class="config-hint">保存后需要重启 member 才能生效</span>
        </div>
      </div>

      <!-- JSON 预览 -->
      <div class="config-card">
        <div class="config-card-title">📋 Identity JSON 预览</div>
        <pre class="config-json" id="cfgJsonPreview">${escapeHtml(JSON.stringify(id, null, 2) || '{}')}</pre>
      </div>
    </div>
  `
}

function renderTraitSlider(key, label, value) {
  const val = value != null ? value : 0.5
  const pct = Math.round(val * 100)
  return `
    <div class="config-field config-slider-field">
      <label class="config-label">${label}</label>
      <div class="config-slider-row">
        <input type="range" class="config-slider" id="cfgTrait_${key}"
               min="0" max="1" step="0.1" value="${val}"
               oninput="updateSliderValue('${key}', this.value); markDirty()">
        <span class="config-slider-value" id="cfgTraitVal_${key}">${pct}%</span>
      </div>
    </div>
  `
}

function updateSliderValue(key, val) {
  const el = document.getElementById(`cfgTraitVal_${key}`)
  if (el) el.textContent = `${Math.round(val * 100)}%`
  updateJsonPreview()
}

function markDirty() {
  configState.dirty = true
  updateJsonPreview()
}

function updateJsonPreview() {
  const preview = document.getElementById('cfgJsonPreview')
  if (!preview) return
  const data = collectIdentityData()
  preview.textContent = JSON.stringify(data, null, 2)
}

function collectIdentityData() {
  const data = { ...(configState.identity || {}) }
  data.identity = {
    name: document.getElementById('cfgName')?.value || '',
    nickname: document.getElementById('cfgNickname')?.value || '',
    bio: document.getElementById('cfgBio')?.value || '',
    owner: document.getElementById('cfgOwner')?.value || '',
  }
  data.psychology = {
    mbti: document.getElementById('cfgMbti')?.value?.toUpperCase() || '',
    traits: {},
  }
  for (const key of ['humor', 'warmth', 'initiative', 'precision', 'verbosity']) {
    const slider = document.getElementById(`cfgTrait_${key}`)
    if (slider) data.psychology.traits[key] = parseFloat(slider.value)
  }
  return data
}

async function saveIdentity(name) {
  const btn = document.getElementById('btnSaveIdentity')
  if (btn) { btn.disabled = true; btn.textContent = '保存中...' }

  const data = collectIdentityData()

  try {
    const r = await fetch(`${CONFIG_API}/api/member/${encodeURIComponent(name)}/identity`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!r.ok) {
      const err = await r.json()
      throw new Error(err.error || `HTTP ${r.status}`)
    }

    const result = await r.json()
    configState.identity = result.identity
    configState.dirty = false
    showToast('success', '保存成功', `${name} 身份已更新`)
    renderConfigEditor(name)
  } catch (e) {
    showToast('error', '保存失败', e.message)
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 保存身份' }
  }
}

async function saveModel(name) {
  const model = document.getElementById('cfgModel')?.value
  const small_model = document.getElementById('cfgSmallModel')?.value

  if (!model) {
    showToast('warning', '请填写模型', '主模型不能为空')
    return
  }

  try {
    // 1. Save model
    const r = await fetch(`${CONFIG_API}/api/member/${encodeURIComponent(name)}/model`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, small_model }),
    })

    if (!r.ok) {
      const err = await r.json()
      throw new Error(err.error || `HTTP ${r.status}`)
    }

    showToast('info', '模型已保存', `正在重启 ${name}...`)

    // 2. Trigger restart
    const restartR = await fetch(`${CONFIG_API}/api/member/${encodeURIComponent(name)}/restart`, {
      method: 'POST',
    })

    if (restartR.ok) {
      showToast('success', '重启成功', `${name} 正在使用新模型启动`)
    } else {
      showToast('warning', '保存成功但重启失败', '请手动重启 member')
    }
  } catch (e) {
    showToast('error', '保存失败', e.message)
  }
}

// ── Config page CSS injection ──
function injectConfigStyles() {
  if (document.getElementById('t46-config-styles')) return
  const style = document.createElement('style')
  style.id = 't46-config-styles'
  style.textContent = `
    .config-layout {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 0;
      height: 100%;
      min-height: calc(100vh - 80px);
    }
    .config-sidebar {
      background: var(--glass-bg);
      backdrop-filter: blur(10px);
      border-right: 1px solid var(--border);
      padding: 20px 0;
      overflow-y: auto;
    }
    .config-section-title {
      padding: 8px 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .config-member-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 20px;
      cursor: pointer;
      transition: background 0.15s;
      border-left: 3px solid transparent;
    }
    .config-member-item:hover { background: rgba(255,138,101,0.08); }
    .config-member-item.active {
      background: rgba(255,138,101,0.12);
      border-left-color: var(--accent);
    }
    .config-member-dot {
      width: 8px; height: 8px; border-radius: 50%;
      flex-shrink: 0;
    }
    .config-member-dot.online { background: var(--status-online); }
    .config-member-dot.offline { background: var(--status-offline); }
    .config-member-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-primary);
    }
    .config-member-role {
      margin-left: auto;
      font-size: 11px;
      color: var(--text-muted);
      background: rgba(0,0,0,0.04);
      padding: 2px 8px;
      border-radius: 8px;
    }
    .config-main {
      padding: 24px 32px;
      overflow-y: auto;
    }
    .config-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 300px;
      text-align: center;
    }
    .config-editor-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .config-editor-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
    }
    .config-card {
      background: var(--glass-bg);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .config-card-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 16px;
    }
    .config-field {
      margin-bottom: 16px;
    }
    .config-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .config-input, .config-textarea {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 10px;
      font-family: inherit;
      font-size: 14px;
      color: var(--text-primary);
      background: rgba(255,255,255,0.7);
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
      box-sizing: border-box;
    }
    .config-input:focus, .config-textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(255,138,101,0.15);
    }
    .config-textarea {
      min-height: 80px;
      resize: vertical;
    }
    .config-slider-field {
      display: grid;
      grid-template-columns: 80px 1fr;
      align-items: center;
      gap: 12px;
    }
    .config-slider-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .config-slider {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 6px;
      border-radius: 3px;
      background: linear-gradient(90deg, var(--border) 0%, var(--accent) 100%);
      outline: none;
    }
    .config-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px; height: 18px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 2px 6px rgba(255,138,101,0.3);
      cursor: pointer;
    }
    .config-slider-value {
      font-size: 13px;
      font-weight: 600;
      color: var(--accent);
      min-width: 40px;
      text-align: right;
    }
    .config-json {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 12px;
      background: rgba(0,0,0,0.03);
      border-radius: 10px;
      padding: 16px;
      overflow-x: auto;
      color: var(--text-secondary);
      line-height: 1.5;
      max-height: 300px;
      overflow-y: auto;
    }
    .config-hint {
      font-size: 12px;
      color: var(--text-muted);
      margin-left: 12px;
    }
    .btn-warning {
      background: linear-gradient(135deg, #FFA726, #FF9800);
      color: white;
      border: none;
      border-radius: 10px;
      padding: 10px 20px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .btn-warning:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(255,152,0,0.3);
    }
    @media (max-width: 768px) {
      .config-layout { grid-template-columns: 1fr; }
      .config-sidebar { border-right: none; border-bottom: 1px solid var(--border); }
      .config-main { padding: 16px; }
      .config-slider-field { grid-template-columns: 1fr; }
    }
  `
  document.head.appendChild(style)
}

// Auto-init when settings page becomes visible
// Use MutationObserver on the page element's class to catch all activation paths
// (nav click, hashchange, deep link, initial load)
document.addEventListener('DOMContentLoaded', () => {
  const settingsPage = document.getElementById('page-settings')
  if (!settingsPage) return

  let initialized = false
  function tryInit() {
    if (settingsPage.classList.contains('active') && !initialized) {
      initialized = true
      injectConfigStyles()
      initConfigPage()
    }
  }

  // Watch for class changes (navigateTo adds 'active')
  const observer = new MutationObserver(tryInit)
  observer.observe(settingsPage, { attributes: true, attributeFilter: ['class'] })

  // Also check immediately for deep link (#settings on initial load)
  tryInit()
})
