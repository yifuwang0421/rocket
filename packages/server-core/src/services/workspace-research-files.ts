import { createHash, randomUUID } from 'node:crypto'
import {
  access,
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  stat,
  unlink,
} from 'node:fs/promises'
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import type {
  WorkspaceFileImportResult,
  WorkspaceAgentContextRef,
  WorkspaceMarkdownDocument,
  WorkspaceResearchArea,
  WorkspaceResearchFileEntry,
  WorkspaceResearchFileKind,
  WorkspaceResearchFileList,
  WorkspaceResearchPreview,
} from '@rocket/shared/protocol'

const AREA_DIRECTORIES: Record<WorkspaceResearchArea, string> = {
  notes: 'notes',
  documents: 'documents',
}

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown'])
const IMPORT_EXTENSIONS = new Set(['.md', '.markdown', '.pdf', '.html', '.htm', '.docx', '.xlsx'])
const MAX_MARKDOWN_BYTES = 10 * 1024 * 1024
const MAX_IMPORT_BYTES = 100 * 1024 * 1024
const MAX_PREVIEW_TEXT_BYTES = 10 * 1024 * 1024
const MAX_IMPORT_FILES = 50
const MAX_LIST_ENTRIES = 2_000

export class WorkspaceResearchFileError extends Error {
  constructor(
    public readonly code: 'INVALID_PATH' | 'UNSUPPORTED_FILE' | 'FILE_TOO_LARGE' | 'VERSION_CONFLICT' | 'CONVERSION_FAILED',
    message: string,
  ) {
    super(message)
    this.name = 'WorkspaceResearchFileError'
  }
}

function isInside(basePath: string, candidatePath: string): boolean {
  const rel = relative(basePath, candidatePath)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function toWorkspaceRelative(workspaceRoot: string, absolutePath: string): string {
  return relative(workspaceRoot, absolutePath).split(sep).join('/')
}

function classifyFile(path: string): WorkspaceResearchFileKind {
  switch (extname(path).toLowerCase()) {
    case '.md':
    case '.markdown':
      return 'markdown'
    case '.pdf':
      return 'pdf'
    case '.html':
    case '.htm':
      return 'html'
    case '.docx':
      return 'docx'
    case '.xlsx':
      return 'xlsx'
    default:
      return 'other'
  }
}

function hashContent(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex')
}

async function getRealWorkspaceRoot(workspaceRoot: string): Promise<string> {
  await mkdir(workspaceRoot, { recursive: true })
  return realpath(workspaceRoot)
}

async function ensureAreaDirectory(
  workspaceRoot: string,
  area: WorkspaceResearchArea,
): Promise<{ realRoot: string; areaPath: string }> {
  if (area !== 'notes' && area !== 'documents') {
    throw new WorkspaceResearchFileError('INVALID_PATH', 'Unknown research file area')
  }
  const realRoot = await getRealWorkspaceRoot(workspaceRoot)
  const areaPath = join(realRoot, AREA_DIRECTORIES[area])
  await mkdir(areaPath, { recursive: true })
  const realAreaPath = await realpath(areaPath)
  if (!isInside(realRoot, realAreaPath)) {
    throw new WorkspaceResearchFileError('INVALID_PATH', 'Research directory resolves outside the workspace')
  }
  return { realRoot, areaPath: realAreaPath }
}

async function resolveResearchFilePath(workspaceRoot: string, relativePath: string): Promise<string> {
  if (!relativePath || isAbsolute(relativePath)) {
    throw new WorkspaceResearchFileError('INVALID_PATH', 'A workspace-relative research file path is required')
  }

  const normalizedRelative = relativePath.replace(/[\\/]+/g, sep)
  const firstSegment = normalizedRelative.split(sep)[0]
  if (firstSegment !== AREA_DIRECTORIES.notes && firstSegment !== AREA_DIRECTORIES.documents) {
    throw new WorkspaceResearchFileError('INVALID_PATH', 'Research files must be inside notes/ or documents/')
  }

  const realRoot = await getRealWorkspaceRoot(workspaceRoot)
  const candidate = resolve(realRoot, normalizedRelative)
  if (!isInside(realRoot, candidate)) {
    throw new WorkspaceResearchFileError('INVALID_PATH', 'Path escapes the workspace')
  }

  const realParent = await realpath(dirname(candidate))
  if (!isInside(realRoot, realParent)) {
    throw new WorkspaceResearchFileError('INVALID_PATH', 'Parent directory resolves outside the workspace')
  }

  const realCandidate = await realpath(candidate)
  if (!isInside(realRoot, realCandidate)) {
    throw new WorkspaceResearchFileError('INVALID_PATH', 'File resolves outside the workspace')
  }
  return realCandidate
}

async function resolveResearchDirectoryPath(workspaceRoot: string, relativePath: string): Promise<{ realRoot: string; directoryPath: string; area: WorkspaceResearchArea }> {
  if (!relativePath || isAbsolute(relativePath)) {
    throw new WorkspaceResearchFileError('INVALID_PATH', 'A Workspace-relative research directory is required')
  }
  const normalizedRelative = relativePath.replace(/[\\/]+/g, sep)
  const firstSegment = normalizedRelative.split(sep)[0]
  const area: WorkspaceResearchArea = firstSegment === AREA_DIRECTORIES.notes
    ? 'notes'
    : firstSegment === AREA_DIRECTORIES.documents
      ? 'documents'
      : (() => { throw new WorkspaceResearchFileError('INVALID_PATH', 'Research directories must be inside notes/ or documents/') })()
  const realRoot = await getRealWorkspaceRoot(workspaceRoot)
  const candidate = resolve(realRoot, normalizedRelative)
  if (!isInside(realRoot, candidate)) throw new WorkspaceResearchFileError('INVALID_PATH', 'Directory escapes the Workspace')
  const info = await lstat(candidate)
  if (info.isSymbolicLink() || !info.isDirectory()) throw new WorkspaceResearchFileError('INVALID_PATH', 'Import target must be a regular directory')
  const directoryPath = await realpath(candidate)
  if (!isInside(realRoot, directoryPath)) throw new WorkspaceResearchFileError('INVALID_PATH', 'Directory resolves outside the Workspace')
  return { realRoot, directoryPath, area }
}

async function resolveMarkdownPath(workspaceRoot: string, relativePath: string): Promise<string> {
  const absolutePath = await resolveResearchFilePath(workspaceRoot, relativePath)
  if (!MARKDOWN_EXTENSIONS.has(extname(absolutePath).toLowerCase())) {
    throw new WorkspaceResearchFileError('UNSUPPORTED_FILE', 'Only Markdown files are editable in P1')
  }
  return absolutePath
}

export type ResearchTextConverter = (absolutePath: string) => Promise<string>

async function convertResearchFile(absolutePath: string): Promise<string> {
  try {
    const { MarkItDown } = await import('markitdown-js')
    const result = await new MarkItDown().convert(absolutePath)
    if (!result?.textContent) {
      throw new Error('Conversion returned no readable content')
    }
    return result.textContent
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new WorkspaceResearchFileError('CONVERSION_FAILED', `Unable to extract readable research text: ${message}`)
  }
}

async function nextAvailablePath(directory: string, requestedName: string): Promise<string> {
  const extension = extname(requestedName)
  const stem = basename(requestedName, extension)
  let candidate = join(directory, requestedName)
  let index = 2
  while (true) {
    try {
      await access(candidate)
      candidate = join(directory, `${stem} (${index})${extension}`)
      index += 1
    } catch {
      return candidate
    }
  }
}

function sanitizeResearchFilename(name: string): string {
  const sanitized = basename(name)
    .replace(/[<>:"|?*]/g, '_')
    .replace(/[\x00-\x1f]/g, '')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 180)
  if (!sanitized) throw new WorkspaceResearchFileError('INVALID_PATH', 'A valid file name is required')
  return sanitized
}

async function entryFor(
  realRoot: string,
  area: WorkspaceResearchArea,
  absolutePath: string,
): Promise<WorkspaceResearchFileEntry> {
  const info = await stat(absolutePath)
  return {
    name: basename(absolutePath),
    relativePath: toWorkspaceRelative(realRoot, absolutePath),
    area,
    kind: classifyFile(absolutePath),
    size: info.size,
    modifiedAt: info.mtimeMs,
  }
}

export async function listWorkspaceResearchFiles(
  workspaceRoot: string,
  area: WorkspaceResearchArea,
): Promise<WorkspaceResearchFileList> {
  const { realRoot, areaPath } = await ensureAreaDirectory(workspaceRoot, area)
  const entries: WorkspaceResearchFileEntry[] = []
  const queue = [areaPath]
  let truncated = false

  while (queue.length > 0) {
    const directory = queue.shift()!
    const children = await readdir(directory, { withFileTypes: true })
    children.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    for (const child of children) {
      if (entries.length >= MAX_LIST_ENTRIES) {
        truncated = true
        queue.length = 0
        break
      }
      if (child.name.startsWith('.') || child.isSymbolicLink()) continue
      const childPath = join(directory, child.name)
      if (child.isDirectory()) {
        queue.push(childPath)
      } else if (child.isFile()) {
        entries.push(await entryFor(realRoot, area, childPath))
      }
    }
  }

  entries.sort((a, b) => b.modifiedAt - a.modifiedAt || a.relativePath.localeCompare(b.relativePath))
  return { area, entries, truncated }
}

export async function readWorkspaceResearchPreview(
  workspaceRoot: string,
  relativePath: string,
  officeConverter: ResearchTextConverter = convertResearchFile,
): Promise<WorkspaceResearchPreview> {
  const absolutePath = await resolveResearchFilePath(workspaceRoot, relativePath)
  const kind = classifyFile(absolutePath)
  if (kind !== 'pdf' && kind !== 'html' && kind !== 'docx' && kind !== 'xlsx') {
    throw new WorkspaceResearchFileError('UNSUPPORTED_FILE', 'This file does not have a P1 read-only preview')
  }

  const info = await stat(absolutePath)
  if (!info.isFile()) throw new WorkspaceResearchFileError('INVALID_PATH', 'Research path is not a file')
  if (info.size > MAX_IMPORT_BYTES) {
    throw new WorkspaceResearchFileError('FILE_TOO_LARGE', 'Preview source exceeds the 100 MB limit')
  }

  const previewBase = {
    relativePath: toWorkspaceRelative(await getRealWorkspaceRoot(workspaceRoot), absolutePath),
    size: info.size,
    modifiedAt: info.mtimeMs,
  }

  if (kind === 'pdf') {
    return {
      ...previewBase,
      kind,
      contentType: 'application/pdf',
      data: new Uint8Array(await readFile(absolutePath)),
    }
  }

  if (kind === 'html') {
    if (info.size > MAX_PREVIEW_TEXT_BYTES) {
      throw new WorkspaceResearchFileError('FILE_TOO_LARGE', 'HTML preview exceeds the 10 MB text limit')
    }
    return {
      ...previewBase,
      kind,
      contentType: 'text/html',
      content: await readFile(absolutePath, 'utf-8'),
    }
  }

  const content = await officeConverter(absolutePath)
  if (Buffer.byteLength(content, 'utf-8') > MAX_PREVIEW_TEXT_BYTES) {
    throw new WorkspaceResearchFileError('FILE_TOO_LARGE', 'Converted Office preview exceeds the 10 MB text limit')
  }
  return {
    ...previewBase,
    kind,
    contentType: 'text/markdown',
    content,
  }
}

function mediaTypeForKind(kind: WorkspaceResearchFileKind): string {
  switch (kind) {
    case 'markdown': return 'text/markdown'
    case 'pdf': return 'application/pdf'
    case 'html': return 'text/html'
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    default: return 'application/octet-stream'
  }
}

export async function readWorkspaceAgentContext(
  workspaceRoot: string,
  workspaceId: string,
  relativePath: string,
): Promise<WorkspaceAgentContextRef> {
  const absolutePath = await resolveResearchFilePath(workspaceRoot, relativePath)
  const info = await stat(absolutePath)
  if (!info.isFile()) throw new WorkspaceResearchFileError('INVALID_PATH', 'Research context path is not a file')
  if (info.size > MAX_IMPORT_BYTES) {
    throw new WorkspaceResearchFileError('FILE_TOO_LARGE', 'Research context exceeds the 100 MB limit')
  }

  const kind = classifyFile(absolutePath)
  if (kind === 'other') {
    throw new WorkspaceResearchFileError('UNSUPPORTED_FILE', 'This file cannot be attached as P1 research context')
  }
  const normalizedPath = toWorkspaceRelative(await getRealWorkspaceRoot(workspaceRoot), absolutePath)
  const area = normalizedPath.split('/')[0] as WorkspaceResearchArea
  const buffer = await readFile(absolutePath)

  return {
    workspaceId,
    relativePath: normalizedPath,
    name: basename(absolutePath),
    area,
    kind,
    mediaType: mediaTypeForKind(kind),
    size: info.size,
    modifiedAt: info.mtimeMs,
    version: hashContent(buffer),
    writePolicy: kind === 'markdown' ? 'versioned-write' : 'read-only',
  }
}

export interface WorkspaceResearchIndexSource {
  context: WorkspaceAgentContextRef
  text: string
}

/** Extract searchable text without persisting it as authoritative data. */
export async function readWorkspaceResearchIndexSource(
  workspaceRoot: string,
  workspaceId: string,
  relativePath: string,
  converter: ResearchTextConverter = convertResearchFile,
): Promise<WorkspaceResearchIndexSource> {
  const context = await readWorkspaceAgentContext(workspaceRoot, workspaceId, relativePath)
  const absolutePath = await resolveResearchFilePath(workspaceRoot, relativePath)
  if (context.kind === 'markdown') {
    if (context.size > MAX_MARKDOWN_BYTES) {
      throw new WorkspaceResearchFileError('FILE_TOO_LARGE', 'Markdown index source exceeds the 10 MB limit')
    }
    return { context, text: await readFile(absolutePath, 'utf-8') }
  }

  const text = await converter(absolutePath)
  if (Buffer.byteLength(text, 'utf-8') > MAX_PREVIEW_TEXT_BYTES) {
    throw new WorkspaceResearchFileError('FILE_TOO_LARGE', 'Extracted research text exceeds the 10 MB limit')
  }
  return { context, text }
}

export async function readWorkspaceMarkdown(
  workspaceRoot: string,
  relativePath: string,
): Promise<WorkspaceMarkdownDocument> {
  const absolutePath = await resolveMarkdownPath(workspaceRoot, relativePath)
  const info = await stat(absolutePath)
  if (!info.isFile()) throw new WorkspaceResearchFileError('INVALID_PATH', 'Markdown path is not a file')
  if (info.size > MAX_MARKDOWN_BYTES) {
    throw new WorkspaceResearchFileError('FILE_TOO_LARGE', 'Markdown file exceeds the 10 MB editing limit')
  }
  const buffer = await readFile(absolutePath)
  return {
    relativePath: toWorkspaceRelative(await getRealWorkspaceRoot(workspaceRoot), absolutePath),
    content: buffer.toString('utf-8'),
    version: hashContent(buffer),
    modifiedAt: info.mtimeMs,
  }
}

export async function saveWorkspaceMarkdown(
  workspaceRoot: string,
  relativePath: string,
  content: string,
  expectedVersion: string,
): Promise<WorkspaceMarkdownDocument> {
  if (Buffer.byteLength(content, 'utf-8') > MAX_MARKDOWN_BYTES) {
    throw new WorkspaceResearchFileError('FILE_TOO_LARGE', 'Markdown file exceeds the 10 MB editing limit')
  }

  const absolutePath = await resolveMarkdownPath(workspaceRoot, relativePath)
  const current = await readFile(absolutePath)
  if (hashContent(current) !== expectedVersion) {
    throw new WorkspaceResearchFileError('VERSION_CONFLICT', 'The file changed after it was opened. Reload it before saving.')
  }

  const temporaryPath = join(dirname(absolutePath), `.${basename(absolutePath)}.${randomUUID()}.tmp`)
  let handle: Awaited<ReturnType<typeof open>> | null = null
  try {
    handle = await open(temporaryPath, 'wx')
    await handle.writeFile(content, 'utf-8')
    await handle.sync()
    await handle.close()
    handle = null
    await rename(temporaryPath, absolutePath)
  } catch (error) {
    await handle?.close().catch(() => {})
    await unlink(temporaryPath).catch(() => {})
    throw error
  }

  return readWorkspaceMarkdown(workspaceRoot, relativePath)
}

export async function createWorkspaceMarkdown(
  workspaceRoot: string,
  area: WorkspaceResearchArea,
  requestedName: string,
): Promise<WorkspaceMarkdownDocument> {
  const { realRoot, areaPath } = await ensureAreaDirectory(workspaceRoot, area)
  let safeName = sanitizeResearchFilename(requestedName)
  if (!MARKDOWN_EXTENSIONS.has(extname(safeName).toLowerCase())) safeName += '.md'
  const targetPath = await nextAvailablePath(areaPath, safeName)
  const temporaryPath = join(areaPath, `.${basename(targetPath)}.${randomUUID()}.tmp`)

  let handle: Awaited<ReturnType<typeof open>> | null = null
  try {
    handle = await open(temporaryPath, 'wx')
    await handle.sync()
    await handle.close()
    handle = null
    await rename(temporaryPath, targetPath)
  } catch (error) {
    await handle?.close().catch(() => {})
    await unlink(temporaryPath).catch(() => {})
    throw error
  }

  return readWorkspaceMarkdown(realRoot, toWorkspaceRelative(realRoot, targetPath))
}

export async function importFilesToWorkspace(
  workspaceRoot: string,
  area: WorkspaceResearchArea,
  sourcePaths: string[],
): Promise<WorkspaceFileImportResult> {
  if (!Array.isArray(sourcePaths)) {
    throw new WorkspaceResearchFileError('INVALID_PATH', 'Import source paths must be an array')
  }
  if (sourcePaths.length === 0) return { imported: [] }
  if (sourcePaths.length > MAX_IMPORT_FILES) {
    throw new WorkspaceResearchFileError('FILE_TOO_LARGE', `Import is limited to ${MAX_IMPORT_FILES} files at a time`)
  }

  const { realRoot, areaPath } = await ensureAreaDirectory(workspaceRoot, area)
  const imported: WorkspaceResearchFileEntry[] = []

  for (const sourcePath of sourcePaths) {
    if (!isAbsolute(sourcePath)) {
      throw new WorkspaceResearchFileError('INVALID_PATH', 'Imported files must use absolute source paths')
    }
    const sourceInfo = await lstat(sourcePath)
    if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
      throw new WorkspaceResearchFileError('INVALID_PATH', 'Only regular files can be imported')
    }
    if (sourceInfo.size > MAX_IMPORT_BYTES) {
      throw new WorkspaceResearchFileError('FILE_TOO_LARGE', `${basename(sourcePath)} exceeds the 100 MB import limit`)
    }

    const extension = extname(sourcePath).toLowerCase()
    if (!IMPORT_EXTENSIONS.has(extension) || (area === 'notes' && !MARKDOWN_EXTENSIONS.has(extension))) {
      throw new WorkspaceResearchFileError(
        'UNSUPPORTED_FILE',
        area === 'notes' ? 'Only Markdown files can be imported as notes' : `Unsupported research file: ${basename(sourcePath)}`,
      )
    }

    const safeName = sanitizeResearchFilename(basename(sourcePath))
    const targetPath = await nextAvailablePath(areaPath, safeName)
    const temporaryPath = join(areaPath, `.${basename(targetPath)}.${randomUUID()}.tmp`)
    let handle: Awaited<ReturnType<typeof open>> | null = null
    try {
      await copyFile(sourcePath, temporaryPath)
      handle = await open(temporaryPath, 'r+')
      await handle.sync()
      await handle.close()
      handle = null
      await rename(temporaryPath, targetPath)
    } catch (error) {
      await handle?.close().catch(() => {})
      await unlink(temporaryPath).catch(() => {})
      throw error
    }
    imported.push(await entryFor(realRoot, area, targetPath))
  }

  return { imported }
}

export async function importFilesToWorkspaceDirectory(
  workspaceRoot: string,
  relativeDirectory: string,
  sourcePaths: string[],
): Promise<WorkspaceFileImportResult> {
  if (!Array.isArray(sourcePaths)) throw new WorkspaceResearchFileError('INVALID_PATH', 'Import source paths must be an array')
  if (sourcePaths.length === 0) return { imported: [] }
  if (sourcePaths.length > MAX_IMPORT_FILES) {
    throw new WorkspaceResearchFileError('FILE_TOO_LARGE', `Import is limited to ${MAX_IMPORT_FILES} files at a time`)
  }
  const { realRoot, directoryPath, area } = await resolveResearchDirectoryPath(workspaceRoot, relativeDirectory)
  const imported: WorkspaceResearchFileEntry[] = []

  for (const sourcePath of sourcePaths) {
    if (!isAbsolute(sourcePath)) throw new WorkspaceResearchFileError('INVALID_PATH', 'Imported files must use absolute source paths')
    const sourceInfo = await lstat(sourcePath)
    if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) throw new WorkspaceResearchFileError('INVALID_PATH', 'Only regular files can be imported')
    if (sourceInfo.size > MAX_IMPORT_BYTES) throw new WorkspaceResearchFileError('FILE_TOO_LARGE', `${basename(sourcePath)} exceeds the 100 MB import limit`)
    const extension = extname(sourcePath).toLowerCase()
    if (area === 'notes' && !MARKDOWN_EXTENSIONS.has(extension)) {
      throw new WorkspaceResearchFileError('UNSUPPORTED_FILE', `Unsupported research file: ${basename(sourcePath)}`)
    }
    const safeName = sanitizeResearchFilename(basename(sourcePath))
    const targetPath = await nextAvailablePath(directoryPath, safeName)
    const temporaryPath = join(directoryPath, `.${basename(targetPath)}.${randomUUID()}.tmp`)
    let handle: Awaited<ReturnType<typeof open>> | null = null
    try {
      await copyFile(sourcePath, temporaryPath)
      handle = await open(temporaryPath, 'r+')
      await handle.sync()
      await handle.close()
      handle = null
      await rename(temporaryPath, targetPath)
    } catch (error) {
      await handle?.close().catch(() => {})
      await unlink(temporaryPath).catch(() => {})
      throw error
    }
    imported.push(await entryFor(realRoot, area, targetPath))
  }
  return { imported }
}
