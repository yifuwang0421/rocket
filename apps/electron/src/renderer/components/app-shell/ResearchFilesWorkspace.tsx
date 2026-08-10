import * as React from 'react'
import {
  FileCode2,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  Search,
  DatabaseZap,
  X,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import type { WorkspaceResearchController } from '@/hooks/useWorkspaceResearchState'
import type {
  WorkspaceResearchArea,
  WorkspaceResearchFileEntry,
  WorkspaceResearchFileKind,
  WorkspaceResearchSearchResult,
} from '../../../shared/types'
import { useAppShellContext } from '@/context/AppShellContext'
import { HeaderIconButton } from '@/components/ui/HeaderIconButton'
import { RenameDialog } from '@/components/ui/rename-dialog'
import { cn } from '@/lib/utils'

interface ResearchFilesWorkspaceProps {
  area: WorkspaceResearchArea
  research: WorkspaceResearchController
}

const KIND_ICONS: Record<WorkspaceResearchFileKind, React.ComponentType<{ className?: string }>> = {
  markdown: FileText,
  pdf: FileText,
  html: FileCode2,
  docx: FileText,
  xlsx: FileSpreadsheet,
  other: FileText,
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function openFileTab(
  entry: WorkspaceResearchFileEntry,
  research: WorkspaceResearchController,
): void {
  const isNote = entry.area === 'notes'
  research.openTab({
    id: `research:${isNote ? 'note' : 'file'}:${entry.relativePath}`,
    title: entry.name,
    type: isNote ? 'note' : 'file',
    resource: {
      kind: isNote ? 'note' : 'file',
      path: entry.relativePath,
      mediaType: entry.kind === 'markdown' ? 'text/markdown' : entry.kind,
      metadata: {
        area: entry.area,
        size: entry.size,
        modifiedAt: entry.modifiedAt,
      },
    },
  })
}

export function ResearchFilesWorkspace({ area, research }: ResearchFilesWorkspaceProps) {
  const { activeWorkspaceId } = useAppShellContext()
  const [entries, setEntries] = React.useState<WorkspaceResearchFileEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [importing, setImporting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [dragActive, setDragActive] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [newNoteName, setNewNoteName] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [searchResult, setSearchResult] = React.useState<WorkspaceResearchSearchResult | null>(null)
  const [searching, setSearching] = React.useState(false)
  const [rebuilding, setRebuilding] = React.useState(false)
  const title = area === 'notes' ? '笔记' : '资料目录'

  const reload = React.useCallback(async () => {
    if (!activeWorkspaceId) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.listWorkspaceFiles(activeWorkspaceId, area)
      setEntries(result.entries)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId, area])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const runSearch = React.useCallback(async (searchQuery: string) => {
    if (!activeWorkspaceId || !searchQuery.trim()) {
      setSearchResult(null)
      setSearching(false)
      return
    }
    setSearching(true)
    try {
      const result = await window.electronAPI.searchWorkspaceResearch({
        workspaceId: activeWorkspaceId,
        query: searchQuery,
      })
      setSearchResult(result)
    } catch (searchError) {
      toast.error('全文搜索失败', {
        description: searchError instanceof Error ? searchError.message : String(searchError),
      })
    } finally {
      setSearching(false)
    }
  }, [activeWorkspaceId])

  React.useEffect(() => {
    if (!query.trim()) {
      setSearchResult(null)
      setSearching(false)
      return
    }
    const timer = window.setTimeout(() => { void runSearch(query) }, 250)
    return () => window.clearTimeout(timer)
  }, [query, runSearch])

  const rebuildIndex = React.useCallback(async () => {
    if (!activeWorkspaceId || rebuilding) return
    setRebuilding(true)
    try {
      const result = await window.electronAPI.rebuildWorkspaceResearchIndex(activeWorkspaceId)
      toast.success(`已重建 ${result.indexedFiles} 个文件的全文索引`)
      if (query.trim()) await runSearch(query)
    } catch (rebuildError) {
      toast.error('重建索引失败', {
        description: rebuildError instanceof Error ? rebuildError.message : String(rebuildError),
      })
    } finally {
      setRebuilding(false)
    }
  }, [activeWorkspaceId, query, rebuilding, runSearch])

  const importPaths = React.useCallback(async (paths: string[]) => {
    if (!activeWorkspaceId || paths.length === 0) return
    setImporting(true)
    try {
      const result = await window.electronAPI.importToWorkspace(activeWorkspaceId, area, paths)
      await reload()
      if (result.imported.length > 0) {
        toast.success(`已导入 ${result.imported.length} 个文件`)
        openFileTab(result.imported[0], research)
      }
    } catch (importError) {
      toast.error('导入失败', {
        description: importError instanceof Error ? importError.message : String(importError),
      })
    } finally {
      setImporting(false)
    }
  }, [activeWorkspaceId, area, reload, research])

  const handleImportDialog = React.useCallback(async () => {
    const paths = await window.electronAPI.openFileDialog()
    await importPaths(paths)
  }, [importPaths])

  const handleDrop = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    const paths = Array.from(event.dataTransfer.files)
      .map(file => window.electronAPI.getFilePath(file))
      .filter((path): path is string => Boolean(path))
    if (paths.length === 0) {
      toast.error('无法读取拖入文件的本地路径')
      return
    }
    void importPaths(paths)
  }, [importPaths])

  const handleCreateNote = React.useCallback(async () => {
    if (!activeWorkspaceId || !newNoteName.trim()) return
    try {
      const document = await window.electronAPI.createWorkspaceMarkdown(activeWorkspaceId, 'notes', newNoteName.trim())
      setCreateOpen(false)
      setNewNoteName('')
      await reload()
      research.openTab({
        id: `research:note:${document.relativePath}`,
        title: document.relativePath.split('/').pop() ?? '新笔记.md',
        type: 'note',
        resource: { kind: 'note', path: document.relativePath, mediaType: 'text/markdown' },
      })
    } catch (createError) {
      toast.error('无法新建笔记', {
        description: createError instanceof Error ? createError.message : String(createError),
      })
    }
  }, [activeWorkspaceId, newNoteName, reload, research])

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={event => { event.preventDefault(); setDragActive(true) }}
      onDragOver={event => event.preventDefault()}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false)
      }}
      onDrop={handleDrop}
    >
      <div className="flex h-[42px] shrink-0 items-center gap-2 border-b border-border/50 px-3">
        <FolderOpen className="h-3.5 w-3.5 text-foreground/55" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{title}</h1>
        </div>
        <HeaderIconButton
          icon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />}
          tooltip="刷新"
          onClick={() => { void reload() }}
          disabled={loading}
        />
        {area === 'notes' && (
          <HeaderIconButton icon={<FilePlus2 className="h-3.5 w-3.5" />} tooltip="新建笔记" onClick={() => setCreateOpen(true)} />
        )}
        <HeaderIconButton
          icon={importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          tooltip={area === 'notes' ? '导入 Markdown 笔记' : '导入研究资料'}
          onClick={() => { void handleImportDialog() }}
          disabled={importing}
        />
        <HeaderIconButton
          icon={rebuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DatabaseZap className="h-3.5 w-3.5" />}
          tooltip="重建 Workspace 全文索引"
          onClick={() => { void rebuildIndex() }}
          disabled={rebuilding}
        />
      </div>

      <div className="shrink-0 border-b border-border/40 bg-foreground/[0.012] px-3 py-2">
        <div className="relative mx-auto max-w-4xl">
          {searching
            ? <Loader2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            : <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />}
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label="搜索当前 Workspace 的笔记与资料"
            placeholder="搜索当前 Workspace 的笔记与资料"
            className="h-8 w-full rounded-[7px] border border-border/55 bg-background pl-8 pr-8 text-xs outline-none placeholder:text-muted-foreground/65 focus:border-border focus:ring-1 focus:ring-ring/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="清除搜索"
              className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-[5px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-xs text-muted-foreground">
            {area === 'notes'
              ? 'Markdown 笔记保存在 notes/。拖入 Markdown 文件后会复制到当前 Workspace。'
              : '研究资料保存在 documents/。Markdown 可编辑，HTML、Word、Excel 和 PDF 以只读方式打开。'}
          </p>
          {query.trim() ? (
            searching && !searchResult ? (
              <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 正在更新索引并搜索
              </div>
            ) : searchResult?.hits.length ? (
              <div>
                <div role="status" aria-live="polite" className="mb-2 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                  <span>找到 {searchResult.total} 条结果 · 已索引 {searchResult.indexedFiles} 个文件</span>
                  {searchResult.refreshedFiles > 0 && <span>本次更新 {searchResult.refreshedFiles} 个文件</span>}
                </div>
                <div className="overflow-hidden rounded-[10px] border border-border/50 bg-background shadow-minimal">
                  {searchResult.hits.map(hit => {
                    const Icon = KIND_ICONS[hit.kind]
                    return (
                      <button
                        key={hit.relativePath}
                        onClick={() => openFileTab(hit, research)}
                        className="flex w-full items-start gap-3 border-b border-border/40 px-3 py-3 text-left outline-none last:border-b-0 hover:bg-foreground/[0.035] focus-visible:bg-foreground/[0.05]"
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-foreground/[0.045]">
                          <Icon className="h-4 w-4 text-foreground/55" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{hit.name}</p>
                            <span className="shrink-0 rounded-[4px] bg-foreground/[0.05] px-1.5 py-0.5 text-[9px] text-muted-foreground">
                              {hit.area === 'notes' ? '笔记' : '资料'}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-foreground/65">{hit.snippet || '仅文件名或路径匹配'}</p>
                          <p className="mt-1 truncate text-[9px] text-muted-foreground">{hit.relativePath}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
                {searchResult.failedFiles.length > 0 && (
                  <p role="status" className="mt-3 text-[10px] text-amber-600 dark:text-amber-400">
                    {searchResult.failedFiles.length} 个文件暂时无法建立索引，可点击右上角重建后重试。
                  </p>
                )}
              </div>
            ) : (
              <div role="status" aria-live="polite" className="py-16 text-center text-xs text-muted-foreground">没有找到与“{query.trim()}”匹配的笔记或资料</div>
            )
          ) : loading ? (
            <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在读取 Workspace
            </div>
          ) : error ? (
            <div role="alert" className="rounded-[10px] border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive">
              <p>{error}</p>
              <button type="button" className="mt-3 rounded-[6px] border border-destructive/20 px-2.5 py-1.5 font-medium outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { void reload() }}>重试</button>
            </div>
          ) : entries.length === 0 ? (
            <button
              onClick={() => { void handleImportDialog() }}
              className="flex w-full flex-col items-center justify-center rounded-[12px] border border-dashed border-border/70 px-6 py-16 text-center outline-none transition-colors hover:bg-foreground/[0.025] focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Upload className="h-6 w-6 text-foreground/35" />
              <span className="mt-3 text-[13px] font-medium">拖入文件或点击导入</span>
              <span className="mt-1 text-xs text-muted-foreground">
                {area === 'notes' ? '支持 .md 与 .markdown' : '支持 Markdown、PDF、HTML、DOCX、XLSX'}
              </span>
            </button>
          ) : (
            <div className="overflow-hidden rounded-[10px] border border-border/50 bg-background shadow-minimal">
              {entries.map(entry => {
                const Icon = KIND_ICONS[entry.kind]
                return (
                  <button
                    key={entry.relativePath}
                    onClick={() => openFileTab(entry, research)}
                    className="flex w-full items-center gap-3 border-b border-border/40 px-3 py-2.5 text-left outline-none last:border-b-0 hover:bg-foreground/[0.035] focus-visible:bg-foreground/[0.05]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-foreground/[0.045]">
                      <Icon className="h-4 w-4 text-foreground/55" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{entry.name}</p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{entry.relativePath}</p>
                    </div>
                    <div className="shrink-0 text-right text-[10px] text-muted-foreground">
                      <p>{formatFileSize(entry.size)}</p>
                      <p className="mt-0.5">{new Date(entry.modifiedAt).toLocaleDateString('zh-CN')}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <AnimateDropOverlay visible={dragActive} area={area} />
      <RenameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建 Markdown 笔记"
        value={newNoteName}
        onValueChange={setNewNoteName}
        onSubmit={() => { void handleCreateNote() }}
        placeholder="例如：公司调研纪要"
      />
    </div>
  )
}

function AnimateDropOverlay({ visible, area }: { visible: boolean; area: WorkspaceResearchArea }) {
  if (!visible) return null
  return (
    <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-[12px] border border-accent/40 bg-background/90 backdrop-blur-sm">
      <div className="text-center">
        <Upload className="mx-auto h-6 w-6 text-accent" />
        <p className="mt-3 text-[13px] font-medium">释放以导入到 {area === 'notes' ? 'notes/' : 'documents/'}</p>
        <p className="mt-1 text-xs text-muted-foreground">文件会先复制到当前 Workspace，再打开</p>
      </div>
    </div>
  )
}
