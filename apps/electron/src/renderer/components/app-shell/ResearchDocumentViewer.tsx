import * as React from 'react'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Markdown } from '@rocket/ui'
import type { WorkspaceResearchPreview } from '../../../shared/types'
import type { ResearchTab } from '@/atoms/workspace-tabs'
import type { WorkspaceResearchController } from '@/hooks/useWorkspaceResearchState'
import { useAppShellContext } from '@/context/AppShellContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PDF_ZOOM_STEP,
  buildSafeHtmlPreview,
  clampPdfPage,
  clampPdfZoom,
} from './research-document-preview'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface ResearchDocumentViewerProps {
  tab: ResearchTab
  research: WorkspaceResearchController
}

interface PdfDocumentLike {
  numPages: number
  getPage: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{ items: unknown[] }>
  }>
}

const PREVIEW_META = {
  pdf: { label: 'PDF', icon: FileText },
  html: { label: 'HTML', icon: FileCode2 },
  docx: { label: 'Word', icon: FileText },
  xlsx: { label: 'Excel', icon: FileSpreadsheet },
} as const

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ResearchDocumentViewer({ tab, research }: ResearchDocumentViewerProps) {
  const { activeWorkspaceId } = useAppShellContext()
  const relativePath = tab.resource?.path
  const restoredState = research.state.readingStateByTabId[tab.id]
  const [preview, setPreview] = React.useState<WorkspaceResearchPreview | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [pdfPage, setPdfPage] = React.useState(() => clampPdfPage(restoredState?.pdfPage, Number.MAX_SAFE_INTEGER))
  const [pdfZoom, setPdfZoom] = React.useState(() => clampPdfZoom(restoredState?.pdfZoom))
  const [pdfPageCount, setPdfPageCount] = React.useState(0)
  const [pdfHasNoText, setPdfHasNoText] = React.useState(false)
  const [viewportWidth, setViewportWidth] = React.useState(720)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const iframeRef = React.useRef<HTMLIFrameElement>(null)
  const scrollTimerRef = React.useRef<number | null>(null)
  const restorePendingRef = React.useRef(true)
  const pdfPageRef = React.useRef(pdfPage)
  const pdfZoomRef = React.useRef(pdfZoom)
  const updateReadingStateRef = React.useRef(research.updateReadingState)
  pdfPageRef.current = pdfPage
  pdfZoomRef.current = pdfZoom
  updateReadingStateRef.current = research.updateReadingState

  const load = React.useCallback(async () => {
    if (!activeWorkspaceId || !relativePath) return
    setLoading(true)
    setError(null)
    setPreview(null)
    setPdfPageCount(0)
    setPdfHasNoText(false)
    restorePendingRef.current = true
    try {
      const result = await window.electronAPI.readWorkspacePreview(activeWorkspaceId, relativePath)
      setPreview(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId, relativePath])

  React.useEffect(() => {
    void load()
  }, [load])

  const restoreScroll = React.useCallback(() => {
    if (!restorePendingRef.current) return
    restorePendingRef.current = false
    window.requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = restoredState?.scrollTop ?? 0
    })
  }, [restoredState?.scrollTop])

  const persistReadingState = React.useCallback(() => {
    const scrollTop = scrollRef.current?.scrollTop ?? 0
    updateReadingStateRef.current(tab.id, preview?.kind === 'pdf'
      ? { scrollTop, pdfPage: pdfPageRef.current, pdfZoom: pdfZoomRef.current }
      : { scrollTop })
  }, [preview?.kind, tab.id])

  const handleScroll = React.useCallback(() => {
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = window.setTimeout(() => {
      persistReadingState()
      scrollTimerRef.current = null
    }, 150)
  }, [persistReadingState])

  React.useEffect(() => () => {
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current)
    const scrollTop = scrollRef.current?.scrollTop ?? 0
    updateReadingStateRef.current(tab.id, preview?.kind === 'pdf'
      ? { scrollTop, pdfPage: pdfPageRef.current, pdfZoom: pdfZoomRef.current }
      : { scrollTop })
  }, [preview?.kind, tab.id])

  React.useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width) setViewportWidth(width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [preview?.kind])

  const fileObject = React.useMemo(() => preview?.kind === 'pdf' ? { data: preview.data } : null, [preview])
  const safeHtml = React.useMemo(() => preview?.kind === 'html' ? buildSafeHtmlPreview(preview.content) : '', [preview])

  React.useEffect(() => {
    if (preview?.kind === 'docx' || preview?.kind === 'xlsx') restoreScroll()
  }, [preview?.kind, restoreScroll])

  const inspectPdfText = React.useCallback(async (document: PdfDocumentLike) => {
    const sampleSize = Math.min(document.numPages, 10)
    try {
      const samples = await Promise.all(Array.from({ length: sampleSize }, async (_, index) => {
        const page = await document.getPage(index + 1)
        return (await page.getTextContent()).items.length
      }))
      setPdfHasNoText(samples.every(length => length === 0))
    } catch {
      setPdfHasNoText(false)
    }
  }, [])

  const handlePdfLoad = React.useCallback((document: PdfDocumentLike) => {
    setPdfPageCount(document.numPages)
    setPdfPage(current => clampPdfPage(current, document.numPages))
    void inspectPdfText(document)
  }, [inspectPdfText])

  const changePdfPage = React.useCallback((nextPage: number) => {
    setPdfPage(clampPdfPage(nextPage, pdfPageCount))
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    window.setTimeout(persistReadingState, 0)
  }, [pdfPageCount, persistReadingState])

  const changePdfZoom = React.useCallback((nextZoom: number) => {
    setPdfZoom(clampPdfZoom(nextZoom))
    window.setTimeout(persistReadingState, 0)
  }, [persistReadingState])

  const handleIframeLoad = React.useCallback(() => {
    const iframe = iframeRef.current
    try {
      const height = iframe?.contentDocument?.documentElement.scrollHeight
      if (iframe && height) iframe.style.height = `${Math.max(height, 480)}px`
    } catch {
      // The HTML remains readable at the fixed fallback height if Chromium
      // denies same-origin measurement for a sandboxed srcDoc.
    }
    restoreScroll()
  }, [restoreScroll])

  if (!relativePath) return null
  const meta = preview ? PREVIEW_META[preview.kind] : null
  const Icon = meta?.icon ?? FileText
  const pdfWidth = Math.max(320, Math.min(1100, viewportWidth - 64)) * pdfZoom

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex h-[42px] shrink-0 items-center gap-2 border-b border-border/50 px-3">
        <Icon className="h-3.5 w-3.5 text-foreground/55" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{tab.title}</h1>
          <p className="truncate text-[9px] text-muted-foreground">{relativePath}</p>
        </div>
        {preview && (
          <span className="rounded-[5px] bg-foreground/[0.055] px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
            {meta?.label} · {formatFileSize(preview.size)} · 只读
          </span>
        )}
        {preview?.kind === 'pdf' && (
          <div className="flex items-center gap-1 border-l border-border/60 pl-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="上一页" disabled={pdfPage <= 1} onClick={() => changePdfPage(pdfPage - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[58px] text-center text-[10px] tabular-nums text-muted-foreground">{pdfPage} / {pdfPageCount || '—'}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="下一页" disabled={!pdfPageCount || pdfPage >= pdfPageCount} onClick={() => changePdfPage(pdfPage + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="缩小" disabled={pdfZoom <= 0.5} onClick={() => changePdfZoom(pdfZoom - PDF_ZOOM_STEP)}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[38px] text-center text-[10px] tabular-nums text-muted-foreground">{Math.round(pdfZoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="放大" disabled={pdfZoom >= 2.5} onClick={() => changePdfZoom(pdfZoom + PDF_ZOOM_STEP)}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {pdfHasNoText && (
        <div role="status" aria-live="polite" className="flex shrink-0 items-center gap-2 border-b border-amber-500/20 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          该 PDF 的抽样页面未检测到可检索文字，可能是扫描件。P1 支持阅读，但暂不执行 OCR。
        </div>
      )}

      {loading ? (
        <div role="status" aria-live="polite" className="flex min-h-0 flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 正在准备只读预览
        </div>
      ) : error ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div role="alert" className="w-full max-w-sm rounded-[10px] border border-destructive/20 bg-destructive/5 p-4 text-center">
            <AlertTriangle className="mx-auto h-5 w-5 text-destructive" />
            <p className="mt-2 text-xs text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-4 h-7 gap-1.5 text-xs" onClick={() => { void load() }}>
              <RotateCcw className="h-3.5 w-3.5" /> 重试
            </Button>
          </div>
        </div>
      ) : preview ? (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            'min-h-0 flex-1 overflow-auto',
            preview.kind === 'pdf' ? 'bg-foreground/[0.035] p-8' : 'bg-foreground/[0.018]',
          )}
        >
          {preview.kind === 'pdf' && fileObject && (
            <Document
              file={fileObject}
              onLoadSuccess={handlePdfLoad}
              onLoadError={loadError => setError(`PDF 渲染失败：${loadError.message}`)}
              loading={<div role="status" aria-live="polite" className="flex justify-center py-16 text-xs text-muted-foreground">正在解析 PDF</div>}
              className="flex justify-center"
            >
              <Page
                pageNumber={pdfPage}
                width={pdfWidth}
                renderTextLayer
                renderAnnotationLayer
                onRenderSuccess={restoreScroll}
                className="overflow-hidden rounded-[3px] bg-white shadow-strong"
              />
            </Document>
          )}
          {preview.kind === 'html' && (
            <iframe
              ref={iframeRef}
              title={`${tab.title} HTML 预览`}
              srcDoc={safeHtml}
              sandbox="allow-same-origin"
              onLoad={handleIframeLoad}
              className="block min-h-[480px] w-full border-0 bg-background"
            />
          )}
          {(preview.kind === 'docx' || preview.kind === 'xlsx') && (
            <article className="mx-auto min-h-full w-full max-w-4xl bg-background px-10 py-9 shadow-minimal">
              <Markdown mode="full" className="overflow-x-auto">{preview.content}</Markdown>
            </article>
          )}
        </div>
      ) : null}
    </div>
  )
}
