import * as React from 'react'
import { useAtomValue } from 'jotai'
import { AnimatePresence, motion } from 'motion/react'
import { Bot, History, Loader2, MessageSquareText, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { sessionMetaMapAtom } from '@/atoms/sessions'
import { HeaderIconButton } from '@/components/ui/HeaderIconButton'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { AppShellProvider, useAppShellContext } from '@/context/AppShellContext'
import { useSession as useSelectedSession } from '@/hooks/useSession'
import type { ResearchSessionActions } from '@/hooks/useResearchSessionActions'
import type { WorkspaceResearchController } from '@/hooks/useWorkspaceResearchState'
import type { WorkspaceAgentContextRef } from '@rocket/shared/protocol'
import ChatPage from '@/pages/ChatPage'
import { getSessionTitle } from '@/utils/session'
import { cn } from '@/lib/utils'
import { filterWorkspaceSessionHistory } from './research-session-history'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const SUGGESTED_PROMPTS = [
  '对比贵州茅台与五粮液的毛利率',
  '扫描新能源板块本周动态',
  '总结当前 Workspace 的调研笔记',
]

interface ChatPanelProps {
  sessionActions: ResearchSessionActions
  research: WorkspaceResearchController
}

function formatSessionTime(timestamp?: number): string {
  if (!timestamp) return '尚未发送消息'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function ResearchChatHeaderActions({
  onOpenHistory,
  onNewSession,
  isCreating,
}: {
  onOpenHistory: () => void
  onNewSession: () => void
  isCreating: boolean
}) {
  return (
    <div className="flex items-center gap-0.5">
      <HeaderIconButton
        icon={<History className="h-3.5 w-3.5" />}
        tooltip="历史会话"
        onClick={onOpenHistory}
      />
      <HeaderIconButton
        icon={isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        tooltip="新建会话"
        onClick={onNewSession}
        disabled={isCreating}
      />
    </div>
  )
}

function SessionHistoryOverlay({
  open,
  onOpenChange,
  activeSessionId,
  sessionActions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeSessionId: string | null
  sessionActions: ResearchSessionActions
}) {
  const { activeWorkspaceId } = useAppShellContext()
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const sessions = React.useMemo(
    () => filterWorkspaceSessionHistory(sessionMetaMap.values(), activeWorkspaceId, query),
    [activeWorkspaceId, query, sessionMetaMap],
  )

  React.useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onOpenChange, open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-floating-menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="历史会话"
        >
          <button
            className="absolute inset-0 bg-background/35 backdrop-blur-[1px]"
            onClick={() => onOpenChange(false)}
            aria-label="关闭历史会话"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute bottom-0 right-0 top-0 flex w-[min(94%,360px)] flex-col border-l border-border/60 bg-foreground-2 shadow-modal-small"
          >
            <div className="flex h-[42px] shrink-0 items-center gap-2 border-b border-border/50 px-3">
              <MessageSquareText className="h-3.5 w-3.5 text-foreground/55" />
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">历史会话</h2>
              <HeaderIconButton icon={<X className="h-3.5 w-3.5" />} tooltip="关闭" onClick={() => onOpenChange(false)} />
            </div>
            <div className="shrink-0 p-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="搜索当前 Workspace 会话"
                  className="h-8 bg-background pl-8 text-xs"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {sessions.length === 0 ? (
                <div className="px-3 py-10 text-center text-xs text-muted-foreground">
                  {query ? '没有匹配的会话' : '当前 Workspace 暂无历史会话'}
                </div>
              ) : sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => {
                    sessionActions.selectSession(session.id)
                    onOpenChange(false)
                  }}
                  className={cn(
                    'mb-1 w-full rounded-[8px] px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring',
                    session.id === activeSessionId ? 'bg-foreground/[0.08]' : 'hover:bg-foreground/[0.05]',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{getSessionTitle(session)}</span>
                    {session.isProcessing && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{formatSessionTime(session.lastMessageAt ?? session.createdAt)}</span>
                    {session.isArchived && <span>已归档</span>}
                    {session.hasUnread && <span className="text-accent">未读</span>}
                  </div>
                </button>
              ))}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ChatPanel({ sessionActions, research }: ChatPanelProps) {
  const shellContext = useAppShellContext()
  const [{ selected }] = useSelectedSession()
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [researchContext, setResearchContext] = React.useState<WorkspaceAgentContextRef | null>(null)
  const [dismissedContextKey, setDismissedContextKey] = React.useState<string | null>(null)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = React.useState(false)
  const unsavedChoiceRef = React.useRef<((choice: 'save' | 'saved' | 'cancel') => void) | null>(null)
  const { createSession, isCreating } = sessionActions
  const activeSessionId = selected && sessionMetaMap.get(selected)?.workspaceId === shellContext.activeWorkspaceId
    ? selected
    : null
  const activeResearchTab = research.state.middleView.mode === 'research'
    ? research.state.tabs.find(tab => tab.id === research.state.activeTabId)
    : undefined
  const activeRelativePath = activeResearchTab?.resource?.path
  const contextKey = activeSessionId && activeResearchTab
    ? `${activeSessionId}:${activeResearchTab.id}`
    : null

  React.useEffect(() => {
    let cancelled = false
    if (!shellContext.activeWorkspaceId || !activeRelativePath || !contextKey || dismissedContextKey === contextKey) {
      setResearchContext(null)
      return
    }
    void window.electronAPI.getWorkspaceAgentContext(shellContext.activeWorkspaceId, activeRelativePath)
      .then(context => { if (!cancelled) setResearchContext(context) })
      .catch(() => { if (!cancelled) setResearchContext(null) })
    return () => { cancelled = true }
  }, [activeRelativePath, contextKey, dismissedContextKey, shellContext.activeWorkspaceId])

  const chooseUnsavedAction = React.useCallback(() => new Promise<'save' | 'saved' | 'cancel'>(resolve => {
    unsavedChoiceRef.current = resolve
    setUnsavedDialogOpen(true)
  }), [])

  const resolveUnsavedAction = React.useCallback((choice: 'save' | 'saved' | 'cancel') => {
    setUnsavedDialogOpen(false)
    unsavedChoiceRef.current?.(choice)
    unsavedChoiceRef.current = null
  }, [])

  const beforeResearchContextSubmit = React.useCallback(async (): Promise<WorkspaceAgentContextRef[] | false> => {
    if (!researchContext || !activeResearchTab) return []
    const editorStatus = research.editorStatusByTabId[activeResearchTab.id]
    if (!editorStatus?.dirty) return [researchContext]

    const choice = await chooseUnsavedAction()
    if (choice === 'cancel') return false
    if (choice === 'saved') return [{ ...researchContext, writePolicy: 'read-only' }]
    if (!await editorStatus.save()) return false
    if (!shellContext.activeWorkspaceId) return false
    const savedContext = await window.electronAPI.getWorkspaceAgentContext(
      shellContext.activeWorkspaceId,
      researchContext.relativePath,
    )
    setResearchContext(savedContext)
    return [savedContext]
  }, [activeResearchTab, chooseUnsavedAction, research.editorStatusByTabId, researchContext, shellContext.activeWorkspaceId])

  const handleNewSession = React.useCallback(async (draft?: string) => {
    try {
      setHistoryOpen(false)
      await createSession(draft)
    } catch (error) {
      toast.error('无法新建会话', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }, [createSession])

  const headerActions = React.useMemo(() => (
    <ResearchChatHeaderActions
      onOpenHistory={() => setHistoryOpen(true)}
      onNewSession={() => { void handleNewSession() }}
      isCreating={isCreating}
    />
  ), [handleNewSession, isCreating])

  const nestedContext = React.useMemo(() => ({
    ...shellContext,
    rightSidebarButton: headerActions,
    isCompactMode: true,
    isFocusedPanel: true,
  }), [headerActions, shellContext])

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {activeSessionId ? (
        <AppShellProvider value={nestedContext}>
          <ChatPage
            sessionId={activeSessionId}
            overlayPresentation="popover"
            researchContexts={researchContext ? [researchContext] : []}
            onRemoveResearchContext={() => {
              setDismissedContextKey(contextKey)
              setResearchContext(null)
            }}
            beforeResearchContextSubmit={beforeResearchContextSubmit}
          />
        </AppShellProvider>
      ) : (
        <>
          <div className="flex h-[42px] shrink-0 items-center gap-2 border-b border-border/50 px-3">
            <Bot className="h-3.5 w-3.5 text-accent" />
            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">研究助手</h1>
            {headerActions}
          </div>
          <Empty className="gap-4">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Bot /></EmptyMedia>
              <EmptyTitle>开始一段研究对话</EmptyTitle>
              <EmptyDescription>会话仅显示在当前 Workspace，并可从右上角历史记录中切换。</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-col items-stretch gap-1.5 px-6">
              {SUGGESTED_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => { void handleNewSession(prompt) }}
                  disabled={isCreating}
                  className="rounded-[8px] bg-background px-3 py-2 text-left text-xs text-foreground/70 shadow-minimal outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </EmptyContent>
          </Empty>
        </>
      )}
      <SessionHistoryOverlay
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        activeSessionId={activeSessionId}
        sessionActions={sessionActions}
      />
      <Dialog open={unsavedDialogOpen} onOpenChange={open => { if (!open) resolveUnsavedAction('cancel') }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>这份笔记尚未保存</DialogTitle>
            <DialogDescription>Agent 只能读取磁盘上的版本。请选择本次发送使用哪个版本。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" onClick={() => resolveUnsavedAction('cancel')}>取消</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => resolveUnsavedAction('saved')}>使用已保存版本</Button>
              <Button onClick={() => resolveUnsavedAction('save')}>保存并发送</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
