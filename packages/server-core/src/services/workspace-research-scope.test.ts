import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createWorkspaceResearchScopeFolderEntry,
  getWorkspaceResearchScope,
  importFilesToWorkspaceResearchScopeFolder,
  listWorkspaceResearchScopeFolder,
  removeWorkspaceResearchScopeItem,
  upsertWorkspaceSectorItem,
  upsertWorkspaceWatchlistItem,
} from './workspace-research-scope'

let root = ''

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rocket-research-scope-'))
})

afterEach(() => {
  if (root && existsSync(root)) rmSync(root, { recursive: true, force: true })
})

describe('workspace research scope', () => {
  it('starts empty without creating source data until the first mutation', async () => {
    const scope = await getWorkspaceResearchScope(root)
    expect(scope.watchlist).toEqual([])
    expect(scope.sectors).toEqual([])
    expect(existsSync(join(root, 'research', 'scope.json'))).toBe(false)
  })

  it('atomically creates and updates watchlist items with optimistic revisions', async () => {
    const initial = await getWorkspaceResearchScope(root)
    const created = await upsertWorkspaceWatchlistItem(root, {
      expectedRevision: initial.revision,
      item: {
        name: '贵州茅台', code: '600519', market: 'A股', group: '核心消费', status: 'tracking',
        tags: ['白酒', '高端消费'], thesis: '关注渠道库存与批价。', relatedResources: ['notes/茅台.md'],
      },
    })
    expect(created.watchlist).toHaveLength(1)
    expect(created.watchlist[0]?.id).toBeTruthy()
    expect(created.schemaVersion).toBe(3)
    expect(created.watchlist[0]?.folderPath).toBe('documents/自选股/贵州茅台（600519）')
    const companyFolder = join(root, ...created.watchlist[0]!.folderPath.split('/'))
    expect(readdirSync(companyFolder).sort()).toEqual(['公告', '其他', '模型', '研报', '纪要'].sort())
    expect(created.revision).not.toBe(initial.revision)

    const updated = await upsertWorkspaceWatchlistItem(root, {
      expectedRevision: created.revision,
      item: { ...created.watchlist[0]!, status: 'in-progress', thesis: '跟踪季度回款。' },
    })
    expect(updated.watchlist[0]).toMatchObject({ status: 'in-progress', thesis: '跟踪季度回款。' })
    expect(readFileSync(join(root, 'research', 'scope.json'), 'utf8')).toContain('贵州茅台')
  })

  it('manages sectors and requires the latest revision for removal', async () => {
    const initial = await getWorkspaceResearchScope(root)
    const created = await upsertWorkspaceSectorItem(root, {
      expectedRevision: initial.revision,
      item: {
        name: '半导体', attention: 'core', status: 'tracking', thesis: '关注先进制程与国产替代。',
        companyIds: [], relatedResources: ['documents/semiconductor.pdf'],
      },
    })
    const sectorFolder = join(root, ...created.sectors[0]!.folderPath.split('/'))
    expect(existsSync(sectorFolder)).toBe(true)
    expect(readdirSync(sectorFolder)).toEqual([])
    await expect(removeWorkspaceResearchScopeItem(root, 'sector', created.sectors[0]!.id, initial.revision))
      .rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
    const removed = await removeWorkspaceResearchScopeItem(root, 'sector', created.sectors[0]!.id, created.revision)
    expect(removed.sectors).toEqual([])
  })

  it('removes deleted companies from sector relationships', async () => {
    const initial = await getWorkspaceResearchScope(root)
    const withCompany = await upsertWorkspaceWatchlistItem(root, {
      expectedRevision: initial.revision,
      item: {
        name: 'Example Semiconductor', code: 'EXM', market: 'Test', group: 'Core',
        status: 'tracking', tags: [], thesis: 'Track capacity and product mix.', relatedResources: [],
      },
    })
    const companyId = withCompany.watchlist[0]!.id
    const withSector = await upsertWorkspaceSectorItem(root, {
      expectedRevision: withCompany.revision,
      item: {
        name: 'Semiconductors', attention: 'core', status: 'tracking',
        thesis: 'Track the cycle and supply chain.', companyIds: [companyId], relatedResources: [],
      },
    })

    const removed = await removeWorkspaceResearchScopeItem(root, 'watchlist', companyId, withSector.revision)
    expect(removed.watchlist).toEqual([])
    expect(removed.sectors[0]?.companyIds).toEqual([])
  })

  it('rejects stale update IDs and unknown company relationships', async () => {
    const initial = await getWorkspaceResearchScope(root)
    await expect(upsertWorkspaceWatchlistItem(root, {
      expectedRevision: initial.revision,
      item: {
        id: 'missing-company', name: 'Missing', code: 'MISS', market: 'Test', group: '',
        status: 'tracking', tags: [], thesis: '', relatedResources: [],
      },
    })).rejects.toMatchObject({ code: 'NOT_FOUND' })

    await expect(upsertWorkspaceSectorItem(root, {
      expectedRevision: initial.revision,
      item: {
        name: 'Invalid Sector', attention: 'normal', status: 'tracking', thesis: '',
        companyIds: ['missing-company'], relatedResources: [],
      },
    })).rejects.toMatchObject({ code: 'INVALID_SCOPE' })
  })

  it('lists and imports files inside the research item folder', async () => {
    const initial = await getWorkspaceResearchScope(root)
    const created = await upsertWorkspaceWatchlistItem(root, {
      expectedRevision: initial.revision,
      item: {
        name: 'Test Company', code: 'TEST', market: 'Test', group: '', status: 'tracking',
        tags: [], thesis: '', relatedResources: [],
      },
    })
    const item = created.watchlist[0]!
    const before = await listWorkspaceResearchScopeFolder(root, 'watchlist', item.id)
    expect(before.entries.filter(entry => entry.type === 'directory').map(entry => entry.name).sort())
      .toEqual(['公告', '其他', '模型', '研报', '纪要'].sort())

    const source = join(root, '行情.csv')
    writeFileSync(source, 'date,close\n2026-08-09,100', 'utf8')
    await importFilesToWorkspaceResearchScopeFolder(root, 'watchlist', item.id, `${item.folderPath}/研报`, [source])
    const after = await listWorkspaceResearchScopeFolder(root, 'watchlist', item.id)
    expect(after.entries).toContainEqual(expect.objectContaining({
      name: '行情.csv',
      parentRelativePath: `${item.folderPath}/研报`,
      type: 'file',
      kind: 'other',
    }))
    await expect(importFilesToWorkspaceResearchScopeFolder(root, 'watchlist', item.id, `${item.folderPath}/../escape`, [source]))
      .rejects.toMatchObject({ code: 'INVALID_SCOPE' })
  })

  it('creates folders and Markdown files inside the current research directory', async () => {
    const initial = await getWorkspaceResearchScope(root)
    const created = await upsertWorkspaceWatchlistItem(root, {
      expectedRevision: initial.revision,
      item: {
        name: 'Test Company', code: 'TEST', market: 'Test', group: '', status: 'tracking',
        tags: [], thesis: '', relatedResources: [],
      },
    })
    const item = created.watchlist[0]!
    const directory = await createWorkspaceResearchScopeFolderEntry(root, {
      kind: 'watchlist', id: item.id, parentRelativePath: item.folderPath, name: '财务模型', type: 'directory',
    })
    expect(directory).toMatchObject({ name: '财务模型', type: 'directory', parentRelativePath: item.folderPath })

    const markdown = await createWorkspaceResearchScopeFolderEntry(root, {
      kind: 'watchlist', id: item.id, parentRelativePath: directory.relativePath, name: '盈利预测', type: 'markdown',
    })
    expect(markdown).toMatchObject({ name: '盈利预测.md', type: 'file', kind: 'markdown', parentRelativePath: directory.relativePath })
    expect(readFileSync(join(root, ...markdown.relativePath.split('/')), 'utf8')).toBe('')

    await expect(createWorkspaceResearchScopeFolderEntry(root, {
      kind: 'watchlist', id: item.id, parentRelativePath: directory.relativePath, name: '盈利预测', type: 'markdown',
    })).rejects.toMatchObject({ code: 'ALREADY_EXISTS' })
    await expect(createWorkspaceResearchScopeFolderEntry(root, {
      kind: 'watchlist', id: item.id, parentRelativePath: directory.relativePath, name: '错误.txt', type: 'markdown',
    })).rejects.toMatchObject({ code: 'INVALID_SCOPE' })
    await expect(createWorkspaceResearchScopeFolderEntry(root, {
      kind: 'watchlist', id: item.id, parentRelativePath: `${item.folderPath}/../escape`, name: '越界', type: 'directory',
    })).rejects.toMatchObject({ code: 'INVALID_SCOPE' })
  })

  it('migrates schema v1 labels to real folders without losing metadata', async () => {
    mkdirSync(join(root, 'research'), { recursive: true })
    writeFileSync(join(root, 'research', 'scope.json'), JSON.stringify({
      schemaVersion: 1,
      watchlist: [{
        id: 'legacy-company', name: 'Legacy Co', code: 'OLD', market: 'Test', group: 'Legacy',
        status: 'tracking', tags: ['legacy'], thesis: 'Keep me', relatedResources: [],
        createdAt: 1, updatedAt: 2,
      }],
      sectors: [],
    }), 'utf8')

    const migrated = await getWorkspaceResearchScope(root)
    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.watchlist[0]).toMatchObject({ id: 'legacy-company', thesis: 'Keep me', tags: ['legacy'] })
    expect(existsSync(join(root, ...migrated.watchlist[0]!.folderPath.split('/'), '公告'))).toBe(true)
    expect(JSON.parse(readFileSync(join(root, 'research', 'scope.json'), 'utf8')).schemaVersion).toBe(3)
  })

  it('renames schema v2 folders without losing their files', async () => {
    const oldFolderPath = 'documents/自选股/Legacy Co（OLD）-legacyco'
    mkdirSync(join(root, ...oldFolderPath.split('/')), { recursive: true })
    writeFileSync(join(root, ...oldFolderPath.split('/'), '历史资料.md'), 'preserved', 'utf8')
    mkdirSync(join(root, 'research'), { recursive: true })
    writeFileSync(join(root, 'research', 'scope.json'), JSON.stringify({
      schemaVersion: 2,
      watchlist: [{
        id: 'legacy-company', folderPath: oldFolderPath, name: 'Legacy Co', code: 'OLD', market: 'Test', group: 'Legacy',
        status: 'tracking', tags: ['legacy'], thesis: 'Keep me', relatedResources: [], createdAt: 1, updatedAt: 2,
      }],
      sectors: [],
    }), 'utf8')

    const migrated = await getWorkspaceResearchScope(root)
    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.watchlist[0]?.folderPath).toBe('documents/自选股/Legacy Co（OLD）')
    expect(existsSync(join(root, ...oldFolderPath.split('/')))).toBe(false)
    expect(readFileSync(join(root, 'documents', '自选股', 'Legacy Co（OLD）', '历史资料.md'), 'utf8')).toBe('preserved')
  })

  it('rejects malformed source files without overwriting them', async () => {
    mkdirSync(join(root, 'research'), { recursive: true })
    writeFileSync(join(root, 'research', 'scope.json'), '{broken', 'utf8')
    await expect(getWorkspaceResearchScope(root)).rejects.toMatchObject({ code: 'INVALID_SCOPE' })
    expect(readFileSync(join(root, 'research', 'scope.json'), 'utf8')).toBe('{broken')
  })
})
