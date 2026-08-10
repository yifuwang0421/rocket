import * as React from 'react'
import { atom, useAtom } from 'jotai'
import { atomFamily } from 'jotai-family'
import {
  activateResearchTab,
  closeResearchTab,
  createDefaultWorkspaceResearchState,
  normalizeWorkspaceResearchState,
  openResearchTab,
  reorderResearchTabs,
  showResearchView,
  showStandaloneView,
  toPersistedWorkspaceResearchState,
  updateReadingState,
  type ReadingState,
  type ResearchTab,
  type StandaloneViewType,
  type WorkspaceResearchState,
} from '@/atoms/workspace-tabs'
import * as storage from '@/lib/local-storage'

const EMPTY_WORKSPACE_KEY = '__rocket_no_workspace__'

function loadWorkspaceState(workspaceId: string): WorkspaceResearchState {
  if (workspaceId === EMPTY_WORKSPACE_KEY) return createDefaultWorkspaceResearchState()
  const stored = storage.get<unknown>(storage.KEYS.researchWorkspaceState, null, workspaceId)
  return normalizeWorkspaceResearchState(stored)
}

const workspaceResearchStateAtomFamily = atomFamily(
  (workspaceId: string) => atom<WorkspaceResearchState>(loadWorkspaceState(workspaceId)),
  (a, b) => a === b,
)

export interface WorkspaceResearchController {
  state: WorkspaceResearchState
  editorStatusByTabId: Record<string, ResearchEditorStatus>
  openTab: (tab: ResearchTab) => void
  activateTab: (tabId: string) => void
  closeTab: (tabId: string) => void
  reorderTabs: (orderedIds: string[]) => void
  openStandalone: (view: StandaloneViewType) => void
  returnToResearch: () => void
  updateReadingState: (tabId: string, readingState: ReadingState) => void
  setEditorStatus: (tabId: string, status: ResearchEditorStatus | null) => void
}

export interface ResearchEditorStatus {
  dirty: boolean
  version: string
  save: () => Promise<boolean>
}

/**
 * Reactive controller for the active workspace's research UI state.
 * Each workspace gets an isolated atom and localStorage snapshot.
 */
export function useWorkspaceResearchState(workspaceId: string | null): WorkspaceResearchController {
  const workspaceKey = workspaceId ?? EMPTY_WORKSPACE_KEY
  const stateAtom = React.useMemo(
    () => workspaceResearchStateAtomFamily(workspaceKey),
    [workspaceKey],
  )
  const [state, setState] = useAtom(stateAtom)
  const [editorStatusByTabId, setEditorStatusByTabId] = React.useState<Record<string, ResearchEditorStatus>>({})

  React.useEffect(() => setEditorStatusByTabId({}), [workspaceKey])

  const setEditorStatus = React.useCallback((tabId: string, status: ResearchEditorStatus | null) => {
    setEditorStatusByTabId(current => {
      if (!status) {
        const { [tabId]: _removed, ...rest } = current
        return rest
      }
      return { ...current, [tabId]: status }
    })
  }, [])

  React.useEffect(() => {
    if (!workspaceId) return
    storage.set(
      storage.KEYS.researchWorkspaceState,
      toPersistedWorkspaceResearchState(state),
      workspaceId,
    )
  }, [state, workspaceId])

  return React.useMemo(() => ({
    state,
    editorStatusByTabId,
    openTab: (tab: ResearchTab) => setState(current => openResearchTab(current, tab)),
    activateTab: (tabId: string) => setState(current => activateResearchTab(current, tabId)),
    closeTab: (tabId: string) => setState(current => closeResearchTab(current, tabId)),
    reorderTabs: (orderedIds: string[]) => setState(current => reorderResearchTabs(current, orderedIds)),
    openStandalone: (view: StandaloneViewType) => setState(current => showStandaloneView(current, view)),
    returnToResearch: () => setState(current => showResearchView(current)),
    updateReadingState: (tabId: string, readingState: ReadingState) => {
      setState(current => updateReadingState(current, tabId, readingState))
    },
    setEditorStatus,
  }), [editorStatusByTabId, setEditorStatus, setState, state])
}
