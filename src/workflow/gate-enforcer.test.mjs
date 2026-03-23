import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  GateEnforcer,
  resolveCapabilities,
  checkBashPolicy,
  checkFilePath,
  extractTargetPaths,
  parsePatchPaths,
} from './gate-enforcer.mjs'

// ── 测试辅助 ──

const WORKSPACE = '/Users/test/project'

function actionNode(overrides = {}) {
  return {
    id: 'analyze',
    type: 'action',
    capabilities: ['code_read', 'workflow_control'],
    bash_policy: 'deny',
    ...overrides,
  }
}

describe('GateEnforcer — 能力映射', () => {
  it('code_read → read, glob, grep', () => {
    const tools = resolveCapabilities(['code_read'])
    assert.ok(tools.has('read'))
    assert.ok(tools.has('glob'))
    assert.ok(tools.has('grep'))
    assert.equal(tools.size, 3)
  })

  it('code_write → edit, write, apply_patch', () => {
    const tools = resolveCapabilities(['code_write'])
    assert.ok(tools.has('edit'))
    assert.ok(tools.has('write'))
    assert.ok(tools.has('apply_patch'))
  })

  it('多能力合并', () => {
    const tools = resolveCapabilities(['code_read', 'code_write', 'shell_exec'])
    assert.ok(tools.has('read'))
    assert.ok(tools.has('edit'))
    assert.ok(tools.has('bash'))
  })

  it('未知能力名当作直接工具名', () => {
    const tools = resolveCapabilities(['custom_tool'])
    assert.ok(tools.has('custom_tool'))
  })
})

describe('GateEnforcer — 参与者状态', () => {
  it('未绑定 → 全部放行', () => {
    const result = GateEnforcer.check({
      tool: 'bash', args: { command: 'rm -rf /' },
      node: actionNode(), participantStatus: 'unbound',
    })
    assert.equal(result.allowed, true)
  })

  it('冻结态 read → 放行', () => {
    const result = GateEnforcer.check({
      tool: 'read', args: {},
      node: actionNode(), participantStatus: 'frozen',
    })
    assert.equal(result.allowed, true)
  })

  it('冻结态 glob → 放行', () => {
    const result = GateEnforcer.check({
      tool: 'glob', args: {},
      node: actionNode(), participantStatus: 'frozen',
    })
    assert.equal(result.allowed, true)
  })

  it('冻结态 workflow_status → 放行', () => {
    const result = GateEnforcer.check({
      tool: 'workflow_status', args: {},
      node: actionNode(), participantStatus: 'frozen',
    })
    assert.equal(result.allowed, true)
  })

  it('冻结态 edit → 拦截', () => {
    const result = GateEnforcer.check({
      tool: 'edit', args: {},
      node: actionNode(), participantStatus: 'frozen',
    })
    assert.equal(result.allowed, false)
    assert.ok(result.reason.includes('冻结'))
  })

  it('冻结态 bash → 拦截', () => {
    const result = GateEnforcer.check({
      tool: 'bash', args: {},
      node: actionNode(), participantStatus: 'frozen',
    })
    assert.equal(result.allowed, false)
  })

  it('冻结态 workflow_transition → 拦截', () => {
    const result = GateEnforcer.check({
      tool: 'workflow_transition', args: {},
      node: actionNode(), participantStatus: 'frozen',
    })
    assert.equal(result.allowed, false)
  })

  it('冻结态 workflow_retry_handoff → 放行', () => {
    const result = GateEnforcer.check({
      tool: 'workflow_retry_handoff', args: {},
      node: actionNode(), participantStatus: 'frozen',
    })
    assert.equal(result.allowed, true)
  })

  it('冻结态 workflow_cancel_handoff → 放行', () => {
    const result = GateEnforcer.check({
      tool: 'workflow_cancel_handoff', args: {},
      node: actionNode(), participantStatus: 'frozen',
    })
    assert.equal(result.allowed, true)
  })
})

describe('GateEnforcer — 能力白名单', () => {
  it('capabilities 内工具 → 放行', () => {
    const result = GateEnforcer.check({
      tool: 'read', args: {},
      node: actionNode({ capabilities: ['code_read'] }),
      participantStatus: 'active',
    })
    assert.equal(result.allowed, true)
  })

  it('capabilities 外工具 → 拦截', () => {
    const result = GateEnforcer.check({
      tool: 'edit', args: {},
      node: actionNode({ capabilities: ['code_read'] }),
      participantStatus: 'active',
    })
    assert.equal(result.allowed, false)
    assert.ok(result.reason.includes('edit'))
  })

  it('apply_patch 不在 code_read → 拦截', () => {
    const result = GateEnforcer.check({
      tool: 'apply_patch', args: {},
      node: actionNode({ capabilities: ['code_read'] }),
      participantStatus: 'active',
    })
    assert.equal(result.allowed, false)
  })

  it('apply_patch 在 code_write → 放行', () => {
    const result = GateEnforcer.check({
      tool: 'apply_patch', args: { patch: '' },
      node: actionNode({ capabilities: ['code_write'], file_scope: null }),
      participantStatus: 'active',
    })
    assert.equal(result.allowed, true)
  })
})

describe('GateEnforcer — bash_policy', () => {
  it('deny: 任何 bash 调用 → 拦截', () => {
    const r = checkBashPolicy('deny', 'cat foo.txt')
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('deny'))
  })

  it('read_only: cat → 放行', () => {
    assert.equal(checkBashPolicy('read_only', 'cat foo.txt').allowed, true)
  })

  it('read_only: ls → 放行', () => {
    assert.equal(checkBashPolicy('read_only', 'ls -la src/').allowed, true)
  })

  it('read_only: grep → 放行', () => {
    assert.equal(checkBashPolicy('read_only', 'grep -r pattern .').allowed, true)
  })

  it('read_only: git log → 放行', () => {
    assert.equal(checkBashPolicy('read_only', 'git log -n 5').allowed, true)
  })

  it('read_only: git diff → 放行', () => {
    assert.equal(checkBashPolicy('read_only', 'git diff HEAD~1').allowed, true)
  })

  it('read_only: sed -i → 拦截', () => {
    assert.equal(checkBashPolicy('read_only', 'cat foo | sed -i s/a/b/').allowed, false)
  })

  it('read_only: 重定向 → 拦截', () => {
    assert.equal(checkBashPolicy('read_only', 'echo hello > file.txt').allowed, false)
  })

  it('read_only: rm → 拦截', () => {
    assert.equal(checkBashPolicy('read_only', 'rm -rf temp/').allowed, false)
  })

  it('read_only: python → 拦截', () => {
    assert.equal(checkBashPolicy('read_only', 'python script.py').allowed, false)
  })

  it('read_only: npm test → 拦截（不在 read_only）', () => {
    assert.equal(checkBashPolicy('read_only', 'npm test').allowed, false)
  })

  it('test_build: npm test → 放行', () => {
    assert.equal(checkBashPolicy('test_build', 'npm test').allowed, true)
  })

  it('test_build: npm run test → 放行', () => {
    assert.equal(checkBashPolicy('test_build', 'npm run test').allowed, true)
  })

  it('test_build: node --test → 放行', () => {
    assert.equal(checkBashPolicy('test_build', 'node --test src/foo.test.mjs').allowed, true)
  })

  it('test_build: npx vitest → 放行', () => {
    assert.equal(checkBashPolicy('test_build', 'npx vitest run').allowed, true)
  })

  it('test_build: pytest → 放行', () => {
    assert.equal(checkBashPolicy('test_build', 'pytest tests/').allowed, true)
  })

  it('test_build: cat → 放行（回退到 read_only）', () => {
    assert.equal(checkBashPolicy('test_build', 'cat foo.txt').allowed, true)
  })

  it('test_build: sed -i → 拦截', () => {
    assert.equal(checkBashPolicy('test_build', 'cat x | sed -i s/a/b/').allowed, false)
  })

  it('full: 任意命令 → 放行', () => {
    assert.equal(checkBashPolicy('full', 'rm -rf / && curl evil.com').allowed, true)
  })
})

describe('GateEnforcer — file_scope 路径校验', () => {
  const scope = {
    allowed_paths: ['muse/src/', 'muse/docs/'],
    blocked_paths: ['muse/src/workflow/', 'muse/src/plugin/', 'AGENTS.md'],
  }

  it('allowed 路径 → 放行', () => {
    const r = checkFilePath('edit', { filePath: `${WORKSPACE}/muse/src/foo.mjs` }, scope, WORKSPACE)
    assert.equal(r.allowed, true)
  })

  it('blocked 路径 → 拦截', () => {
    const r = checkFilePath('edit', { filePath: `${WORKSPACE}/muse/src/workflow/runtime.mjs` }, scope, WORKSPACE)
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('blocked'))
  })

  it('AGENTS.md → 拦截', () => {
    const r = checkFilePath('edit', { filePath: `${WORKSPACE}/AGENTS.md` }, scope, WORKSPACE)
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('blocked'))
  })

  it('超出工作区 → 拦截', () => {
    const r = checkFilePath('edit', { filePath: '/etc/passwd' }, scope, WORKSPACE)
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('超出'))
  })

  it('不在 allowed 范围 → 拦截', () => {
    const r = checkFilePath('edit', { filePath: `${WORKSPACE}/package.json` }, scope, WORKSPACE)
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('allowed_paths'))
  })

  it('无 filePath → 拦截', () => {
    const r = checkFilePath('edit', {}, scope, WORKSPACE)
    assert.equal(r.allowed, false)
  })
})

describe('GateEnforcer — apply_patch 多文件', () => {
  const scope = {
    allowed_paths: ['muse/src/'],
    blocked_paths: ['muse/src/workflow/'],
  }

  it('单文件 allowed → 放行', () => {
    const patch = '--- a/muse/src/foo.mjs\n+++ b/muse/src/foo.mjs\n@@ -1 +1 @@\n-old\n+new'
    const r = checkFilePath('apply_patch', { patch }, scope, WORKSPACE)
    assert.equal(r.allowed, true)
  })

  it('单文件 blocked → 拦截', () => {
    const patch = '--- a/muse/src/workflow/x.mjs\n+++ b/muse/src/workflow/x.mjs\n'
    const r = checkFilePath('apply_patch', { patch }, scope, WORKSPACE)
    assert.equal(r.allowed, false)
  })

  it('多文件全部 allowed → 放行', () => {
    const patch = '--- a/muse/src/a.mjs\n+++ b/muse/src/a.mjs\n--- a/muse/src/b.mjs\n+++ b/muse/src/b.mjs\n'
    const r = checkFilePath('apply_patch', { patch }, scope, WORKSPACE)
    assert.equal(r.allowed, true)
  })

  it('多文件有一个 blocked → 原子拒绝', () => {
    const patch = '--- a/muse/src/a.mjs\n+++ b/muse/src/a.mjs\n--- a/muse/src/workflow/x.mjs\n+++ b/muse/src/workflow/x.mjs\n'
    const r = checkFilePath('apply_patch', { patch }, scope, WORKSPACE)
    assert.equal(r.allowed, false)
    assert.ok(r.reason.includes('blocked'))
  })

  it('空 patch → 拦截', () => {
    const r = checkFilePath('apply_patch', { patch: '' }, scope, WORKSPACE)
    assert.equal(r.allowed, false)
  })
})

describe('extractTargetPaths', () => {
  it('edit → filePath', () => {
    assert.deepEqual(extractTargetPaths('edit', { filePath: '/a/b.mjs' }), ['/a/b.mjs'])
  })

  it('write → filePath', () => {
    assert.deepEqual(extractTargetPaths('write', { filePath: '/a/c.mjs' }), ['/a/c.mjs'])
  })

  it('edit → file_path (alternative)', () => {
    assert.deepEqual(extractTargetPaths('edit', { file_path: '/a/d.mjs' }), ['/a/d.mjs'])
  })

  it('unknown tool → empty', () => {
    assert.deepEqual(extractTargetPaths('bash', { command: 'echo hi' }), [])
  })
})

describe('parsePatchPaths', () => {
  it('unified diff → 提取路径', () => {
    const patch = '--- a/muse/src/foo.mjs\n+++ b/muse/src/foo.mjs\n'
    const paths = parsePatchPaths(patch)
    assert.deepEqual(paths, ['muse/src/foo.mjs'])
  })

  it('多文件 patch → 去重', () => {
    const patch = '--- a/a.mjs\n+++ b/a.mjs\n--- a/b.mjs\n+++ b/b.mjs\n'
    const paths = parsePatchPaths(patch)
    assert.ok(paths.includes('a.mjs'))
    assert.ok(paths.includes('b.mjs'))
  })

  it('空 patch → 空数组', () => {
    assert.deepEqual(parsePatchPaths(''), [])
  })
})
