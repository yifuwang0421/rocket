import * as React from 'react'
import {
  BookOpen,
  Building2,
  FileText,
  FolderOpen,
  Landmark,
  NotebookPen,
  Star,
  Tags,
  X,
} from 'lucide-react'
import type { ResearchTab } from '@/atoms/workspace-tabs'
import { cn } from '@/lib/utils'

const TAB_ICONS: Record<ResearchTab['type'], React.ReactNode> = {
  overview: <BookOpen />,
  watchlist: <Star />,
  sectors: <Tags />,
  notes: <NotebookPen />,
  materials: <FolderOpen />,
  note: <NotebookPen />,
  file: <FileText />,
  company: <Building2 />,
  industry: <Landmark />,
}

export interface WorkspaceTabBarProps {
  tabs: ResearchTab[]
  activeTabId: string
  onActivate: (tabId: string) => void
  onClose: (tabId: string) => void
}

export function getResearchTabDomId(tabId: string): string {
  return `research-tab-${encodeURIComponent(tabId)}`
}

const Tab = React.forwardRef<HTMLButtonElement, {
  tab: ResearchTab
  active: boolean
  onActivate: () => void
  onClose: () => void
  onNavigate: (key: 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End') => void
}>(function Tab({ tab, active, onActivate, onClose, onNavigate }, ref) {
  const tabId = getResearchTabDomId(tab.id)
  return (
    <div
      role="presentation"
      title={tab.title}
      className={cn(
        'workspace-research-tab group relative flex h-7 min-w-0 flex-1 basis-0 select-none items-center overflow-hidden rounded-[6px] text-xs',
        active
          ? 'bg-background text-foreground shadow-minimal'
          : 'text-foreground/60 hover:bg-foreground/3 hover:text-foreground',
      )}
    >
      <button
        ref={ref}
        id={tabId}
        type="button"
        role="tab"
        aria-selected={active}
        aria-controls={`${tabId}-panel`}
        tabIndex={active ? 0 : -1}
        onClick={onActivate}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            onNavigate(event.key)
          } else if ((event.key === 'Delete' || event.key === 'Backspace') && tab.closable !== false) {
            event.preventDefault()
            onClose()
          }
        }}
        className={cn(
          'workspace-research-tab__content flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-[6px] px-2 text-left outline-none',
          'focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
          tab.closable !== false && 'pr-7',
        )}
      >
        <span className="workspace-research-tab__icon shrink-0 text-foreground/55 [&>svg]:h-3.5 [&>svg]:w-3.5">
          {TAB_ICONS[tab.type]}
        </span>
        <span className="workspace-research-tab__title min-w-0 flex-1 truncate">{tab.title}</span>
      </button>
      {tab.closable !== false && (
        <button
          type="button"
          onClick={event => {
            event.stopPropagation()
            onClose()
          }}
          className={cn(
            'workspace-research-tab__close absolute right-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded outline-none transition-opacity hover:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
            active ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:opacity-100',
          )}
          aria-label={`关闭 ${tab.title}`}
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  )
})

export function WorkspaceTabBar({ tabs, activeTabId, onActivate, onClose }: WorkspaceTabBarProps) {
  const tabRefs = React.useRef(new Map<string, HTMLButtonElement>())

  const moveFocus = React.useCallback((tabId: string, key: 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End') => {
    const currentIndex = tabs.findIndex(tab => tab.id === tabId)
    if (currentIndex < 0 || tabs.length === 0) return
    const nextIndex = key === 'Home'
      ? 0
      : key === 'End'
        ? tabs.length - 1
        : (currentIndex + (key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length
    const nextTab = tabs[nextIndex]
    onActivate(nextTab.id)
    tabRefs.current.get(nextTab.id)?.focus()
  }, [onActivate, tabs])

  return (
    <div
      role="tablist"
      aria-label="研究标签页"
      className="flex h-[42px] shrink-0 items-center gap-px overflow-hidden border-b border-border/50 bg-foreground-2 px-2"
    >
      {tabs.map(tab => (
        <Tab
          key={tab.id}
          tab={tab}
          active={tab.id === activeTabId}
          onActivate={() => onActivate(tab.id)}
          onClose={() => onClose(tab.id)}
          onNavigate={key => moveFocus(tab.id, key)}
          ref={element => {
            if (element) tabRefs.current.set(tab.id, element)
            else tabRefs.current.delete(tab.id)
          }}
        />
      ))}
    </div>
  )
}
