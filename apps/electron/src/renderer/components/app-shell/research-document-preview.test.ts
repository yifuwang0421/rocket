import { describe, expect, it } from 'bun:test'
import { buildSafeHtmlPreview, clampPdfPage, clampPdfZoom } from './research-document-preview'

describe('research document preview helpers', () => {
  it('clamps restored PDF page and zoom values', () => {
    expect(clampPdfPage(0, 12)).toBe(1)
    expect(clampPdfPage(99, 12)).toBe(12)
    expect(clampPdfZoom(0.1)).toBe(0.5)
    expect(clampPdfZoom(4)).toBe(2.5)
    expect(clampPdfZoom(1.26)).toBe(1.3)
  })

  it('injects an inert CSP and navigation guard into HTML documents', () => {
    const result = buildSafeHtmlPreview('<html><head><title>Report</title></head><body><a href="https://example.com">link</a></body></html>')

    expect(result).toContain("default-src 'none'")
    expect(result).toContain("base-uri 'none'")
    expect(result).toContain('pointer-events: none')
    expect(result.indexOf('Content-Security-Policy')).toBeLessThan(result.indexOf('<title>'))
  })

  it('wraps HTML fragments in a complete inert document', () => {
    const result = buildSafeHtmlPreview('<h1>Research</h1>')
    expect(result).toStartWith('<!doctype html>')
    expect(result).toContain('<body><h1>Research</h1></body>')
  })
})
