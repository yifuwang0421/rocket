import { describe, expect, it } from 'bun:test'
import {
  OVERVIEW_TAB_ID,
  activateResearchTab,
  closeResearchTab,
  createDefaultWorkspaceResearchState,
  normalizeWorkspaceResearchState,
  openResearchTab,
  reorderResearchTabs,
  showStandaloneView,
  toPersistedWorkspaceResearchState,
  updateReadingState,
} from '../workspace-tabs'

describe('workspace research state', () => {
  it('starts with a pinned overview tab', () => {
    const state = createDefaultWorkspaceResearchState()

    expect(state.tabs).toEqual([
      { id: OVERVIEW_TAB_ID, title: '投研概览', type: 'overview', closable: false },
    ])
    expect(state.activeTabId).toBe(OVERVIEW_TAB_ID)
    expect(state.middleView).toEqual({ mode: 'research' })
  })

  it('normalizes corrupt state, removes duplicates, and restores research mode', () => {
    const state = normalizeWorkspaceResearchState({
      schemaVersion: 99,
      tabs: [
        { id: 'research:notes', title: '笔记', type: 'notes' },
        { id: 'research:notes', title: '重复笔记', type: 'notes' },
        { id: 'bad', title: 'Bad', type: 'unknown' },
      ],
      activeTabId: 'missing',
      lastResearchTabId: 'research:notes',
      middleView: { mode: 'standalone', view: 'settings' },
      readingStateByTabId: {
        'research:notes': { scrollTop: 120 },
        missing: { scrollTop: 200 },
      },
    })

    expect(state.tabs.map(tab => tab.id)).toEqual([OVERVIEW_TAB_ID, 'research:notes'])
    expect(state.activeTabId).toBe(OVERVIEW_TAB_ID)
    expect(state.lastResearchTabId).toBe('research:notes')
    expect(state.middleView).toEqual({ mode: 'research' })
    expect(state.readingStateByTabId).toEqual({ 'research:notes': { scrollTop: 120 } })
  })

  it('migrates persisted company and industry tab titles', () => {
    const state = normalizeWorkspaceResearchState({
      schemaVersion: 1,
      tabs: [
        { id: 'research:watchlist', title: '自选股', type: 'watchlist' },
        { id: 'research:sectors', title: '行业板块', type: 'sectors' },
      ],
      activeTabId: 'research:watchlist',
      lastResearchTabId: 'research:watchlist',
      readingStateByTabId: {},
      middleView: { mode: 'research' },
    })

    expect(state.tabs.find(tab => tab.type === 'watchlist')?.title).toBe('公司')
    expect(state.tabs.find(tab => tab.type === 'sectors')?.title).toBe('行业')
  })

  it('deduplicates tabs by canonical id and activates the existing tab', () => {
    const initial = createDefaultWorkspaceResearchState()
    const opened = openResearchTab(initial, {
      id: 'research:notes',
      title: '笔记',
      type: 'notes',
    })
    const reopened = openResearchTab(opened, {
      id: 'research:notes',
      title: '全部笔记',
      type: 'notes',
    })

    expect(reopened.tabs).toHaveLength(2)
    expect(reopened.tabs[1].title).toBe('全部笔记')
    expect(reopened.activeTabId).toBe('research:notes')
  })

  it('keeps overview pinned and selects a neighbor when closing the active tab', () => {
    let state = createDefaultWorkspaceResearchState()
    state = openResearchTab(state, { id: 'research:notes', title: '笔记', type: 'notes' })
    state = openResearchTab(state, { id: 'research:materials', title: '资料目录', type: 'materials' })
    state = reorderResearchTabs(state, ['research:materials', OVERVIEW_TAB_ID, 'research:notes'])

    expect(state.tabs.map(tab => tab.id)).toEqual([
      OVERVIEW_TAB_ID,
      'research:materials',
      'research:notes',
    ])

    state = closeResearchTab(state, 'research:materials')
    expect(state.tabs.map(tab => tab.id)).toEqual([OVERVIEW_TAB_ID, 'research:notes'])
    expect(state.activeTabId).toBe('research:notes')

    expect(closeResearchTab(state, OVERVIEW_TAB_ID)).toBe(state)
  })

  it('does not persist standalone administration mode', () => {
    let state = createDefaultWorkspaceResearchState()
    state = openResearchTab(state, { id: 'research:notes', title: '笔记', type: 'notes' })
    state = showStandaloneView(state, 'settings')

    expect(state.middleView).toEqual({ mode: 'standalone', view: 'settings' })
    expect(toPersistedWorkspaceResearchState(state).middleView).toEqual({ mode: 'research' })
    expect(toPersistedWorkspaceResearchState(state).activeTabId).toBe('research:notes')
  })

  it('stores reading state only for an open tab', () => {
    let state = createDefaultWorkspaceResearchState()
    state = openResearchTab(state, {
      id: 'file:documents/report.pdf',
      title: 'report.pdf',
      type: 'file',
      resource: { kind: 'file', path: 'documents/report.pdf', mediaType: 'application/pdf' },
    })
    state = updateReadingState(state, 'file:documents/report.pdf', {
      scrollTop: 480,
      pdfPage: 7,
      pdfZoom: 1.25,
    })

    expect(state.readingStateByTabId['file:documents/report.pdf']).toMatchObject({
      scrollTop: 480,
      pdfPage: 7,
      pdfZoom: 1.25,
    })

    const unchanged = updateReadingState(state, 'missing', { scrollTop: 1 })
    expect(unchanged).toBe(state)
    expect(activateResearchTab(state, 'missing')).toBe(state)
  })
})
