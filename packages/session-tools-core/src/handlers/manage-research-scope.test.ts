import { describe, expect, it } from 'bun:test'
import type { SessionToolContext } from '../context.ts'
import { handleManageResearchScope } from './manage-research-scope.ts'

function context(manageResearchScope?: SessionToolContext['manageResearchScope']): SessionToolContext {
  return { manageResearchScope } as SessionToolContext
}

describe('manage_research_scope', () => {
  it('returns the Workspace scope through the injected boundary', async () => {
    const result = await handleManageResearchScope(context(async input => ({ action: input.action, watchlist: [] })), { action: 'list' })
    expect(result.isError).not.toBe(true)
    expect(result.content[0]?.text).toContain('watchlist')
  })

  it('requires explicit confirmation before removal', async () => {
    let called = false
    const result = await handleManageResearchScope(context(async () => { called = true }), {
      action: 'remove', kind: 'watchlist', id: 'company-1',
    })
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('confirm=true')
    expect(called).toBe(false)
  })

  it('passes confirmed mutations to the host service', async () => {
    let received: unknown
    const result = await handleManageResearchScope(context(async input => { received = input; return { removed: true } }), {
      action: 'remove', kind: 'sector', id: 'sector-1', confirm: true,
    })
    expect(result.isError).not.toBe(true)
    expect(received).toEqual({ action: 'remove', kind: 'sector', id: 'sector-1', confirm: true })
  })
})
