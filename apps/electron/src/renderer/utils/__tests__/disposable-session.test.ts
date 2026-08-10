import { describe, expect, it } from 'bun:test'
import type { SessionMeta } from '@/atoms/sessions'
import { isDisposableEmptySession } from '../session'

const empty: SessionMeta = { id: 'empty', workspaceId: 'workspace', messageCount: 0 }

describe('disposable empty sessions', () => {
  it('deletes only a never-used session without a draft', () => {
    expect(isDisposableEmptySession(empty, '')).toBe(true)
    expect(isDisposableEmptySession({ ...empty, isProcessing: true }, '')).toBe(false)
    expect(isDisposableEmptySession(empty, 'draft')).toBe(false)
  })

  it('keeps user-visible session content even without an assistant response', () => {
    expect(isDisposableEmptySession({ ...empty, preview: 'user message', messageCount: 1 })).toBe(false)
    expect(isDisposableEmptySession({ ...empty, name: 'Named session' })).toBe(false)
  })
})
