import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import type {
  WorkspaceResearchFileKind,
  WorkspaceResearchIndexRebuildResult,
  WorkspaceResearchSearchHit,
  WorkspaceResearchSearchInput,
  WorkspaceResearchSearchResult,
} from '@rocket/shared/protocol'
import {
  listWorkspaceResearchFiles,
  readWorkspaceResearchIndexSource,
} from './workspace-research-files'

const INDEX_SCHEMA_VERSION = 1 as const
const INDEX_RELATIVE_PATH = join('.rocket', 'cache', 'research-index-v1.json')
const INDEXABLE_KINDS = new Set<WorkspaceResearchFileKind>(['markdown', 'pdf', 'html', 'docx', 'xlsx'])
const MAX_INDEX_TEXT_CHARS = 2_000_000
const MAX_SEARCH_RESULTS = 100
const DEFAULT_SEARCH_RESULTS = 40

interface ResearchIndexEntry {
  name: string
  relativePath: string
  area: 'notes' | 'documents'
  kind: WorkspaceResearchFileKind
  size: number
  modifiedAt: number
  version: string
  text: string
  isTruncated: boolean
}

interface ResearchIndexFile {
  schemaVersion: typeof INDEX_SCHEMA_VERSION
  workspaceId: string
  updatedAt: number
  entries: ResearchIndexEntry[]
}

interface EnsureIndexResult {
  index: ResearchIndexFile
  refreshedFiles: number
  failedFiles: Array<{ relativePath: string; message: string }>
}

function isInside(basePath: string, candidatePath: string): boolean {
  const rel = relative(basePath, candidatePath)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

async function resolveIndexPath(workspaceRoot: string): Promise<string> {
  await mkdir(workspaceRoot, { recursive: true })
  const realRoot = await realpath(workspaceRoot)
  const cacheDirectory = join(realRoot, dirname(INDEX_RELATIVE_PATH))
  await mkdir(cacheDirectory, { recursive: true })
  const cacheInfo = await lstat(cacheDirectory)
  if (cacheInfo.isSymbolicLink()) throw new Error('Research index cache directory cannot be a symbolic link')
  const realCacheDirectory = await realpath(cacheDirectory)
  if (!isInside(realRoot, realCacheDirectory)) throw new Error('Research index cache resolves outside the workspace')
  return join(realCacheDirectory, 'research-index-v1.json')
}

function emptyIndex(workspaceId: string): ResearchIndexFile {
  return { schemaVersion: INDEX_SCHEMA_VERSION, workspaceId, updatedAt: 0, entries: [] }
}

function isIndexEntry(value: unknown): value is ResearchIndexEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<ResearchIndexEntry>
  return typeof entry.name === 'string'
    && typeof entry.relativePath === 'string'
    && (entry.area === 'notes' || entry.area === 'documents')
    && typeof entry.kind === 'string'
    && typeof entry.size === 'number'
    && typeof entry.modifiedAt === 'number'
    && typeof entry.version === 'string'
    && typeof entry.text === 'string'
    && typeof entry.isTruncated === 'boolean'
}

async function loadIndex(indexPath: string, workspaceId: string): Promise<ResearchIndexFile> {
  try {
    const parsed = JSON.parse(await readFile(indexPath, 'utf-8')) as Partial<ResearchIndexFile>
    if (parsed.schemaVersion !== INDEX_SCHEMA_VERSION || parsed.workspaceId !== workspaceId || !Array.isArray(parsed.entries)) {
      return emptyIndex(workspaceId)
    }
    return {
      schemaVersion: INDEX_SCHEMA_VERSION,
      workspaceId,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      entries: parsed.entries.filter(isIndexEntry),
    }
  } catch {
    return emptyIndex(workspaceId)
  }
}

async function persistIndex(indexPath: string, index: ResearchIndexFile): Promise<void> {
  const temporaryPath = `${indexPath}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, JSON.stringify(index), 'utf-8')
    await rename(temporaryPath, indexPath)
  } catch (error) {
    await unlink(temporaryPath).catch(() => {})
    throw error
  }
}

function normalizeIndexedText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function ensureWorkspaceResearchIndex(
  workspaceRoot: string,
  workspaceId: string,
  force = false,
): Promise<EnsureIndexResult> {
  const indexPath = await resolveIndexPath(workspaceRoot)
  const previous = force ? emptyIndex(workspaceId) : await loadIndex(indexPath, workspaceId)
  const previousByPath = new Map(previous.entries.map(entry => [entry.relativePath, entry]))
  const [notes, documents] = await Promise.all([
    listWorkspaceResearchFiles(workspaceRoot, 'notes'),
    listWorkspaceResearchFiles(workspaceRoot, 'documents'),
  ])
  const files = [...notes.entries, ...documents.entries]
    .filter(entry => INDEXABLE_KINDS.has(entry.kind))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  const entries: ResearchIndexEntry[] = []
  const failedFiles: Array<{ relativePath: string; message: string }> = []
  let refreshedFiles = 0

  for (const file of files) {
    const cached = previousByPath.get(file.relativePath)
    if (!force && cached && cached.size === file.size && cached.modifiedAt === file.modifiedAt) {
      entries.push(cached)
      continue
    }

    try {
      const source = await readWorkspaceResearchIndexSource(workspaceRoot, workspaceId, file.relativePath)
      const normalizedText = normalizeIndexedText(source.text)
      entries.push({
        name: file.name,
        relativePath: file.relativePath,
        area: file.area,
        kind: file.kind,
        size: file.size,
        modifiedAt: file.modifiedAt,
        version: source.context.version,
        text: normalizedText.slice(0, MAX_INDEX_TEXT_CHARS),
        isTruncated: normalizedText.length > MAX_INDEX_TEXT_CHARS,
      })
      refreshedFiles += 1
    } catch (error) {
      failedFiles.push({
        relativePath: file.relativePath,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const hasStructuralChange = entries.length !== previous.entries.length
    || entries.some((entry, index) => entry.relativePath !== previous.entries[index]?.relativePath)
  const changed = force || refreshedFiles > 0 || failedFiles.length > 0 || hasStructuralChange || previous.updatedAt === 0
  const index: ResearchIndexFile = {
    schemaVersion: INDEX_SCHEMA_VERSION,
    workspaceId,
    updatedAt: changed ? Date.now() : previous.updatedAt,
    entries,
  }
  if (changed) await persistIndex(indexPath, index)
  return { index, refreshedFiles, failedFiles }
}

function queryTerms(query: string): string[] {
  return [...new Set(query.toLocaleLowerCase().split(/[\s,，。；;、]+/).map(term => term.trim()).filter(Boolean))]
}

function scoreEntry(entry: ResearchIndexEntry, terms: string[]): number | null {
  const name = entry.name.toLocaleLowerCase()
  const path = entry.relativePath.toLocaleLowerCase()
  const text = entry.text.toLocaleLowerCase()
  if (!terms.every(term => name.includes(term) || path.includes(term) || text.includes(term))) return null

  let score = 0
  for (const term of terms) {
    if (name === term) score += 120
    else if (name.includes(term)) score += 70
    if (path.includes(term)) score += 25
    const first = text.indexOf(term)
    if (first >= 0) score += 12 + Math.max(0, 8 - Math.floor(first / 5000))
  }
  return score
}

function createSnippet(entry: ResearchIndexEntry, terms: string[]): string {
  const lower = entry.text.toLocaleLowerCase()
  const positions = terms.map(term => lower.indexOf(term)).filter(position => position >= 0)
  if (positions.length === 0) return entry.text.slice(0, 220)
  const start = Math.max(0, Math.min(...positions) - 80)
  const end = Math.min(entry.text.length, start + 260)
  return `${start > 0 ? '…' : ''}${entry.text.slice(start, end).replace(/\s+/g, ' ')}${end < entry.text.length ? '…' : ''}`
}

export async function searchWorkspaceResearchIndex(
  workspaceRoot: string,
  input: WorkspaceResearchSearchInput,
): Promise<WorkspaceResearchSearchResult> {
  const query = input.query.trim()
  const ensured = await ensureWorkspaceResearchIndex(workspaceRoot, input.workspaceId)
  const terms = queryTerms(query)
  const limit = Math.max(1, Math.min(MAX_SEARCH_RESULTS, Math.floor(input.limit ?? DEFAULT_SEARCH_RESULTS)))
  const matches: WorkspaceResearchSearchHit[] = terms.length === 0 ? [] : ensured.index.entries
    .filter(entry => !input.area || entry.area === input.area)
    .map(entry => ({ entry, score: scoreEntry(entry, terms) }))
    .filter((match): match is { entry: ResearchIndexEntry; score: number } => match.score !== null)
    .sort((a, b) => b.score - a.score || b.entry.modifiedAt - a.entry.modifiedAt)
    .map(({ entry, score }) => ({
      name: entry.name,
      relativePath: entry.relativePath,
      area: entry.area,
      kind: entry.kind,
      size: entry.size,
      modifiedAt: entry.modifiedAt,
      score,
      snippet: createSnippet(entry, terms),
      isTruncated: entry.isTruncated,
    }))

  return {
    query,
    hits: matches.slice(0, limit),
    total: matches.length,
    indexedFiles: ensured.index.entries.length,
    refreshedFiles: ensured.refreshedFiles,
    failedFiles: ensured.failedFiles,
    indexUpdatedAt: ensured.index.updatedAt,
  }
}

export async function rebuildWorkspaceResearchIndex(
  workspaceRoot: string,
  workspaceId: string,
): Promise<WorkspaceResearchIndexRebuildResult> {
  const result = await ensureWorkspaceResearchIndex(workspaceRoot, workspaceId, true)
  return {
    indexedFiles: result.index.entries.length,
    failedFiles: result.failedFiles,
    indexUpdatedAt: result.index.updatedAt,
  }
}
