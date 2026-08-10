import { describe, expect, it } from 'bun:test'
import type { SessionMeta } from '@/atoms/sessions'
import { filterWorkspaceSessionHistory } from '../research-session-history'

function session(overrides: Partial<SessionMeta> & Pick<SessionMeta, 'id' | 'workspaceId'>): SessionMeta {
  return { ...overrides }
}

describe('research session history', () => {
  it('keeps visible sessions in the current workspace and sorts newest first', () => {
    const result = filterWorkspaceSessionHistory([
      session({ id: 'old', workspaceId: 'ws-1', name: 'Old', lastMessageAt: 10 }),
      session({ id: 'other', workspaceId: 'ws-2', name: 'Other', lastMessageAt: 30 }),
      session({ id: 'hidden', workspaceId: 'ws-1', hidden: true, lastMessageAt: 40 }),
      session({ id: 'new', workspaceId: 'ws-1', name: 'New', lastMessageAt: 20 }),
    ], 'ws-1', '')

    expect(result.map(item => item.id)).toEqual(['new', 'old'])
  })

  it('searches title and preview without leaking another workspace', () => {
    const result = filterWorkspaceSessionHistory([
      session({ id: 'match', workspaceId: 'ws-1', name: '半导体跟踪' }),
      session({ id: 'preview', workspaceId: 'ws-1', preview: '新能源周报' }),
      session({ id: 'other', workspaceId: 'ws-2', name: '半导体海外' }),
    ], 'ws-1', '半导体')

    expect(result.map(item => item.id)).toEqual(['match'])
  })
})
