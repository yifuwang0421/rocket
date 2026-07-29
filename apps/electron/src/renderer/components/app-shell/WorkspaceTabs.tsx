/**
 * WorkspaceTabs — Middle panel content area.
 *
 * Shows different content depending on the active tab.
 * Uses @radix-ui/react-tabs to sync with the tab bar.
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { openTabsAtom, activeTabIdAtom } from '@/atoms/workspace-tabs'
import { WorkspaceTabBar } from './WorkspaceTabBar'

/** Home/Dashboard tab */
function HomeTab() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <h1 className="text-lg font-semibold text-foreground/90 mb-1">
          Rocket
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          AI-native investment research workbench
        </p>
        <div className="grid grid-cols-2 gap-2.5 text-left">
          {[
            { title: 'Watchlist', desc: 'Track your focus companies', icon: '📊' },
            { title: 'Industry Scan', desc: 'Quick industry overviews', icon: '🔍' },
            { title: 'Financial Analysis', desc: 'Deep-dive into company health', icon: '📈' },
            { title: 'Research Notes', desc: 'Capture your investment theses', icon: '📝' },
          ].map(item => (
            <div
              key={item.title}
              className="rounded-[8px] border border-border/30 p-3 hover:border-border/60 hover:bg-accent/5 transition-colors cursor-pointer"
            >
              <div className="text-base mb-1">{item.icon}</div>
              <div className="text-xs font-medium text-foreground/80">{item.title}</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Placeholder for file/note/report tabs */
function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground/40">
      <p className="text-sm">{title}</p>
    </div>
  )
}

function TabContent({ tabId }: { tabId: string }) {
  const allTabs = useAtomValue(openTabsAtom)
  if (tabId === '__home__') return <HomeTab />

  const tab = allTabs.find(t => t.id === tabId)
  if (!tab) return null

  switch (tab.type) {
    case 'file':
      return <PlaceholderTab title={`File: ${tab.title}`} />
    case 'note':
      return <PlaceholderTab title={`Note: ${tab.title}`} />
    case 'report':
      return <PlaceholderTab title={`Report: ${tab.title}`} />
    case 'chart':
      return <PlaceholderTab title={`Chart: ${tab.title}`} />
    default:
      return <PlaceholderTab title={tab.title} />
  }
}

export function WorkspaceTabs() {
  const activeTabId = useAtomValue(activeTabIdAtom)

  return (
    <>
      <WorkspaceTabBar />
      <div className="flex-1 flex flex-col min-h-0 overflow-auto">
        <TabContent tabId={activeTabId} />
      </div>
    </>
  )
}
