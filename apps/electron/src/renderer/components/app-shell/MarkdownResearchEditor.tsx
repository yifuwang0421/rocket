import * as React from 'react'
import { AlertTriangle, FileText, Loader2, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { TiptapMarkdownEditor } from '@rocket/ui'
import type { ResearchTab } from '@/atoms/workspace-tabs'
import type { WorkspaceResearchController } from '@/hooks/useWorkspaceResearchState'
import { useAppShellContext } from '@/context/AppShellContext'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import * as storage from '@/lib/local-storage'

interface MarkdownDraft {
  content: string
  baseVersion: string
  updatedAt: number
}

type MarkdownDraftMap = Record<string, MarkdownDraft>

interface MarkdownResearchEditorProps {
  tab: ResearchTab
  research: WorkspaceResearchController
}

function getDraft(workspaceId: string, relativePath: string): MarkdownDraft | undefined {
  return storage.get<MarkdownDraftMap>(storage.KEYS.researchMarkdownDrafts, {}, workspaceId)[relativePath]
}

function setDraft(workspaceId: string, relativePath: string, draft: MarkdownDraft): void {
  const drafts = storage.get<MarkdownDraftMap>(storage.KEYS.researchMarkdownDrafts, {}, workspaceId)
  storage.set(storage.KEYS.researchMarkdownDrafts, { ...drafts, [relativePath]: draft }, workspaceId)
}

function removeDraft(workspaceId: string, relativePath: string): void {
  const drafts = storage.get<MarkdownDraftMap>(storage.KEYS.researchMarkdownDrafts, {}, workspaceId)
  const { [relativePath]: _removed, ...rest } = drafts
  storage.set(storage.KEYS.researchMarkdownDrafts, rest, workspaceId)
}

export function MarkdownResearchEditor({ tab, research }: MarkdownResearchEditorProps) {
  const { activeWorkspaceId } = useAppShellContext()
  const relativePath = tab.resource?.path
  const [content, setContent] = React.useState('')
  const [savedContent, setSavedContent] = React.useState('')
  const [baseVersion, setBaseVersion] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [conflict, setConflict] = React.useState(false)
  const [confirmReload, setConfirmReload] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const initialScrollTopRef = React.useRef(research.state.readingStateByTabId[tab.id]?.scrollTop ?? 0)
  const dirty = content !== savedContent
  const draftSnapshotRef = React.useRef<MarkdownDraft | null>(null)
  const setEditorStatus = research.setEditorStatus
  draftSnapshotRef.current = dirty && baseVersion
    ? { content, baseVersion, updatedAt: Date.now() }
    : null

  const load = React.useCallback(async (discardDraft = false) => {
    if (!activeWorkspaceId || !relativePath) return
    setLoading(true)
    setError(null)
    try {
      const document = await window.electronAPI.readWorkspaceMarkdown(activeWorkspaceId, relativePath)
      const draft = discardDraft ? undefined : getDraft(activeWorkspaceId, relativePath)
      setSavedContent(document.content)
      setContent(draft?.content ?? document.content)
      setBaseVersion(draft?.baseVersion ?? document.version)
      setConflict(Boolean(draft && draft.baseVersion !== document.version))
      if (discardDraft) removeDraft(activeWorkspaceId, relativePath)
      window.setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = initialScrollTopRef.current
        }
      }, 0)
    } catch (loadError) {
      const draft = getDraft(activeWorkspaceId, relativePath)
      if (draft) {
        setContent(draft.content)
        setSavedContent('')
        setBaseVersion(draft.baseVersion)
      }
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId, relativePath])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    const handleResearchChange = (event: Event) => {
      const detail = (event as CustomEvent<{ relativePath?: string }>).detail
      if (detail?.relativePath !== relativePath) return
      if (draftSnapshotRef.current) {
        setConflict(true)
      } else {
        void load(true)
      }
    }
    window.addEventListener('rocket:workspace-research-changed', handleResearchChange)
    return () => window.removeEventListener('rocket:workspace-research-changed', handleResearchChange)
  }, [load, relativePath])

  React.useEffect(() => {
    if (!activeWorkspaceId || !relativePath || !dirty || !baseVersion) return
    const timer = window.setTimeout(() => {
      setDraft(activeWorkspaceId, relativePath, { content, baseVersion, updatedAt: Date.now() })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [activeWorkspaceId, baseVersion, content, dirty, relativePath])

  React.useEffect(() => () => {
    const snapshot = draftSnapshotRef.current
    if (activeWorkspaceId && relativePath && snapshot) {
      setDraft(activeWorkspaceId, relativePath, snapshot)
    }
  }, [activeWorkspaceId, relativePath])

  const save = React.useCallback(async (): Promise<boolean> => {
    if (!dirty) return true
    if (!activeWorkspaceId || !relativePath || !baseVersion || saving) return false
    setSaving(true)
    setError(null)
    try {
      const document = await window.electronAPI.saveWorkspaceMarkdown({
        workspaceId: activeWorkspaceId,
        relativePath,
        content,
        expectedVersion: baseVersion,
      })
      setSavedContent(document.content)
      setContent(document.content)
      setBaseVersion(document.version)
      setConflict(false)
      draftSnapshotRef.current = null
      removeDraft(activeWorkspaceId, relativePath)
      toast.success('Markdown 已保存')
      return true
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError)
      setError(message)
      if (/VERSION_CONFLICT|changed after it was opened|文件.*变化/i.test(message)) setConflict(true)
      toast.error('保存失败', { description: message })
      return false
    } finally {
      setSaving(false)
    }
  }, [activeWorkspaceId, baseVersion, content, dirty, relativePath, saving])

  React.useEffect(() => {
    setEditorStatus(tab.id, { dirty, version: baseVersion, save })
    return () => setEditorStatus(tab.id, null)
  }, [baseVersion, dirty, save, setEditorStatus, tab.id])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [save])

  const scrollSaveTimerRef = React.useRef<number | null>(null)
  const handleScroll = React.useCallback(() => {
    if (scrollSaveTimerRef.current !== null) window.clearTimeout(scrollSaveTimerRef.current)
    scrollSaveTimerRef.current = window.setTimeout(() => {
      research.updateReadingState(tab.id, { scrollTop: scrollRef.current?.scrollTop ?? 0 })
      scrollSaveTimerRef.current = null
    }, 150)
  }, [research, tab.id])

  React.useEffect(() => () => {
    if (scrollSaveTimerRef.current !== null) window.clearTimeout(scrollSaveTimerRef.current)
  }, [])

  if (!relativePath || tab.resource?.mediaType !== 'text/markdown') return null

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex h-[42px] shrink-0 items-center gap-2 border-b border-border/50 px-3">
        <FileText className="h-3.5 w-3.5 text-foreground/55" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{tab.title}</h1>
          <p className="truncate text-[9px] text-muted-foreground">{relativePath}</p>
        </div>
        {dirty && (
          <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-current" /> 未保存
          </span>
        )}
        {dirty && (
          <Button size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => { void save() }} disabled={saving || loading}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存
          </Button>
        )}
      </div>

      {conflict && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/20 bg-amber-500/[0.08] px-3 py-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="min-w-0 flex-1">磁盘文件已变化，当前未保存内容仍保留。请确认后重新载入磁盘版本。</span>
          <button className="shrink-0 underline underline-offset-2" onClick={() => setConfirmReload(true)}>重新载入</button>
        </div>
      )}
      {error && !conflict && (
        <div className="flex shrink-0 items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <span className="min-w-0 flex-1 truncate">{error}</span>
          <button className="shrink-0 underline" onClick={() => { void load() }}>重试</button>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在读取 Markdown
          </div>
        ) : (
          <TiptapMarkdownEditor
            key={relativePath}
            content={content}
            onUpdate={setContent}
            placeholder="开始记录研究观点…"
            className="mx-auto min-h-full w-full max-w-3xl px-8 py-8"
            editable={!saving}
          />
        )}
      </div>

      <Dialog open={confirmReload} onOpenChange={setConfirmReload}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>放弃当前未保存修改？</DialogTitle>
            <DialogDescription>重新载入会清除本地编辑缓冲区，并显示磁盘中的最新版本。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReload(false)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmReload(false)
                void load(true)
              }}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />重新载入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
