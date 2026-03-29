/**
 * Learning Assistant — Context Index
 * 
 * Scans local learning materials and builds a simple searchable index.
 * V0: No vector database, just filename/title/headings/keywords matching.
 * 
 * Scanned directories:
 * - muse/user/foundations/
 * - muse/user/unit01-agent-core/
 * - muse/user/unit02-multi-agent/
 * - muse/user/unit03-state-memory/
 * - muse/user/unit04-prompt-eng/
 */

import { readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '../../../../src/logger.mjs'

const log = createLogger('context-index')

/** Base path: muse/ */
const PROJECT_ROOT = join(import.meta.dirname, '..', '..', '..', '..')

/** Directories to scan */
const SCAN_DIRS = [
  'user/foundations',
  'user/unit01-agent-core',
  'user/unit02-multi-agent',
  'user/unit03-state-memory',
  'user/unit04-prompt-eng',
]

/** Keywords mapping for better search */
const KEYWORDS_MAP = {
  // Foundations
  'F1': ['LLM', 'intro', 'overview', 'CoT', 'DeepSeek', 'o1'],
  'F2': ['Transformer', 'GPT', 'Self-Attention', 'attention', 'QKV', 'position'],
  'F3': ['GPT', 'training', 'inference', 'forward', 'backward'],
  'F4': ['LLM', 'overview', 'architecture'],
  'F5': ['neural', 'visualization', 'understanding'],
  'F6': ['prompt', 'engineering', 'few-shot'],
  'F7': ['LLM', 'systems', 'applications'],
  'F8': ['RAG', 'retrieval', 'augmentation'],
  'F9': ['distillation', 'fine-tuning', 'LoRA', 'QLoRA'],
  'F10': ['local', 'deploy', 'GGUF', 'quantization', 'llama.cpp', 'ollama'],
  'F11': ['tokenization', 'tokenizer', 'BPE'],
  'F12': ['eval', 'benchmarks', 'testing'],
  'F13': ['inference', 'optimization', 'performance'],
  'F14': ['multimodal', 'vision', 'audio'],
  'F15': ['AI', 'safety', 'alignment'],
  
  // Unit keywords
  'unit01': ['Agent', 'BEA', 'ReAct', 'Weng', 'orchestration'],
  'unit02': ['multi-agent', 'orchestrator', 'Swarm', 'handoff'],
  'unit03': ['state', 'memory', 'state-machine', 'LangGraph', 'roles'],
  'unit04': ['prompt', 'engineering', 'layers', 'structure'],
}

/**
 * Document index item
 * @typedef {Object} IndexItem
 * @property {string} id - Unique identifier (filename without .md)
 * @property {string} title - Document title (from first # heading)
 * @property {string} path - Relative path from project root
 * @property {string} fullPath - Absolute file path
 * @property {string[]} headings - All level-1 and level-2 headings
 * @property {string[]} keywords - Extracted keywords
 * @property {string} preview - First 200 chars preview
 * @property {number} tokens - Estimated token count
 */

export class ContextIndex {
  /** @type {Map<string, IndexItem>} */
  #index = new Map()
  
  /** @type {string[]} */
  #scanDirs

  /**
   * @param {object} [opts]
   * @param {string[]} [opts.scanDirs] - Directories to scan
   */
  constructor(opts = {}) {
    this.#scanDirs = opts.scanDirs || SCAN_DIRS
  }

  /**
   * Build the index by scanning all configured directories
   * @returns {Promise<void>}
   */
  async build() {
    log.info('[context-index] Building index...')
    this.#index.clear()
    
    for (const dir of this.#scanDirs) {
      const fullPath = join(PROJECT_ROOT, dir)
      if (!existsSync(fullPath)) {
        log.warn(`[context-index] Directory not found: ${fullPath}`)
        continue
      }
      
      const files = readdirSync(fullPath, { withFileTypes: true })
        .filter(d => d.isFile() && d.name.endsWith('.md'))
        .map(d => d.name)
      
      for (const file of files) {
        const filePath = join(fullPath, file)
        const item = this.#parseFile(filePath, dir, file)
        if (item) {
          this.#index.set(item.id, item)
          log.debug(`[context-index] Indexed: ${item.id}`)
        }
      }
    }
    
    log.info(`[context-index] Index built: ${this.#index.size} documents`)
  }

  /**
   * Search the index
   * @param {string} query - Search query
   * @returns {Array<{ id: string, title: string, path: string, snippet: string, score: number }>}
   */
  search(query) {
    if (!query || query.trim().length === 0) {
      return []
    }
    
    const q = query.toLowerCase().trim()
    const results = []
    
    for (const [id, item] of this.#index) {
      const score = this.#scoreMatch(item, q)
      if (score > 0) {
        results.push({
          id: item.id,
          title: item.title,
          path: item.path,
          snippet: this.#extractSnippet(item, q),
          score,
        })
      }
    }
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score)
    
    return results
  }

  /**
   * Get a single document by ID
   * @param {string} id - Document ID
   * @returns {IndexItem | null}
   */
  get(id) {
    return this.#index.get(id) || null
  }

  /**
   * Get all indexed items
   * @returns {IndexItem[]}
   */
  getAll() {
    return Array.from(this.#index.values())
  }

  /**
   * Parse a markdown file and extract index data
   * @param {string} fullPath - Absolute file path
   * @param {string} dir - Relative directory
   * @param {string} file - Filename
   * @returns {IndexItem | null}
   */
  #parseFile(fullPath, dir, file) {
    try {
      const content = readFileSync(fullPath, 'utf-8')
      const lines = content.split('\n')
      
      // Extract title (first # heading)
      let title = file.replace('.md', '')
      const headings = []
      let foundTitle = false
      
      for (const line of lines) {
        if (!foundTitle && line.startsWith('# ')) {
          title = line.replace('# ', '').trim()
          foundTitle = true
        }
        if (line.startsWith('# ') || line.startsWith('## ')) {
          headings.push(line.replace(/^#+ /, '').trim())
        }
      }
      
      // Extract keywords from filename
      const fileId = file.replace('.md', '')
      let keywords = KEYWORDS_MAP[fileId] || []
      
      // Add keywords from KEYWORDS_MAP based on dir prefix
      if (dir.startsWith('unit')) {
        const unitKey = dir.split('/')[0] // e.g., 'unit01'
        keywords = [...keywords, ...(KEYWORDS_MAP[unitKey] || [])]
      }
      
      // Generate preview (first 200 non-empty chars)
      const preview = lines
        .filter(l => l.trim().length > 0 && !l.startsWith('#'))
        .slice(0, 5)
        .join(' ')
        .slice(0, 200)
        .trim()
      
      // Estimate tokens (rough: 4 chars ≈ 1 token)
      const tokens = Math.ceil(content.length / 4)
      
      return {
        id: fileId,
        title,
        path: join(dir, file),
        fullPath,
        headings,
        keywords,
        preview,
        tokens,
      }
    } catch (e) {
      log.error(`[context-index] Failed to parse ${fullPath}: ${e.message}`)
      return null
    }
  }

  /**
   * Score how well a document matches a query
   * @param {IndexItem} item - Document item
   * @param {string} q - Lowercase query
   * @returns {number}
   */
  #scoreMatch(item, q) {
    let score = 0
    
    // Filename/ID match (highest priority)
    if (item.id.toLowerCase().includes(q)) {
      score += 100
    }
    
    // Title match
    const titleLower = item.title.toLowerCase()
    if (titleLower.includes(q)) {
      score += 50
      // Bonus for exact title match
      if (titleLower === q) score += 25
    }
    
    // Headings match
    for (const h of item.headings) {
      if (h.toLowerCase().includes(q)) {
        score += 20
        break
      }
    }
    
    // Keywords match
    for (const kw of item.keywords) {
      if (kw.toLowerCase().includes(q)) {
        score += 15
        break
      }
    }
    
    // Preview match (lower priority)
    if (item.preview.toLowerCase().includes(q)) {
      score += 5
    }
    
    return score
  }

  /**
   * Extract a snippet showing the query context
   * @param {IndexItem} item - Document item
   * @param {string} q - Lowercase query
   * @returns {string}
   */
  #extractSnippet(item, q) {
    // Try to find query in preview first
    const previewLower = item.preview.toLowerCase()
    const idx = previewLower.indexOf(q)
    
    if (idx >= 0) {
      const start = Math.max(0, idx - 20)
      const end = Math.min(item.preview.length, idx + q.length + 80)
      return (start > 0 ? '...' : '') + 
             item.preview.slice(start, end) + 
             (end < item.preview.length ? '...' : '')
    }
    
    // Fallback: return preview
    return item.preview.slice(0, 150) + (item.preview.length > 150 ? '...' : '')
  }
}

/**
 * Ensure notes directory exists
 * @returns {string} Notes directory path
 */
export function ensureNotesDir() {
  const notesDir = join(PROJECT_ROOT, 'user/projects/learning-assistant/notes')
  if (!existsSync(notesDir)) {
    mkdirSync(notesDir, { recursive: true })
    log.info(`[context-index] Created notes directory: ${notesDir}`)
  }
  return notesDir
}

// Export singleton for convenience
export const contextIndex = new ContextIndex()
