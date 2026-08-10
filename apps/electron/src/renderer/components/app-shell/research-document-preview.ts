export const MIN_PDF_ZOOM = 0.5
export const MAX_PDF_ZOOM = 2.5
export const PDF_ZOOM_STEP = 0.1

export function clampPdfZoom(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_PDF_ZOOM, Math.max(MIN_PDF_ZOOM, Math.round(value! * 10) / 10))
}

export function clampPdfPage(value: number | undefined, pageCount: number): number {
  const safePageCount = Math.max(1, Math.floor(pageCount))
  if (!Number.isFinite(value)) return 1
  return Math.min(safePageCount, Math.max(1, Math.floor(value!)))
}

/**
 * HTML research files are displayed as inert documents. The iframe itself is
 * sandboxed without script permission; this CSP additionally blocks network,
 * navigation helpers, plugins, and forms embedded in the source document.
 */
export function buildSafeHtmlPreview(source: string): string {
  const guard = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; img-src data: blob:; font-src data:; style-src 'unsafe-inline'">
<style>
  :root { color-scheme: light dark; }
  html { background: transparent; }
  body { box-sizing: border-box; margin: 0 auto; max-width: 980px; padding: 32px 40px 64px; color: CanvasText; background: Canvas; font: 14px/1.65 system-ui, sans-serif; overflow-wrap: anywhere; }
  img, video, svg, canvas { max-width: 100%; height: auto; }
  table { max-width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); padding: 6px 8px; }
  pre { overflow: auto; padding: 12px; background: color-mix(in srgb, CanvasText 6%, Canvas); }
  a { color: inherit; text-decoration: underline; pointer-events: none; }
</style>`

  if (/<head(?:\s[^>]*)?>/i.test(source)) {
    return source.replace(/<head(?:\s[^>]*)?>/i, match => `${match}${guard}`)
  }
  if (/<html(?:\s[^>]*)?>/i.test(source)) {
    return source.replace(/<html(?:\s[^>]*)?>/i, match => `${match}<head>${guard}</head>`)
  }
  return `<!doctype html><html><head>${guard}</head><body>${source}</body></html>`
}
