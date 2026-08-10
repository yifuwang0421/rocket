import { describe, expect, it } from 'bun:test'
import { shouldUseResearchLayout } from './research-layout-mode'

describe('shouldUseResearchLayout', () => {
  it('uses the research workbench by default', () => {
    expect(shouldUseResearchLayout(undefined)).toBe(true)
    expect(shouldUseResearchLayout('')).toBe(true)
    expect(shouldUseResearchLayout('1')).toBe(true)
  })

  it('keeps an explicit classic-layout rollback path', () => {
    expect(shouldUseResearchLayout('0')).toBe(false)
    expect(shouldUseResearchLayout(' false ')).toBe(false)
    expect(shouldUseResearchLayout('CLASSIC')).toBe(false)
  })
})
