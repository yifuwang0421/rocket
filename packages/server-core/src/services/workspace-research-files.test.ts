import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  WorkspaceResearchFileError,
  createWorkspaceMarkdown,
  importFilesToWorkspace,
  listWorkspaceResearchFiles,
  readWorkspaceMarkdown,
  readWorkspaceAgentContext,
  readWorkspaceResearchPreview,
  saveWorkspaceMarkdown,
} from './workspace-research-files'

let testRoot = ''
let workspaceRoot = ''
let externalRoot = ''

beforeEach(() => {
  testRoot = mkdtempSync(join(tmpdir(), 'rocket-research-files-'))
  workspaceRoot = join(testRoot, 'workspace')
  externalRoot = join(testRoot, 'external')
  mkdirSync(workspaceRoot, { recursive: true })
  mkdirSync(externalRoot, { recursive: true })
})

afterEach(() => {
  if (testRoot && existsSync(testRoot)) rmSync(testRoot, { recursive: true, force: true })
})

describe('workspace research files', () => {
  it('creates research directories and returns an empty list', async () => {
    const result = await listWorkspaceResearchFiles(workspaceRoot, 'notes')

    expect(result).toEqual({ area: 'notes', entries: [], truncated: false })
    expect(existsSync(join(workspaceRoot, 'notes'))).toBe(true)
  })

  it('creates, reads, and explicitly saves Markdown with a new version', async () => {
    const created = await createWorkspaceMarkdown(workspaceRoot, 'notes', '调研纪要')
    const saved = await saveWorkspaceMarkdown(workspaceRoot, created.relativePath, '# 调研纪要\n', created.version)
    const loaded = await readWorkspaceMarkdown(workspaceRoot, created.relativePath)

    expect(created.relativePath).toBe('notes/调研纪要.md')
    expect(saved.version).not.toBe(created.version)
    expect(loaded.content).toBe('# 调研纪要\n')
    expect(readdirSync(join(workspaceRoot, 'notes')).some(name => name.endsWith('.tmp'))).toBe(false)
  })

  it('creates body-free, version-pinned Agent context metadata', async () => {
    const created = await createWorkspaceMarkdown(workspaceRoot, 'notes', 'Agent context')
    const context = await readWorkspaceAgentContext(workspaceRoot, 'workspace-1', created.relativePath)

    expect(context).toMatchObject({
      workspaceId: 'workspace-1',
      relativePath: 'notes/Agent context.md',
      kind: 'markdown',
      mediaType: 'text/markdown',
      writePolicy: 'versioned-write',
      version: created.version,
    })
    expect(context).not.toHaveProperty('content')
  })

  it('rejects stale saves without changing the file', async () => {
    const created = await createWorkspaceMarkdown(workspaceRoot, 'notes', 'conflict.md')
    writeFileSync(join(workspaceRoot, created.relativePath), 'external change', 'utf-8')

    await expect(saveWorkspaceMarkdown(workspaceRoot, created.relativePath, 'stale edit', created.version))
      .rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
    expect(readFileSync(join(workspaceRoot, created.relativePath), 'utf-8')).toBe('external change')
  })

  it('rejects traversal and non-research paths', async () => {
    await expect(readWorkspaceMarkdown(workspaceRoot, '../outside.md'))
      .rejects.toBeInstanceOf(WorkspaceResearchFileError)
    await expect(readWorkspaceMarkdown(workspaceRoot, 'README.md'))
      .rejects.toMatchObject({ code: 'INVALID_PATH' })
  })

  it('atomically imports Markdown and resolves duplicate names', async () => {
    const source = join(externalRoot, 'report.md')
    writeFileSync(source, '# source', 'utf-8')

    const first = await importFilesToWorkspace(workspaceRoot, 'documents', [source])
    const second = await importFilesToWorkspace(workspaceRoot, 'documents', [source])

    expect(first.imported[0]?.relativePath).toBe('documents/report.md')
    expect(second.imported[0]?.relativePath).toBe('documents/report (2).md')
    expect(readFileSync(join(workspaceRoot, 'documents', 'report.md'), 'utf-8')).toBe('# source')
    expect(readdirSync(join(workspaceRoot, 'documents')).some(name => name.endsWith('.tmp'))).toBe(false)
  })

  it('allows P1 preview formats in documents but only Markdown in notes', async () => {
    const pdf = join(externalRoot, 'filing.pdf')
    writeFileSync(pdf, '%PDF-test', 'utf-8')

    const documents = await importFilesToWorkspace(workspaceRoot, 'documents', [pdf])
    expect(documents.imported[0]?.kind).toBe('pdf')
    await expect(importFilesToWorkspace(workspaceRoot, 'notes', [pdf]))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_FILE' })
  })

  it('lists nested regular files with workspace-relative paths and ignores hidden files', async () => {
    mkdirSync(join(workspaceRoot, 'documents', 'company'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'documents', 'company', 'model.md'), 'model', 'utf-8')
    writeFileSync(join(workspaceRoot, 'documents', '.secret.md'), 'secret', 'utf-8')

    const result = await listWorkspaceResearchFiles(workspaceRoot, 'documents')

    expect(result.entries.map(entry => entry.relativePath)).toEqual(['documents/company/model.md'])
  })

  it('returns workspace-scoped HTML and PDF preview payloads', async () => {
    mkdirSync(join(workspaceRoot, 'documents'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'documents', 'filing.html'), '<h1>Filing</h1>', 'utf-8')
    writeFileSync(join(workspaceRoot, 'documents', 'filing.pdf'), Buffer.from('%PDF-test'))

    const html = await readWorkspaceResearchPreview(workspaceRoot, 'documents/filing.html')
    const pdf = await readWorkspaceResearchPreview(workspaceRoot, 'documents/filing.pdf')

    expect(html).toMatchObject({
      relativePath: 'documents/filing.html',
      kind: 'html',
      contentType: 'text/html',
      content: '<h1>Filing</h1>',
    })
    expect(pdf).toMatchObject({
      relativePath: 'documents/filing.pdf',
      kind: 'pdf',
      contentType: 'application/pdf',
    })
    expect(Array.from(pdf.kind === 'pdf' ? pdf.data : [])).toEqual(Array.from(Buffer.from('%PDF-test')))
  })

  it('converts Office previews on the server and preserves the source kind', async () => {
    mkdirSync(join(workspaceRoot, 'documents'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'documents', 'model.xlsx'), 'fake-xlsx')
    let convertedPath = ''

    const result = await readWorkspaceResearchPreview(workspaceRoot, 'documents/model.xlsx', async absolutePath => {
      convertedPath = absolutePath
      return '| Revenue | 2026 |\n| --- | ---: |\n| Total | 100 |'
    })

    expect(convertedPath).toBe(join(workspaceRoot, 'documents', 'model.xlsx'))
    expect(result).toMatchObject({
      relativePath: 'documents/model.xlsx',
      kind: 'xlsx',
      contentType: 'text/markdown',
    })
  })

  it('rejects preview traversal and formats outside the P1 reader', async () => {
    mkdirSync(join(workspaceRoot, 'documents'), { recursive: true })
    writeFileSync(join(workspaceRoot, 'documents', 'draft.md'), '# draft', 'utf-8')

    await expect(readWorkspaceResearchPreview(workspaceRoot, '../outside.pdf'))
      .rejects.toMatchObject({ code: 'INVALID_PATH' })
    await expect(readWorkspaceResearchPreview(workspaceRoot, 'documents/draft.md'))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_FILE' })
  })
})
