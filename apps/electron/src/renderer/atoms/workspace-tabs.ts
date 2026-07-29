/**
 * Workspace tabs state — manages open tabs in the middle panel.
 *
 * Each tab represents an open "document" (file, note, analysis result, etc.).
 * Tabs track their type, title, and content state so switching between them
 * preserves the user's context.
 */

import { atom } from 'jotai'
import type { ReactNode } from 'react'

export type TabType = 'file' | 'note' | 'report' | 'chart' | 'home'

export interface TabData {
  /** Unique tab identifier (e.g. file path, note id, session id) */
  id: string
  /** Display title shown in the tab bar */
  title: string
  /** Tab category — determines the content renderer */
  type: TabType
  /** Optional icon to show in the tab bar */
  icon?: ReactNode
  /** Whether the tab can be closed by the user */
  closable?: boolean
}

/** All currently open tabs, ordered left to right */
export const openTabsAtom = atom<TabData[]>([
  // Default: a "Home" tab as the first tab
  { id: '__home__', title: 'Home', type: 'home', closable: false },
])

/** The currently active tab id */
export const activeTabIdAtom = atom<string>('__home__')

/** Open (or switch to) a tab. If it already exists, just activates it. */
export const openTabAtom = atom(
  null,
  (get, set, tab: TabData) => {
    const tabs = get(openTabsAtom)
    const existing = tabs.find(t => t.id === tab.id)
    if (existing) {
      set(activeTabIdAtom, tab.id)
      return
    }
    // Insert before the last tab (keep home tab at end) or append
    const insertAt = Math.max(0, tabs.length - (tabs[tabs.length - 1]?.id === '__home__' ? 1 : 0))
    const newTabs = [...tabs]
    newTabs.splice(insertAt, 0, tab)
    set(openTabsAtom, newTabs)
    set(activeTabIdAtom, tab.id)
  }
)

/** Close a tab by id */
export const closeTabAtom = atom(
  null,
  (get, set, tabId: string) => {
    const tabs = get(openTabsAtom)
    const idx = tabs.findIndex(t => t.id === tabId)
    if (idx === -1) return
    const newTabs = tabs.filter(t => t.id !== tabId)

    // If we closed the active tab, activate a neighbor
    const activeId = get(activeTabIdAtom)
    if (activeId === tabId && newTabs.length > 0) {
      const newIdx = Math.min(idx, newTabs.length - 1)
      set(activeTabIdAtom, newTabs[newIdx].id)
    }

    set(openTabsAtom, newTabs.length > 0 ? newTabs : [
      { id: '__home__', title: 'Home', type: 'home', closable: false },
    ])
  }
)
