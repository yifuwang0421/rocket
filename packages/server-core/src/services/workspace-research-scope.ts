import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type {
  CreateResearchScopeFolderEntryInput,
  ResearchAttentionLevel,
  ResearchProgressStatus,
  ResearchScopeKind,
  SectorItem,
  UpsertSectorItemInput,
  UpsertWatchlistItemInput,
  WatchlistItem,
  WorkspaceResearchFileKind,
  WorkspaceResearchFolderEntry,
  WorkspaceResearchFolderList,
  WorkspaceResearchScope,
  WorkspaceFileImportResult,
} from '@rocket/shared/protocol'
import { importFilesToWorkspaceDirectory } from './workspace-research-files'

const SCHEMA_VERSION = 3 as const
const LEGACY_SCHEMA_VERSION = 1 as const
const SUFFIXED_FOLDER_SCHEMA_VERSION = 2 as const
const SCOPE_RELATIVE_PATH = join('research', 'scope.json')
const MAX_SCOPE_BYTES = 2 * 1024 * 1024
const MAX_FOLDER_ENTRIES = 2_000
const WATCHLIST_FOLDER_ROOT = ['documents', '自选股'] as const
const SECTOR_FOLDER_ROOT = ['documents', '行业板块'] as const
const WATCHLIST_DEFAULT_FOLDERS = ['公告', '模型', '研报', '纪要', '其他'] as const
const VALID_STATUSES = new Set<ResearchProgressStatus>(['not-started', 'tracking', 'in-progress', 'review', 'complete', 'paused'])
const VALID_ATTENTION = new Set<ResearchAttentionLevel>(['core', 'high', 'normal', 'low'])

type LegacyWatchlistItem = Omit<WatchlistItem, 'folderPath'> & { folderPath?: string }
type LegacySectorItem = Omit<SectorItem, 'folderPath'> & { folderPath?: string }

interface ParsedResearchScope {
  schemaVersion: 1 | 2 | 3
  watchlist: LegacyWatchlistItem[]
  sectors: LegacySectorItem[]
}

interface PersistedResearchScope {
  schemaVersion: 3
  watchlist: WatchlistItem[]
  sectors: SectorItem[]
}

export class WorkspaceResearchScopeError extends Error {
  constructor(public readonly code: 'INVALID_SCOPE' | 'VERSION_CONFLICT' | 'NOT_FOUND' | 'ALREADY_EXISTS', message: string) {
    super(message)
    this.name = 'WorkspaceResearchScopeError'
  }
}

function hash(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

function emptyPersistedScope(): PersistedResearchScope {
  return { schemaVersion: SCHEMA_VERSION, watchlist: [], sectors: [] }
}

function serialize(scope: PersistedResearchScope): string {
  return `${JSON.stringify(scope, null, 2)}\n`
}

function cleanText(value: unknown, field: string, maxLength = 4_000): string {
  if (typeof value !== 'string') throw new WorkspaceResearchScopeError('INVALID_SCOPE', `${field} must be a string`)
  const normalized = value.trim()
  if (normalized.length > maxLength) throw new WorkspaceResearchScopeError('INVALID_SCOPE', `${field} is too long`)
  return normalized
}

function cleanStringList(value: unknown, field: string, maxItems = 100): string[] {
  if (!Array.isArray(value)) throw new WorkspaceResearchScopeError('INVALID_SCOPE', `${field} must be an array`)
  if (value.length > maxItems) throw new WorkspaceResearchScopeError('INVALID_SCOPE', `${field} has too many entries`)
  return [...new Set(value.map((entry, index) => cleanText(entry, `${field}[${index}]`, 500)).filter(Boolean))]
}

function cleanTimestamp(value: unknown, field: string, optional = false): number | undefined {
  if (optional && value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', `${field} must be a valid timestamp`)
  }
  return value
}

function cleanFolderPath(value: unknown, field: string, optional: boolean): string | undefined {
  if (optional && value === undefined) return undefined
  const normalized = cleanText(value, field, 500).replace(/\\/g, '/')
  if (!normalized || isAbsolute(normalized) || normalized.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', `${field} must be a safe Workspace-relative folder path`)
  }
  return normalized
}

function normalizeWatchlistItem(value: unknown, legacy = false): LegacyWatchlistItem {
  if (!value || typeof value !== 'object') throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'watchlist item must be an object')
  const item = value as Record<string, unknown>
  const status = cleanText(item.status, 'watchlist.status', 40) as ResearchProgressStatus
  if (!VALID_STATUSES.has(status)) throw new WorkspaceResearchScopeError('INVALID_SCOPE', `Unsupported research status: ${status}`)
  return {
    id: cleanText(item.id, 'watchlist.id', 120),
    ...(legacy && item.folderPath === undefined ? {} : { folderPath: cleanFolderPath(item.folderPath, 'watchlist.folderPath', false)! }),
    name: cleanText(item.name, 'watchlist.name', 200),
    code: cleanText(item.code, 'watchlist.code', 80),
    market: cleanText(item.market, 'watchlist.market', 80),
    group: cleanText(item.group, 'watchlist.group', 120),
    status,
    tags: cleanStringList(item.tags, 'watchlist.tags', 30),
    thesis: cleanText(item.thesis, 'watchlist.thesis'),
    relatedResources: cleanStringList(item.relatedResources, 'watchlist.relatedResources'),
    ...(item.lastResearchedAt === undefined ? {} : { lastResearchedAt: cleanTimestamp(item.lastResearchedAt, 'watchlist.lastResearchedAt', true) }),
    createdAt: cleanTimestamp(item.createdAt, 'watchlist.createdAt')!,
    updatedAt: cleanTimestamp(item.updatedAt, 'watchlist.updatedAt')!,
  }
}

function normalizeSectorItem(value: unknown, legacy = false): LegacySectorItem {
  if (!value || typeof value !== 'object') throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'sector item must be an object')
  const item = value as Record<string, unknown>
  const status = cleanText(item.status, 'sector.status', 40) as ResearchProgressStatus
  const attention = cleanText(item.attention, 'sector.attention', 40) as ResearchAttentionLevel
  if (!VALID_STATUSES.has(status)) throw new WorkspaceResearchScopeError('INVALID_SCOPE', `Unsupported research status: ${status}`)
  if (!VALID_ATTENTION.has(attention)) throw new WorkspaceResearchScopeError('INVALID_SCOPE', `Unsupported attention level: ${attention}`)
  return {
    id: cleanText(item.id, 'sector.id', 120),
    ...(legacy && item.folderPath === undefined ? {} : { folderPath: cleanFolderPath(item.folderPath, 'sector.folderPath', false)! }),
    name: cleanText(item.name, 'sector.name', 200),
    attention,
    status,
    thesis: cleanText(item.thesis, 'sector.thesis'),
    companyIds: cleanStringList(item.companyIds, 'sector.companyIds'),
    relatedResources: cleanStringList(item.relatedResources, 'sector.relatedResources'),
    ...(item.lastResearchedAt === undefined ? {} : { lastResearchedAt: cleanTimestamp(item.lastResearchedAt, 'sector.lastResearchedAt', true) }),
    createdAt: cleanTimestamp(item.createdAt, 'sector.createdAt')!,
    updatedAt: cleanTimestamp(item.updatedAt, 'sector.updatedAt')!,
  }
}

function parseScope(content: string): ParsedResearchScope {
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'research/scope.json is not valid JSON')
  }
  if (!value || typeof value !== 'object') throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Research scope must be an object')
  const scope = value as Record<string, unknown>
  if ((scope.schemaVersion !== LEGACY_SCHEMA_VERSION && scope.schemaVersion !== SUFFIXED_FOLDER_SCHEMA_VERSION && scope.schemaVersion !== SCHEMA_VERSION) || !Array.isArray(scope.watchlist) || !Array.isArray(scope.sectors)) {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Unsupported research scope schema')
  }
  const legacy = scope.schemaVersion === LEGACY_SCHEMA_VERSION
  const watchlist = scope.watchlist.map(item => normalizeWatchlistItem(item, legacy))
  const sectors = scope.sectors.map(item => normalizeSectorItem(item, legacy))
  if (new Set(watchlist.map(item => item.id)).size !== watchlist.length || new Set(sectors.map(item => item.id)).size !== sectors.length) {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Research scope contains duplicate IDs')
  }
  const companyIds = new Set(watchlist.map(item => item.id))
  if (sectors.some(sector => sector.companyIds.some(id => !companyIds.has(id)))) {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Sector relationships must reference current watchlist items')
  }
  return { schemaVersion: scope.schemaVersion, watchlist, sectors }
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function sanitizeFolderSegment(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[\x00-\x1f]/g, '')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 100)
  if (!sanitized) throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Research folder name is empty after sanitization')
  return sanitized
}

function createFolderPath(kind: ResearchScopeKind, item: { name: string; code?: string }): string {
  const root = kind === 'watchlist' ? WATCHLIST_FOLDER_ROOT : SECTOR_FOLDER_ROOT
  const label = kind === 'watchlist'
    ? `${sanitizeFolderSegment(item.name)}（${sanitizeFolderSegment(item.code ?? '')}）`
    : sanitizeFolderSegment(item.name)
  return [...root, label].join('/')
}

function assertStoredFolderPath(kind: ResearchScopeKind, folderPath: string): string[] {
  const normalized = cleanFolderPath(folderPath, `${kind}.folderPath`, false)!
  const segments = normalized.split('/')
  const expectedRoot = kind === 'watchlist' ? WATCHLIST_FOLDER_ROOT : SECTOR_FOLDER_ROOT
  if (segments.length !== expectedRoot.length + 1 || expectedRoot.some((segment, index) => segments[index] !== segment)) {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', `${kind} folder must be inside ${expectedRoot.join('/')}`)
  }
  return segments
}

async function ensureRegularDirectoryChain(workspaceRoot: string, segments: string[]): Promise<{ absolutePath: string; createdLeaf: boolean }> {
  await mkdir(workspaceRoot, { recursive: true })
  const realRoot = await realpath(workspaceRoot)
  let current = realRoot
  let createdLeaf = false
  for (const [index, segment] of segments.entries()) {
    current = join(current, segment)
    try {
      const info = await lstat(current)
      if (info.isSymbolicLink() || !info.isDirectory()) {
        throw new WorkspaceResearchScopeError('INVALID_SCOPE', `${segments.slice(0, index + 1).join('/')} must be a regular directory`)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      await mkdir(current)
      if (index === segments.length - 1) createdLeaf = true
    }
    if (!isInside(realRoot, current)) throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Research folder escapes the Workspace')
  }
  return { absolutePath: current, createdLeaf }
}

async function ensureItemFolder(workspaceRoot: string, kind: ResearchScopeKind, folderPath: string, createDefaults: boolean): Promise<{ absolutePath: string; createdLeaf: boolean }> {
  const result = await ensureRegularDirectoryChain(workspaceRoot, assertStoredFolderPath(kind, folderPath))
  if (kind === 'watchlist' && createDefaults) {
    for (const folderName of WATCHLIST_DEFAULT_FOLDERS) {
      const childPath = join(result.absolutePath, folderName)
      try {
        const info = await lstat(childPath)
        if (info.isSymbolicLink() || !info.isDirectory()) {
          throw new WorkspaceResearchScopeError('INVALID_SCOPE', `${folderPath}/${folderName} must be a regular directory`)
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        await mkdir(childPath)
      }
    }
  }
  return result
}

async function readRegularDirectory(path: string, label: string): Promise<boolean> {
  try {
    const info = await lstat(path)
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new WorkspaceResearchScopeError('INVALID_SCOPE', `${label} must be a regular directory`)
    }
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function migrateItemFolder(
  workspaceRoot: string,
  kind: ResearchScopeKind,
  sourceFolderPath: string | undefined,
  targetFolderPath: string,
  createDefaults: boolean,
): Promise<void> {
  const targetSegments = assertStoredFolderPath(kind, targetFolderPath)
  const expectedRoot = kind === 'watchlist' ? WATCHLIST_FOLDER_ROOT : SECTOR_FOLDER_ROOT
  const rootFolder = await ensureRegularDirectoryChain(workspaceRoot, [...expectedRoot])
  const realRoot = await realpath(workspaceRoot)
  const targetPath = resolve(realRoot, ...targetSegments)

  if (sourceFolderPath && sourceFolderPath !== targetFolderPath) {
    const sourceSegments = assertStoredFolderPath(kind, sourceFolderPath)
    const sourcePath = resolve(realRoot, ...sourceSegments)
    const sourceExists = await readRegularDirectory(sourcePath, sourceFolderPath)
    const targetExists = await readRegularDirectory(targetPath, targetFolderPath)
    if (sourceExists && targetExists) {
      throw new WorkspaceResearchScopeError('ALREADY_EXISTS', `Cannot rename ${sourceFolderPath}; ${targetFolderPath} already exists`)
    }
    if (sourceExists) await rename(sourcePath, targetPath)
  }

  if (!isInside(realRoot, targetPath) || !isInside(realRoot, rootFolder.absolutePath)) {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Research folder escapes the Workspace')
  }
  await ensureItemFolder(workspaceRoot, kind, targetFolderPath, createDefaults)
}

function assertUniqueFolderPaths(items: Array<{ folderPath: string }>, kind: ResearchScopeKind): void {
  const normalized = items.map(item => item.folderPath.toLocaleLowerCase('en-US'))
  if (new Set(normalized).size !== normalized.length) {
    throw new WorkspaceResearchScopeError('ALREADY_EXISTS', `Two ${kind} items cannot use the same research folder`)
  }
}

function classifyFolderFile(path: string): WorkspaceResearchFileKind {
  switch (extname(path).toLowerCase()) {
    case '.md':
    case '.markdown': return 'markdown'
    case '.pdf': return 'pdf'
    case '.html':
    case '.htm': return 'html'
    case '.docx': return 'docx'
    case '.xlsx': return 'xlsx'
    default: return 'other'
  }
}

async function resolveScopePath(workspaceRoot: string): Promise<string> {
  const researchDir = join(workspaceRoot, 'research')
  try {
    const stats = await lstat(researchDir)
    if (stats.isSymbolicLink() || !stats.isDirectory()) throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'research must be a regular directory')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await mkdir(researchDir, { recursive: true })
  }
  const scopePath = join(workspaceRoot, SCOPE_RELATIVE_PATH)
  try {
    const stats = await lstat(scopePath)
    if (stats.isSymbolicLink() || !stats.isFile()) throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'research/scope.json must be a regular file')
    if (stats.size > MAX_SCOPE_BYTES) throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Research scope file is too large')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return scopePath
}

async function readPersistedScope(workspaceRoot: string): Promise<{ scope: ParsedResearchScope; revision: string }> {
  const scopePath = await resolveScopePath(workspaceRoot)
  try {
    const content = await readFile(scopePath, 'utf8')
    return { scope: parseScope(content), revision: hash(content) }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    const content = serialize(emptyPersistedScope())
    return { scope: emptyPersistedScope(), revision: hash(content) }
  }
}

async function writeScope(workspaceRoot: string, scope: PersistedResearchScope, expectedRevision: string): Promise<WorkspaceResearchScope> {
  const current = await readPersistedScope(workspaceRoot)
  if (current.revision !== expectedRevision) throw new WorkspaceResearchScopeError('VERSION_CONFLICT', 'Research scope changed after it was opened')
  const scopePath = await resolveScopePath(workspaceRoot)
  const content = serialize(scope)
  const tempPath = join(dirname(scopePath), `.scope.${randomUUID()}.tmp`)
  try {
    await writeFile(tempPath, content, { encoding: 'utf8', flag: 'wx' })
    await rename(tempPath, scopePath)
  } finally {
    await unlink(tempPath).catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    })
  }
  return { ...scope, revision: hash(content) }
}

export async function getWorkspaceResearchScope(workspaceRoot: string): Promise<WorkspaceResearchScope> {
  const current = await readPersistedScope(workspaceRoot)
  const requiresMigration = current.scope.schemaVersion !== SCHEMA_VERSION
    || current.scope.watchlist.some(item => !item.folderPath)
    || current.scope.sectors.some(item => !item.folderPath)
  if (!requiresMigration) return { ...(current.scope as PersistedResearchScope), revision: current.revision }

  const watchlist: WatchlistItem[] = current.scope.watchlist.map(item => ({
    ...item,
    folderPath: createFolderPath('watchlist', item),
  }))
  const sectors: SectorItem[] = current.scope.sectors.map(item => ({
    ...item,
    folderPath: createFolderPath('sector', item),
  }))
  assertUniqueFolderPaths(watchlist, 'watchlist')
  assertUniqueFolderPaths(sectors, 'sector')
  for (const [index, item] of watchlist.entries()) {
    await migrateItemFolder(workspaceRoot, 'watchlist', current.scope.watchlist[index]?.folderPath, item.folderPath, true)
  }
  for (const [index, item] of sectors.entries()) {
    await migrateItemFolder(workspaceRoot, 'sector', current.scope.sectors[index]?.folderPath, item.folderPath, false)
  }
  try {
    return await writeScope(workspaceRoot, { schemaVersion: SCHEMA_VERSION, watchlist, sectors }, current.revision)
  } catch (error) {
    if (error instanceof WorkspaceResearchScopeError && error.code === 'VERSION_CONFLICT') {
      const migrated = await readPersistedScope(workspaceRoot)
      if (migrated.scope.schemaVersion === SCHEMA_VERSION && migrated.scope.watchlist.every(item => item.folderPath) && migrated.scope.sectors.every(item => item.folderPath)) {
        return { ...(migrated.scope as PersistedResearchScope), revision: migrated.revision }
      }
    }
    throw error
  }
}

export async function upsertWorkspaceWatchlistItem(workspaceRoot: string, input: Omit<UpsertWatchlistItemInput, 'workspaceId'>): Promise<WorkspaceResearchScope> {
  const current = await getWorkspaceResearchScope(workspaceRoot)
  if (current.revision !== input.expectedRevision) throw new WorkspaceResearchScopeError('VERSION_CONFLICT', 'Research scope changed after it was opened')
  const now = Date.now()
  const existing = input.item.id ? current.watchlist.find(item => item.id === input.item.id) : undefined
  if (input.item.id && !existing) throw new WorkspaceResearchScopeError('NOT_FOUND', 'Watchlist item was not found')
  const id = existing?.id ?? randomUUID()
  const folderPath = existing?.folderPath ?? createFolderPath('watchlist', { name: input.item.name, code: input.item.code })
  if (!existing && current.watchlist.some(entry => entry.folderPath.toLocaleLowerCase('en-US') === folderPath.toLocaleLowerCase('en-US'))) {
    throw new WorkspaceResearchScopeError('ALREADY_EXISTS', 'A company with the same research folder already exists')
  }
  const item = normalizeWatchlistItem({ ...input.item, id, folderPath, createdAt: existing?.createdAt ?? now, updatedAt: now }) as WatchlistItem
  const watchlist = existing
    ? current.watchlist.map(entry => entry.id === item.id ? item : entry)
    : [...current.watchlist, item]
  const folder = await ensureItemFolder(workspaceRoot, 'watchlist', item.folderPath, !existing)
  try {
    return await writeScope(workspaceRoot, { schemaVersion: SCHEMA_VERSION, watchlist, sectors: current.sectors }, input.expectedRevision)
  } catch (error) {
    if (!existing && folder.createdLeaf) await rm(folder.absolutePath, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

export async function upsertWorkspaceSectorItem(workspaceRoot: string, input: Omit<UpsertSectorItemInput, 'workspaceId'>): Promise<WorkspaceResearchScope> {
  const current = await getWorkspaceResearchScope(workspaceRoot)
  if (current.revision !== input.expectedRevision) throw new WorkspaceResearchScopeError('VERSION_CONFLICT', 'Research scope changed after it was opened')
  const now = Date.now()
  const existing = input.item.id ? current.sectors.find(item => item.id === input.item.id) : undefined
  if (input.item.id && !existing) throw new WorkspaceResearchScopeError('NOT_FOUND', 'Sector item was not found')
  const id = existing?.id ?? randomUUID()
  const folderPath = existing?.folderPath ?? createFolderPath('sector', { name: input.item.name })
  if (!existing && current.sectors.some(entry => entry.folderPath.toLocaleLowerCase('en-US') === folderPath.toLocaleLowerCase('en-US'))) {
    throw new WorkspaceResearchScopeError('ALREADY_EXISTS', 'An industry with the same research folder already exists')
  }
  const item = normalizeSectorItem({ ...input.item, id, folderPath, createdAt: existing?.createdAt ?? now, updatedAt: now }) as SectorItem
  const companyIds = new Set(current.watchlist.map(entry => entry.id))
  if (item.companyIds.some(id => !companyIds.has(id))) {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Sector relationships must reference current watchlist items')
  }
  const sectors = existing
    ? current.sectors.map(entry => entry.id === item.id ? item : entry)
    : [...current.sectors, item]
  const folder = await ensureItemFolder(workspaceRoot, 'sector', item.folderPath, false)
  try {
    return await writeScope(workspaceRoot, { schemaVersion: SCHEMA_VERSION, watchlist: current.watchlist, sectors }, input.expectedRevision)
  } catch (error) {
    if (!existing && folder.createdLeaf) await rm(folder.absolutePath, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

export async function removeWorkspaceResearchScopeItem(workspaceRoot: string, kind: 'watchlist' | 'sector', id: string, expectedRevision: string): Promise<WorkspaceResearchScope> {
  const current = await getWorkspaceResearchScope(workspaceRoot)
  if (current.revision !== expectedRevision) throw new WorkspaceResearchScopeError('VERSION_CONFLICT', 'Research scope changed after it was opened')
  const source = kind === 'watchlist' ? current.watchlist : current.sectors
  if (!source.some(item => item.id === id)) throw new WorkspaceResearchScopeError('NOT_FOUND', `Research ${kind} item was not found`)
  const scope: PersistedResearchScope = kind === 'watchlist'
    ? {
        schemaVersion: SCHEMA_VERSION,
        watchlist: current.watchlist.filter(item => item.id !== id),
        sectors: current.sectors.map(item => ({
          ...item,
          companyIds: item.companyIds.filter(companyId => companyId !== id),
        })),
      }
    : { schemaVersion: SCHEMA_VERSION, watchlist: current.watchlist, sectors: current.sectors.filter(item => item.id !== id) }
  return writeScope(workspaceRoot, scope, expectedRevision)
}

async function resolveExistingItemFolder(workspaceRoot: string, kind: ResearchScopeKind, folderPath: string): Promise<{ realRoot: string; absolutePath: string }> {
  const segments = assertStoredFolderPath(kind, folderPath)
  await mkdir(workspaceRoot, { recursive: true })
  const realRoot = await realpath(workspaceRoot)
  const candidate = resolve(realRoot, ...segments)
  if (!isInside(realRoot, candidate)) throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Research folder escapes the Workspace')
  let info
  try {
    info = await lstat(candidate)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new WorkspaceResearchScopeError('NOT_FOUND', `Research folder is missing: ${folderPath}`)
    }
    throw error
  }
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', `Research folder must be a regular directory: ${folderPath}`)
  }
  const resolvedPath = await realpath(candidate)
  if (!isInside(realRoot, resolvedPath)) throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Research folder resolves outside the Workspace')
  return { realRoot, absolutePath: resolvedPath }
}

export async function listWorkspaceResearchScopeFolder(workspaceRoot: string, kind: ResearchScopeKind, id: string): Promise<WorkspaceResearchFolderList> {
  const scope = await getWorkspaceResearchScope(workspaceRoot)
  const item = kind === 'watchlist'
    ? scope.watchlist.find(entry => entry.id === id)
    : scope.sectors.find(entry => entry.id === id)
  if (!item) throw new WorkspaceResearchScopeError('NOT_FOUND', `Research ${kind} item was not found`)
  const { realRoot, absolutePath } = await resolveExistingItemFolder(workspaceRoot, kind, item.folderPath)
  const entries: WorkspaceResearchFolderEntry[] = []
  const queue = [absolutePath]
  let truncated = false

  while (queue.length > 0) {
    const directory = queue.shift()!
    const children = await readdir(directory, { withFileTypes: true })
    children.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    for (const child of children) {
      if (entries.length >= MAX_FOLDER_ENTRIES) {
        truncated = true
        queue.length = 0
        break
      }
      if (child.name.startsWith('.') || child.isSymbolicLink()) continue
      const childPath = join(directory, child.name)
      const childInfo = await stat(childPath)
      const relativePath = relative(realRoot, childPath).split(sep).join('/')
      const parentRelativePath = relative(realRoot, directory).split(sep).join('/')
      if (child.isDirectory()) {
        entries.push({ name: child.name, relativePath, parentRelativePath, type: 'directory', modifiedAt: childInfo.mtimeMs })
        queue.push(childPath)
      } else if (child.isFile()) {
        entries.push({
          name: child.name,
          relativePath,
          parentRelativePath,
          type: 'file',
          kind: classifyFolderFile(childPath),
          size: childInfo.size,
          modifiedAt: childInfo.mtimeMs,
        })
      }
    }
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: 'base' })
  })
  return { folderPath: item.folderPath, entries, truncated }
}

export async function createWorkspaceResearchScopeFolderEntry(
  workspaceRoot: string,
  input: Omit<CreateResearchScopeFolderEntryInput, 'workspaceId'>,
): Promise<WorkspaceResearchFolderEntry> {
  const scope = await getWorkspaceResearchScope(workspaceRoot)
  const item = input.kind === 'watchlist'
    ? scope.watchlist.find(entry => entry.id === input.id)
    : scope.sectors.find(entry => entry.id === input.id)
  if (!item) throw new WorkspaceResearchScopeError('NOT_FOUND', `Research ${input.kind} item was not found`)

  const { realRoot, absolutePath: itemRoot } = await resolveExistingItemFolder(workspaceRoot, input.kind, item.folderPath)
  const parentRelativePath = cleanFolderPath(input.parentRelativePath.replace(/\/$/, ''), 'create.parentRelativePath', false)!
  if (parentRelativePath !== item.folderPath && !parentRelativePath.startsWith(`${item.folderPath}/`)) {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Create target must stay inside the research item folder')
  }
  const parentPath = resolve(realRoot, ...parentRelativePath.split('/'))
  if (!isInside(itemRoot, parentPath)) throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Create target escapes the research item folder')
  const parentExists = await readRegularDirectory(parentPath, parentRelativePath)
  if (!parentExists) throw new WorkspaceResearchScopeError('NOT_FOUND', `Folder does not exist: ${parentRelativePath}`)
  const realParent = await realpath(parentPath)
  if (!isInside(itemRoot, realParent)) throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Create target resolves outside the research item folder')

  let name = sanitizeFolderSegment(cleanText(input.name, 'create.name', 180))
  if (input.type === 'markdown') {
    const extension = extname(name).toLowerCase()
    if (extension && extension !== '.md' && extension !== '.markdown') {
      throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'New research files must use the .md or .markdown extension')
    }
    if (!extension) name += '.md'
  }
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(name)) {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'This name is reserved by Windows')
  }

  const targetPath = join(realParent, name)
  if (!isInside(itemRoot, targetPath)) throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Create target escapes the research item folder')
  try {
    if (input.type === 'directory') await mkdir(targetPath)
    else await writeFile(targetPath, '', { encoding: 'utf8', flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new WorkspaceResearchScopeError('ALREADY_EXISTS', `“${name}” already exists in this folder`)
    }
    throw error
  }

  const info = await stat(targetPath)
  return {
    name,
    relativePath: relative(realRoot, targetPath).split(sep).join('/'),
    parentRelativePath,
    type: input.type === 'directory' ? 'directory' : 'file',
    ...(input.type === 'markdown' ? { kind: 'markdown' as const, size: info.size } : {}),
    modifiedAt: info.mtimeMs,
  }
}

export async function importFilesToWorkspaceResearchScopeFolder(
  workspaceRoot: string,
  kind: ResearchScopeKind,
  id: string,
  targetRelativePath: string,
  sourcePaths: string[],
): Promise<WorkspaceFileImportResult> {
  const scope = await getWorkspaceResearchScope(workspaceRoot)
  const item = kind === 'watchlist'
    ? scope.watchlist.find(entry => entry.id === id)
    : scope.sectors.find(entry => entry.id === id)
  if (!item) throw new WorkspaceResearchScopeError('NOT_FOUND', `Research ${kind} item was not found`)
  await resolveExistingItemFolder(workspaceRoot, kind, item.folderPath)
  const normalizedTarget = cleanFolderPath(targetRelativePath.replace(/\/$/, ''), 'import.targetRelativePath', false)!
  if (normalizedTarget !== item.folderPath && !normalizedTarget.startsWith(`${item.folderPath}/`)) {
    throw new WorkspaceResearchScopeError('INVALID_SCOPE', 'Import target must stay inside the research item folder')
  }
  return importFilesToWorkspaceDirectory(workspaceRoot, normalizedTarget, sourcePaths)
}
