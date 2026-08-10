/**
 * Workspace-scoped research state contracts and pure state transitions.
 *
 * Persistence is intentionally handled by `useWorkspaceResearchState` so this
 * module remains deterministic and easy to test. Standalone administration
 * pages are runtime-only: restoring a workspace always returns to research.
 */

export const RESEARCH_STATE_SCHEMA_VERSION = 1 as const
export const OVERVIEW_TAB_ID = 'research:overview'

export type ResearchTabType =
  | 'overview'
  | 'watchlist'
  | 'sectors'
  | 'notes'
  | 'materials'
  | 'note'
  | 'file'
  | 'company'
  | 'industry'

/** Compatibility alias used by the P1 prototype components. */
export type TabType = ResearchTabType

export type StandaloneViewType =
  | 'skills'
  | 'sources-mcp'
  | 'sources-api'
  | 'scheduled'
  | 'settings'

export type ResourceKind = 'note' | 'file' | 'company' | 'industry'

export interface ResourceRef {
  kind: ResourceKind
  /** Workspace-relative path. Absolute paths are never persisted here. */
  path?: string
  /** Stable structured-resource id for companies and industries. */
  resourceId?: string
  mediaType?: string
  metadata?: Record<string, string | number | boolean | null>
}

export interface ResearchTab {
  /** Stable canonical id. Resource tabs use their resource identity. */
  id: string
  title: string
  type: ResearchTabType
  closable?: boolean
  resource?: ResourceRef
}

/** Compatibility alias used by the P1 prototype components. */
export type TabData = ResearchTab

export interface ReadingState {
  scrollTop?: number
  pdfPage?: number
  pdfZoom?: number
  /** Viewer-specific anchor such as a heading, worksheet, or cell. */
  anchor?: string
  updatedAt?: number
}

export type MiddleViewMode =
  | { mode: 'research' }
  | { mode: 'standalone'; view: StandaloneViewType }

export interface WorkspaceResearchState {
  schemaVersion: typeof RESEARCH_STATE_SCHEMA_VERSION
  tabs: ResearchTab[]
  activeTabId: string
  lastResearchTabId: string
  readingStateByTabId: Record<string, ReadingState>
  middleView: MiddleViewMode
}

const VALID_TAB_TYPES = new Set<ResearchTabType>([
  'overview',
  'watchlist',
  'sectors',
  'notes',
  'materials',
  'note',
  'file',
  'company',
  'industry',
])

const VALID_RESOURCE_KINDS = new Set<ResourceKind>(['note', 'file', 'company', 'industry'])

export const OVERVIEW_TAB: ResearchTab = {
  id: OVERVIEW_TAB_ID,
  title: '投研概览',
  type: 'overview',
  closable: false,
}

export function createDefaultWorkspaceResearchState(): WorkspaceResearchState {
  return {
    schemaVersion: RESEARCH_STATE_SCHEMA_VERSION,
    tabs: [{ ...OVERVIEW_TAB }],
    activeTabId: OVERVIEW_TAB_ID,
    lastResearchTabId: OVERVIEW_TAB_ID,
    readingStateByTabId: {},
    middleView: { mode: 'research' },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeResource(value: unknown): ResourceRef | undefined {
  if (!isRecord(value) || !VALID_RESOURCE_KINDS.has(value.kind as ResourceKind)) return undefined

  const metadata = isRecord(value.metadata)
    ? Object.fromEntries(
        Object.entries(value.metadata).filter((entry): entry is [string, string | number | boolean | null] => {
          const item = entry[1]
          return item === null || ['string', 'number', 'boolean'].includes(typeof item)
        }),
      )
    : undefined

  return {
    kind: value.kind as ResourceKind,
    path: typeof value.path === 'string' ? value.path : undefined,
    resourceId: typeof value.resourceId === 'string' ? value.resourceId : undefined,
    mediaType: typeof value.mediaType === 'string' ? value.mediaType : undefined,
    metadata,
  }
}

function normalizeTab(value: unknown): ResearchTab | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || value.id.length === 0) return null
  if (typeof value.title !== 'string' || value.title.length === 0) return null
  if (!VALID_TAB_TYPES.has(value.type as ResearchTabType)) return null

  if (value.id === OVERVIEW_TAB_ID || value.type === 'overview') return { ...OVERVIEW_TAB }

  const type = value.type as ResearchTabType
  const title = type === 'watchlist' ? '公司' : type === 'sectors' ? '行业' : value.title

  return {
    id: value.id,
    title,
    type,
    closable: value.closable !== false,
    resource: normalizeResource(value.resource),
  }
}

function normalizeReadingState(value: unknown): ReadingState | null {
  if (!isRecord(value)) return null
  const state: ReadingState = {}
  if (typeof value.scrollTop === 'number' && Number.isFinite(value.scrollTop)) state.scrollTop = value.scrollTop
  if (typeof value.pdfPage === 'number' && Number.isFinite(value.pdfPage)) state.pdfPage = value.pdfPage
  if (typeof value.pdfZoom === 'number' && Number.isFinite(value.pdfZoom)) state.pdfZoom = value.pdfZoom
  if (typeof value.anchor === 'string') state.anchor = value.anchor
  if (typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)) state.updatedAt = value.updatedAt
  return state
}

/**
 * Validate persisted state and migrate legacy/invalid data to the v1 contract.
 * Runtime-only standalone mode is deliberately reset to research on restore.
 */
export function normalizeWorkspaceResearchState(value: unknown): WorkspaceResearchState {
  if (!isRecord(value)) return createDefaultWorkspaceResearchState()

  const rawTabs = Array.isArray(value.tabs) ? value.tabs : []
  const seen = new Set<string>()
  const normalizedTabs: ResearchTab[] = []

  for (const rawTab of rawTabs) {
    const tab = normalizeTab(rawTab)
    if (!tab || seen.has(tab.id)) continue
    seen.add(tab.id)
    normalizedTabs.push(tab)
  }

  const tabs = [
    { ...OVERVIEW_TAB },
    ...normalizedTabs.filter(tab => tab.id !== OVERVIEW_TAB_ID),
  ]
  const tabIds = new Set(tabs.map(tab => tab.id))
  const candidateActiveId = typeof value.activeTabId === 'string' ? value.activeTabId : OVERVIEW_TAB_ID
  const activeTabId = tabIds.has(candidateActiveId) ? candidateActiveId : OVERVIEW_TAB_ID
  const candidateLastId = typeof value.lastResearchTabId === 'string' ? value.lastResearchTabId : activeTabId
  const lastResearchTabId = tabIds.has(candidateLastId) ? candidateLastId : activeTabId

  const readingStateByTabId: Record<string, ReadingState> = {}
  if (isRecord(value.readingStateByTabId)) {
    for (const [tabId, rawReadingState] of Object.entries(value.readingStateByTabId)) {
      if (!tabIds.has(tabId)) continue
      const readingState = normalizeReadingState(rawReadingState)
      if (readingState) readingStateByTabId[tabId] = readingState
    }
  }

  return {
    schemaVersion: RESEARCH_STATE_SCHEMA_VERSION,
    tabs,
    activeTabId,
    lastResearchTabId,
    readingStateByTabId,
    middleView: { mode: 'research' },
  }
}

/** Persisted snapshots never restore a standalone administration page. */
export function toPersistedWorkspaceResearchState(state: WorkspaceResearchState): WorkspaceResearchState {
  return normalizeWorkspaceResearchState({
    ...state,
    middleView: { mode: 'research' },
  })
}

export function openResearchTab(state: WorkspaceResearchState, input: ResearchTab): WorkspaceResearchState {
  const tab = normalizeTab(input)
  if (!tab) return state

  const existingIndex = state.tabs.findIndex(item => item.id === tab.id)
  const tabs = existingIndex === -1
    ? [...state.tabs, tab]
    : state.tabs.map((item, index) => index === existingIndex ? { ...item, ...tab } : item)

  return {
    ...state,
    tabs,
    activeTabId: tab.id,
    lastResearchTabId: tab.id,
    middleView: { mode: 'research' },
  }
}

export function activateResearchTab(state: WorkspaceResearchState, tabId: string): WorkspaceResearchState {
  if (!state.tabs.some(tab => tab.id === tabId)) return state
  return {
    ...state,
    activeTabId: tabId,
    lastResearchTabId: tabId,
    middleView: { mode: 'research' },
  }
}

export function closeResearchTab(state: WorkspaceResearchState, tabId: string): WorkspaceResearchState {
  const index = state.tabs.findIndex(tab => tab.id === tabId)
  const tab = state.tabs[index]
  if (!tab || tab.id === OVERVIEW_TAB_ID || tab.closable === false) return state

  const tabs = state.tabs.filter(item => item.id !== tabId)
  const fallbackId = tabs[Math.min(index, tabs.length - 1)]?.id ?? OVERVIEW_TAB_ID
  const activeTabId = state.activeTabId === tabId ? fallbackId : state.activeTabId
  const { [tabId]: _removed, ...readingStateByTabId } = state.readingStateByTabId

  return {
    ...state,
    tabs,
    activeTabId,
    lastResearchTabId: state.lastResearchTabId === tabId ? activeTabId : state.lastResearchTabId,
    readingStateByTabId,
  }
}

export function reorderResearchTabs(state: WorkspaceResearchState, orderedIds: string[]): WorkspaceResearchState {
  const byId = new Map(state.tabs.map(tab => [tab.id, tab]))
  const ordered = orderedIds
    .filter(id => id !== OVERVIEW_TAB_ID)
    .map(id => byId.get(id))
    .filter((tab): tab is ResearchTab => Boolean(tab))
  const orderedSet = new Set(ordered.map(tab => tab.id))
  const remainder = state.tabs.filter(tab => tab.id !== OVERVIEW_TAB_ID && !orderedSet.has(tab.id))

  return {
    ...state,
    tabs: [{ ...OVERVIEW_TAB }, ...ordered, ...remainder],
  }
}

export function showStandaloneView(
  state: WorkspaceResearchState,
  view: StandaloneViewType,
): WorkspaceResearchState {
  return {
    ...state,
    lastResearchTabId: state.activeTabId,
    middleView: { mode: 'standalone', view },
  }
}

export function showResearchView(state: WorkspaceResearchState): WorkspaceResearchState {
  const activeTabId = state.tabs.some(tab => tab.id === state.lastResearchTabId)
    ? state.lastResearchTabId
    : OVERVIEW_TAB_ID
  return {
    ...state,
    activeTabId,
    lastResearchTabId: activeTabId,
    middleView: { mode: 'research' },
  }
}

export function updateReadingState(
  state: WorkspaceResearchState,
  tabId: string,
  readingState: ReadingState,
): WorkspaceResearchState {
  if (!state.tabs.some(tab => tab.id === tabId)) return state
  return {
    ...state,
    readingStateByTabId: {
      ...state.readingStateByTabId,
      [tabId]: { ...readingState, updatedAt: readingState.updatedAt ?? Date.now() },
    },
  }
}
