/**
 * Rocket research navigation.
 *
 * P1-2 navigation for the workspace-scoped research layout. Research content
 * opens as tabs; management surfaces replace the middle column without
 * disturbing the research tab state.
 */

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BookOpen,
  CalendarClock,
  ChevronRight,
  Database,
  NotebookPen,
  Plus,
  Settings,
  Sparkles,
  Star,
  Tags,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { WorkspaceResearchController } from '@/hooks/useWorkspaceResearchState'
import type { ResearchSessionActions } from '@/hooks/useResearchSessionActions'
import type { ResearchTab, StandaloneViewType } from '@/atoms/workspace-tabs'
import { cn } from '@/lib/utils'

interface ResearchControllerProps {
  research: WorkspaceResearchController
}

interface ResearchSidebarProps extends ResearchControllerProps {
  sessionActions: ResearchSessionActions
}

interface ResearchChild {
  id: string
  label: string
  icon: LucideIcon
  tab: ResearchTab
}

const WORKSPACE_CHILDREN: ResearchChild[] = [
  {
    id: 'watchlist',
    label: '公司',
    icon: Star,
    tab: { id: 'research:watchlist', title: '公司', type: 'watchlist' },
  },
  {
    id: 'sectors',
    label: '行业',
    icon: Tags,
    tab: { id: 'research:sectors', title: '行业', type: 'sectors' },
  },
  {
    id: 'notes',
    label: '笔记',
    icon: NotebookPen,
    tab: { id: 'research:notes', title: '笔记', type: 'notes' },
  },
]

function NavigationButton({
  icon: Icon,
  label,
  selected,
  onClick,
  disabled,
  title,
}: {
  icon: LucideIcon
  label: string
  selected?: boolean
  onClick?: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex w-full items-center gap-2 rounded-[6px] px-2 py-[5px] text-[13px] outline-none transition-colors',
        'focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
        disabled && 'cursor-not-allowed opacity-45',
        selected
          ? 'bg-foreground/[0.07] text-foreground'
          : 'text-foreground/75 hover:bg-sidebar-hover hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-foreground/60" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </button>
  )
}

function WorkspaceSection({ research }: ResearchControllerProps) {
  const [expanded, setExpanded] = React.useState(true)
  const { state, openTab } = research
  const overviewSelected = state.middleView.mode === 'research' && state.activeTabId === 'research:overview'

  return (
    <div>
      <div
        className={cn(
          'group flex items-center rounded-[6px] text-[13px] outline-none transition-colors',
          overviewSelected ? 'bg-foreground/[0.07]' : 'hover:bg-sidebar-hover',
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          className="ml-1 flex h-7 w-6 shrink-0 items-center justify-center rounded focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={expanded ? '收起工作区菜单' : '展开工作区菜单'}
          aria-expanded={expanded}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </button>
        <button
          type="button"
          onClick={() => openTab({ id: 'research:overview', title: '投研概览', type: 'overview', closable: false })}
          className="flex min-w-0 flex-1 items-center gap-2 py-[5px] pr-2 text-foreground/80 outline-none"
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-foreground/60" />
          <span className="truncate">工作区</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="relative grid gap-0.5 pl-5">
              <div className="absolute bottom-1 left-[13px] top-1 w-px bg-foreground/10" aria-hidden="true" />
              {WORKSPACE_CHILDREN.map(child => (
                <NavigationButton
                  key={child.id}
                  icon={child.icon}
                  label={child.label}
                  selected={state.middleView.mode === 'research' && state.activeTabId === child.tab.id}
                  onClick={() => openTab(child.tab)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StandaloneButton({
  research,
  view,
  icon,
  label,
}: ResearchControllerProps & { view: StandaloneViewType; icon: LucideIcon; label: string }) {
  return (
    <NavigationButton
      icon={icon}
      label={label}
      selected={research.state.middleView.mode === 'standalone' && research.state.middleView.view === view}
      onClick={() => research.openStandalone(view)}
    />
  )
}

function SourcesSection({ research }: ResearchControllerProps) {
  const [expanded, setExpanded] = React.useState(true)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 rounded-[6px] px-2 py-[5px] text-[13px] text-foreground/75 outline-none transition-colors hover:bg-sidebar-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        <Database className="h-3.5 w-3.5 text-foreground/60" />
        <span>数据源</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pl-5"
          >
            <NavigationButton
              icon={Database}
              label="MCP"
              selected={research.state.middleView.mode === 'standalone' && research.state.middleView.view === 'sources-mcp'}
              onClick={() => research.openStandalone('sources-mcp')}
            />
            <NavigationButton
              icon={Sparkles}
              label="API"
              selected={research.state.middleView.mode === 'standalone' && research.state.middleView.view === 'sources-api'}
              onClick={() => research.openStandalone('sources-api')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ResearchSidebar({ research, sessionActions }: ResearchSidebarProps) {
  return (
    <>
      <div className="shrink-0 px-2 pb-1.5 pt-2">
        <NavigationButton
          icon={Plus}
          label="新建会话"
          disabled={sessionActions.isCreating}
          title="在当前 Workspace 新建会话"
          onClick={() => { void sessionActions.createSession() }}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1">
        <nav className="grid gap-0.5" aria-label="研究导航">
          <WorkspaceSection research={research} />
          <div className="my-1 h-px bg-foreground/5" />
          <StandaloneButton research={research} view="skills" icon={Zap} label="Skills" />
          <SourcesSection research={research} />
          <StandaloneButton research={research} view="scheduled" icon={CalendarClock} label="定时任务" />
        </nav>
      </div>

      <div className="shrink-0 px-2 pb-2">
        <div className="mb-1 h-px bg-foreground/5" aria-hidden="true" />
        <StandaloneButton research={research} view="settings" icon={Settings} label="设置" />
      </div>
    </>
  )
}
