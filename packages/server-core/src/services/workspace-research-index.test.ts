import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  rebuildWorkspaceResearchIndex,
  searchWorkspaceResearchIndex,
} from './workspace-research-index'

let testRoot = ''
let workspaceRoot = ''

beforeEach(() => {
  testRoot = mkdtempSync(join(tmpdir(), 'rocket-research-index-'))
  workspaceRoot = join(testRoot, 'workspace')
  mkdirSync(join(workspaceRoot, 'notes'), { recursive: true })
  mkdirSync(join(workspaceRoot, 'documents'), { recursive: true })
})

afterEach(() => {
  if (testRoot && existsSync(testRoot)) rmSync(testRoot, { recursive: true, force: true })
})

describe('workspace research index', () => {
  it('searches notes and documents with deterministic relevance and snippets', async () => {
    writeFileSync(join(workspaceRoot, 'notes', '贵州茅台跟踪.md'), '# 贵州茅台\n毛利率保持稳定，关注渠道库存。', 'utf-8')
    writeFileSync(join(workspaceRoot, 'documents', '白酒行业.md'), '# 行业资料\n贵州茅台的毛利率高于行业平均。', 'utf-8')

    const result = await searchWorkspaceResearchIndex(workspaceRoot, {
      workspaceId: 'workspace-1',
      query: '贵州茅台 毛利率',
    })

    expect(result.indexedFiles).toBe(2)
    expect(result.refreshedFiles).toBe(2)
    expect(result.total).toBe(2)
    expect(result.hits[0]?.relativePath).toBe('notes/贵州茅台跟踪.md')
    expect(result.hits[0]?.snippet).toContain('毛利率')
  })

  it('incrementally refreshes changed files and removes deleted entries', async () => {
    const notePath = join(workspaceRoot, 'notes', 'company.md')
    const materialPath = join(workspaceRoot, 'documents', 'sector.md')
    writeFileSync(notePath, 'old thesis', 'utf-8')
    writeFileSync(materialPath, 'sector evidence', 'utf-8')
    await searchWorkspaceResearchIndex(workspaceRoot, { workspaceId: 'workspace-1', query: 'old' })

    writeFileSync(notePath, 'new thesis with catalyst', 'utf-8')
    const future = new Date(Date.now() + 2_000)
    utimesSync(notePath, future, future)
    rmSync(materialPath)
    const updated = await searchWorkspaceResearchIndex(workspaceRoot, { workspaceId: 'workspace-1', query: 'catalyst' })

    expect(updated.refreshedFiles).toBe(1)
    expect(updated.indexedFiles).toBe(1)
    expect(updated.hits.map(hit => hit.relativePath)).toEqual(['notes/company.md'])
  })

  it('rebuilds completely from source files when the derived cache is missing', async () => {
    writeFileSync(join(workspaceRoot, 'notes', 'memo.md'), 'rebuildable alpha', 'utf-8')
    const first = await rebuildWorkspaceResearchIndex(workspaceRoot, 'workspace-1')
    rmSync(join(workspaceRoot, '.rocket'), { recursive: true, force: true })
    const second = await searchWorkspaceResearchIndex(workspaceRoot, { workspaceId: 'workspace-1', query: 'alpha' })

    expect(first.indexedFiles).toBe(1)
    expect(second.indexedFiles).toBe(1)
    expect(second.hits[0]?.relativePath).toBe('notes/memo.md')
  })
})
