/**
 * WorkspaceTabBar — Tab strip for the main workspace panel.
 *
 * VS Code-style tab bar with close buttons.
 * Uses @radix-ui/react-tabs primitives for accessibility.
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { X, FileText, Home, BarChart3 } from 'lucide-react'
import { openTabsAtom, activeTabIdAtom, closeTabAtom, type TabData } from '@/atoms/workspace-tabs'
import { cn } from '@/lib/utils'

const TAB_ICONS: Record<string, React.ReactNode> = {
  home: <Home className="h-3 w-3" />,
  file: <FileText className="h-3 w-3" />,
  note: <FileText className="h-3 w-3" />,
  report: <BarChart3 className="h-3 w-3" />,
  chart: <BarChart3 className="h-3 w-3" />,
}

function Tab({ tab, isActive, onSelect, onClose }: {
  tab: TabData
  isActive: boolean
  onSelect: () => void
  onClose: () => void
}) {
  return (
    <div
      role="tab"
      aria-selected={isActive}
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer select-none shrink-0',
        'border-r border-border/20 transition-colors whitespace-nowrap',
        'relative',
        isActive
          ? 'bg-background text-foreground shadow-minimal'
          : 'bg-muted/20 text-muted-foreground/70 hover:text-foreground hover:bg-muted/30',
      )}
    >
      {tab.icon || TAB_ICONS[tab.type]}
      <span className="truncate max-w-[140px]">{tab.title}</span>
      {tab.closable !== false && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className={cn(
            'shrink-0 ml-1 rounded-sm p-0.5 transition-opacity',
            isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-40 hover:opacity-100',
            'hover:bg-muted-foreground/10',
          )}
          aria-label="Close tab"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}

export function WorkspaceTabBar() {
  const tabs = useAtomValue(openTabsAtom)
  const activeId = useAtomValue(activeTabIdAtom)
  const setActiveTab = useSetAtom(activeTabIdAtom)
  const closeTab = useSetAtom(closeTabAtom)

  return (
    <div
      role="tablist"
      className="flex items-stretch overflow-x-auto scrollbar-none bg-muted/10 border-b border-border/30 shrink-0"
    >
      {tabs.map(tab => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeId}
          onSelect={() => setActiveTab(tab.id)}
          onClose={() => closeTab(tab.id)}
        />
      ))}
    </div>
  )
}
