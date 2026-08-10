import * as React from 'react'
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Tags,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  ResearchAttentionLevel,
  ResearchProgressStatus,
  ResearchScopeKind,
  SectorItem,
  StockSearchSuggestion,
  WatchlistItem,
  WorkspaceResearchFolderEntry,
  WorkspaceResearchFolderList,
  WorkspaceResearchScope,
} from '@rocket/shared/protocol'
import type { ResearchTab } from '@/atoms/workspace-tabs'
import type { WorkspaceResearchController } from '@/hooks/useWorkspaceResearchState'
import { useAppShellContext } from '@/context/AppShellContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type ScopeKind = 'watchlist' | 'sectors'
type ScopeItem = WatchlistItem | SectorItem

const STATUS_OPTIONS: Array<{ value: ResearchProgressStatus; label: string }> = [
  { value: 'not-started', label: '未开始' },
  { value: 'tracking', label: '持续跟踪' },
  { value: 'in-progress', label: '研究中' },
  { value: 'review', label: '待复核' },
  { value: 'complete', label: '已完成' },
  { value: 'paused', label: '已暂停' },
]

const ATTENTION_OPTIONS: Array<{ value: ResearchAttentionLevel; label: string }> = [
  { value: 'core', label: '核心' },
  { value: 'high', label: '高' },
  { value: 'normal', label: '常规' },
  { value: 'low', label: '低' },
]

const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map(option => [option.value, option.label])) as Record<ResearchProgressStatus, string>
const ATTENTION_LABEL = Object.fromEntries(ATTENTION_OPTIONS.map(option => [option.value, option.label])) as Record<ResearchAttentionLevel, string>
const DEFAULT_FOLDER_ORDER = new Map(['公告', '模型', '研报', '纪要', '其他'].map((name, index) => [name, index]))

const STATUS_STYLE: Record<ResearchProgressStatus, string> = {
  'not-started': 'bg-foreground/[0.05] text-foreground/55',
  tracking: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'in-progress': 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  review: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  complete: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  paused: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
}

interface ScopeDraft {
  id?: string
  name: string
  code: string
  market: string
  group: string
  status: ResearchProgressStatus
  attention: ResearchAttentionLevel
  tags: string
  thesis: string
  companyIds: string[]
  relatedResources: string
  lastResearchedAt?: number
}

function emptyDraft(kind: ScopeKind): ScopeDraft {
  return {
    name: '', code: '', market: '', group: '', status: 'not-started', attention: 'normal',
    tags: '', thesis: '', companyIds: [], relatedResources: '',
  }
}

function draftFromItem(item: ScopeItem): ScopeDraft {
  if ('code' in item) {
    return {
      id: item.id,
      name: item.name,
      code: item.code,
      market: item.market,
      group: item.group,
      status: item.status,
      attention: 'normal',
      tags: item.tags.join(', '),
      thesis: item.thesis,
      companyIds: [],
      relatedResources: item.relatedResources.join('\n'),
      lastResearchedAt: item.lastResearchedAt,
    }
  }
  return {
    id: item.id,
    name: item.name,
    code: '',
    market: '',
    group: '',
    status: item.status,
    attention: item.attention,
    tags: '',
    thesis: item.thesis,
    companyIds: item.companyIds,
    relatedResources: item.relatedResources.join('\n'),
    lastResearchedAt: item.lastResearchedAt,
  }
}

function splitList(value: string): string[] {
  return [...new Set(value.split(/[\n,，]/).map(entry => entry.trim()).filter(Boolean))]
}

function formatTime(value?: number): string {
  if (!value) return '尚无研究记录'
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(value)
}

function formatModifiedTime(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function formatDateInput(value?: number): string {
  if (!value) return ''
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateInput(value: string): number | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year!, month! - 1, day!).getTime()
}

function StatusPill({ status }: { status: ResearchProgressStatus }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>
}

function useWorkspaceResearchScope() {
  const { activeWorkspaceId } = useAppShellContext()
  const [scope, setScope] = React.useState<WorkspaceResearchScope | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!activeWorkspaceId) {
      setScope(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setScope(await window.electronAPI.getWorkspaceResearchScope(activeWorkspaceId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId])

  React.useEffect(() => { void load() }, [load])
  React.useEffect(() => {
    const refresh = () => { void load() }
    window.addEventListener('rocket:research-scope-changed', refresh)
    return () => window.removeEventListener('rocket:research-scope-changed', refresh)
  }, [load])

  const commit = React.useCallback((next: WorkspaceResearchScope) => {
    setScope(next)
    window.dispatchEvent(new CustomEvent('rocket:research-scope-changed'))
  }, [])

  return { activeWorkspaceId, scope, loading, error, load, commit }
}

function ScopeEditorDialog({
  open,
  kind,
  initialItem,
  scope,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  kind: ScopeKind
  initialItem?: ScopeItem
  scope: WorkspaceResearchScope
  onOpenChange: (open: boolean) => void
  onSaved: (scope: WorkspaceResearchScope) => void
}) {
  const { activeWorkspaceId } = useAppShellContext()
  const [draft, setDraft] = React.useState<ScopeDraft>(() => initialItem ? draftFromItem(initialItem) : emptyDraft(kind))
  const [saving, setSaving] = React.useState(false)
  const [stockSuggestions, setStockSuggestions] = React.useState<StockSearchSuggestion[]>([])
  const [searchingStocks, setSearchingStocks] = React.useState(false)
  const [stockSearchError, setStockSearchError] = React.useState<string | null>(null)
  const [searchedStockQuery, setSearchedStockQuery] = React.useState('')
  const [activeSuggestionIndex, setActiveSuggestionIndex] = React.useState(0)
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const stockInputRef = React.useRef<HTMLInputElement>(null)
  const sectorNameInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setDraft(initialItem ? draftFromItem(initialItem) : emptyDraft(kind))
      setStockSuggestions([])
      setStockSearchError(null)
      setSearchedStockQuery('')
      setActiveSuggestionIndex(0)
      setValidationError(null)
    }
  }, [initialItem, kind, open])

  React.useEffect(() => {
    if (!open || kind !== 'watchlist' || initialItem || !activeWorkspaceId || draft.code || !draft.name.trim()) {
      setSearchingStocks(false)
      setStockSuggestions([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearchingStocks(true)
      setStockSearchError(null)
      try {
        const suggestions = await window.electronAPI.searchStockSuggestions({
          workspaceId: activeWorkspaceId,
          query: draft.name,
          limit: 8,
        })
        if (!cancelled) {
          setStockSuggestions(suggestions)
          setSearchedStockQuery(draft.name.trim())
          setActiveSuggestionIndex(0)
        }
      } catch (error) {
        if (!cancelled) {
          setStockSuggestions([])
          setStockSearchError(error instanceof Error ? error.message : String(error))
        }
      } finally {
        if (!cancelled) setSearchingStocks(false)
      }
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeWorkspaceId, draft.code, draft.name, initialItem, kind, open])

  const selectStock = (suggestion: StockSearchSuggestion) => {
    setDraft(value => ({ ...value, name: suggestion.name, code: suggestion.code, market: suggestion.market }))
    setStockSuggestions([])
    setStockSearchError(null)
    setSearchedStockQuery('')
    setValidationError(null)
  }

  const save = async () => {
    if (!activeWorkspaceId) return
    if (!draft.name.trim()) {
      setValidationError(kind === 'watchlist' ? '请输入股票名称或代码并选择一个结果。' : '请输入行业名称。')
      const targetRef = kind === 'watchlist' ? stockInputRef : sectorNameInputRef
      targetRef.current?.focus()
      return
    }
    if (kind === 'watchlist' && (!draft.code.trim() || !draft.market.trim())) {
      setValidationError('请从搜索建议中选择股票，代码和市场不能手动填写。')
      stockInputRef.current?.focus()
      return
    }
    setValidationError(null)
    setSaving(true)
    try {
      const next = kind === 'watchlist'
        ? await window.electronAPI.upsertWorkspaceWatchlistItem({
          workspaceId: activeWorkspaceId,
          expectedRevision: scope.revision,
          item: {
            ...(draft.id ? { id: draft.id } : {}),
            name: draft.name,
            code: draft.code,
            market: draft.market,
            group: draft.group,
            status: draft.status,
            tags: splitList(draft.tags),
            thesis: draft.thesis,
            relatedResources: splitList(draft.relatedResources),
            ...(draft.lastResearchedAt ? { lastResearchedAt: draft.lastResearchedAt } : {}),
          },
        })
        : await window.electronAPI.upsertWorkspaceSectorItem({
          workspaceId: activeWorkspaceId,
          expectedRevision: scope.revision,
          item: {
            ...(draft.id ? { id: draft.id } : {}),
            name: draft.name,
            attention: draft.attention,
            status: draft.status,
            thesis: draft.thesis,
            companyIds: draft.companyIds,
            relatedResources: splitList(draft.relatedResources),
            ...(draft.lastResearchedAt ? { lastResearchedAt: draft.lastResearchedAt } : {}),
          },
        })
      onSaved(next)
      onOpenChange(false)
      toast.success(initialItem ? '研究范围已更新' : '已加入研究范围')
    } catch (saveError) {
      toast.error('保存失败', { description: saveError instanceof Error ? saveError.message : String(saveError) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{initialItem ? '编辑' : '新增'}{kind === 'watchlist' ? '公司' : '行业'}</DialogTitle>
          <DialogDescription>这里只记录研究范围和进度，不包含模拟行情或价格数据。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          {kind === 'watchlist' ? (
            initialItem ? (
              <div className="rounded-[9px] border border-border/50 bg-foreground/[0.025] px-3 py-2.5">
                <p className="text-xs font-medium">{draft.name}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{draft.code} · {draft.market}</p>
                <p className="mt-1.5 text-[10px] text-muted-foreground">证券身份在创建时确定；如选错，请移除后重新添加。</p>
              </div>
            ) : (
              <label className="relative grid gap-1.5 text-xs">
                <span>搜索并选择股票 *</span>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={stockInputRef}
                    id="watchlist-stock-search"
                    name="watchlistStockSearch"
                    value={draft.name}
                    onChange={event => {
                      setDraft(value => ({ ...value, name: event.target.value, code: '', market: '' }))
                      setStockSearchError(null)
                      setSearchedStockQuery('')
                      setValidationError(null)
                    }}
                    className="pl-8 pr-8"
                    placeholder="输入股票名称或代码"
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={stockSuggestions.length > 0}
                    aria-controls="stock-search-suggestions"
                    aria-activedescendant={stockSuggestions.length > 0 ? `stock-suggestion-${activeSuggestionIndex}` : undefined}
                    aria-invalid={Boolean(validationError)}
                    aria-describedby={validationError ? 'stock-selection-error' : undefined}
                    onKeyDown={event => {
                      if (event.key === 'ArrowDown' && stockSuggestions.length > 0) {
                        event.preventDefault()
                        setActiveSuggestionIndex(index => Math.min(index + 1, stockSuggestions.length - 1))
                      } else if (event.key === 'ArrowUp' && stockSuggestions.length > 0) {
                        event.preventDefault()
                        setActiveSuggestionIndex(index => Math.max(index - 1, 0))
                      } else if (event.key === 'Enter' && stockSuggestions[activeSuggestionIndex]) {
                        event.preventDefault()
                        selectStock(stockSuggestions[activeSuggestionIndex])
                      } else if (event.key === 'Escape') {
                        setStockSuggestions([])
                      }
                    }}
                  />
                  {searchingStocks && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
                {draft.code && <div className="flex items-center gap-2 rounded-md bg-emerald-500/8 px-2.5 py-2 text-[11px] text-emerald-700 dark:text-emerald-300"><span className="font-medium">已选择 {draft.name}</span><span className="font-mono opacity-75">{draft.code} · {draft.market}</span></div>}
                {!draft.code && stockSuggestions.length > 0 && (
                  <div id="stock-search-suggestions" role="listbox" className="absolute left-0 right-0 top-[62px] z-50 max-h-56 overflow-y-auto rounded-[9px] border border-border bg-popover p-1 shadow-modal-small">
                    {stockSuggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.market}:${suggestion.code}`}
                        id={`stock-suggestion-${index}`}
                        type="button"
                        role="option"
                        aria-selected={activeSuggestionIndex === index}
                        className={cn('flex w-full items-center gap-3 rounded-[7px] px-2.5 py-2 text-left hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-ring', activeSuggestionIndex === index && 'bg-foreground/[0.05]')}
                        onClick={() => selectStock(suggestion)}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                      >
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">{suggestion.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{suggestion.code}</span>
                        <span className="min-w-10 text-right text-[10px] text-muted-foreground">{suggestion.market}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!draft.code && searchedStockQuery === draft.name.trim() && !searchingStocks && stockSuggestions.length === 0 && !stockSearchError && <span className="text-[10px] text-muted-foreground">没有匹配结果，请尝试证券代码或更完整的名称。</span>}
                {stockSearchError && <span className="text-[10px] text-destructive">证券搜索暂时不可用：{stockSearchError}</span>}
                {validationError && <span id="stock-selection-error" role="alert" className="text-[10px] text-destructive">{validationError}</span>}
              </label>
            )
          ) : (
            <label className="grid gap-1.5 text-xs"><span>名称 *</span><Input ref={sectorNameInputRef} name="sectorName" autoComplete="off" value={draft.name} aria-invalid={Boolean(validationError)} onChange={event => { setDraft(value => ({ ...value, name: event.target.value })); setValidationError(null) }} />{validationError && <span role="alert" className="text-[10px] text-destructive">{validationError}</span>}</label>
          )}
          <div className="grid grid-cols-2 gap-3">
            {kind === 'watchlist' ? (
              <label className="grid gap-1.5 text-xs"><span>分组</span><Input value={draft.group} onChange={event => setDraft(value => ({ ...value, group: event.target.value }))} placeholder="核心持仓、观察池…" /></label>
            ) : (
              <label className="grid gap-1.5 text-xs"><span>关注等级</span><select className="h-9 rounded-md border border-foreground/15 bg-background px-3 text-xs" value={draft.attention} onChange={event => setDraft(value => ({ ...value, attention: event.target.value as ResearchAttentionLevel }))}>{ATTENTION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            )}
            <label className="grid gap-1.5 text-xs"><span>研究状态</span><select className="h-9 rounded-md border border-foreground/15 bg-background px-3 text-xs" value={draft.status} onChange={event => setDraft(value => ({ ...value, status: event.target.value as ResearchProgressStatus }))}>{STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>
          {kind === 'watchlist' && <label className="grid gap-1.5 text-xs"><span>标签</span><Input value={draft.tags} onChange={event => setDraft(value => ({ ...value, tags: event.target.value }))} placeholder="以逗号分隔" /></label>}
          <label className="grid gap-1.5 text-xs"><span>最近研究日期</span><Input type="date" value={formatDateInput(draft.lastResearchedAt)} onChange={event => setDraft(value => ({ ...value, lastResearchedAt: parseDateInput(event.target.value) }))} /></label>
          {kind === 'sectors' && (
            <fieldset className="grid gap-1.5 text-xs">
              <legend className="mb-1">关联公司</legend>
              <div className="max-h-28 overflow-y-auto rounded-md border border-foreground/10 p-2">
                {scope.watchlist.length === 0 ? <p className="text-muted-foreground">请先添加公司。</p> : scope.watchlist.map(company => (
                  <label key={company.id} className="flex items-center gap-2 py-1">
                    <input type="checkbox" checked={draft.companyIds.includes(company.id)} onChange={event => setDraft(value => ({ ...value, companyIds: event.target.checked ? [...value.companyIds, company.id] : value.companyIds.filter(id => id !== company.id) }))} />
                    <span>{company.name}</span><span className="text-muted-foreground">{company.code}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label className="grid gap-1.5 text-xs"><span>{kind === 'watchlist' ? '关注逻辑' : '行业逻辑'}</span><Textarea rows={4} value={draft.thesis} onChange={event => setDraft(value => ({ ...value, thesis: event.target.value }))} placeholder="记录纳入研究范围的原因、关键变量和待验证问题。" /></label>
          <label className="grid gap-1.5 text-xs"><span>关联资料</span><Textarea rows={3} value={draft.relatedResources} onChange={event => setDraft(value => ({ ...value, relatedResources: event.target.value }))} placeholder={'每行一个 Workspace 相对路径\nnotes/example.md'} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => { void save() }} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmRemoveDialog({ item, kind, scope, onOpenChange, onRemoved }: { item: ScopeItem | null; kind: ScopeKind; scope: WorkspaceResearchScope; onOpenChange: (open: boolean) => void; onRemoved: (scope: WorkspaceResearchScope) => void }) {
  const { activeWorkspaceId } = useAppShellContext()
  const [removing, setRemoving] = React.useState(false)
  const remove = async () => {
    if (!item || !activeWorkspaceId) return
    setRemoving(true)
    try {
      const next = kind === 'watchlist'
        ? await window.electronAPI.removeWorkspaceWatchlistItem({ workspaceId: activeWorkspaceId, expectedRevision: scope.revision, id: item.id })
        : await window.electronAPI.removeWorkspaceSectorItem({ workspaceId: activeWorkspaceId, expectedRevision: scope.revision, id: item.id })
      onRemoved(next)
      onOpenChange(false)
      toast.success('已从研究范围移除')
    } catch (error) {
      toast.error('移除失败', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setRemoving(false)
    }
  }
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader><DialogTitle>移除“{item?.name}”？</DialogTitle><DialogDescription>这只会移除研究标签；对应文件夹及其中全部文件都会保留在 Workspace。</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button variant="destructive" onClick={() => { void remove() }} disabled={removing}>{removing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}确认移除</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function openItemTab(item: ScopeItem, research: WorkspaceResearchController) {
  const company = 'code' in item
  research.openTab({
    id: `research:${company ? 'company' : 'industry'}:${item.id}`,
    title: item.name,
    type: company ? 'company' : 'industry',
    resource: { kind: company ? 'company' : 'industry', resourceId: item.id },
  })
}

function formatFileSize(value?: number): string {
  if (value === undefined) return ''
  if (value < 1_024) return `${value} B`
  if (value < 1_024 * 1_024) return `${Math.round(value / 1_024)} KB`
  return `${(value / (1_024 * 1_024)).toFixed(1)} MB`
}

function ResearchFolderBrowser({
  kind,
  itemId,
  folderPath,
  onOpenFile,
}: {
  kind: ResearchScopeKind
  itemId: string
  folderPath: string
  onOpenFile: (relativePath: string) => void
}) {
  const { activeWorkspaceId } = useAppShellContext()
  const [folder, setFolder] = React.useState<WorkspaceResearchFolderList | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [currentPath, setCurrentPath] = React.useState(folderPath)
  const [importing, setImporting] = React.useState(false)
  const [dragActive, setDragActive] = React.useState(false)
  const [createType, setCreateType] = React.useState<'directory' | 'markdown' | null>(null)
  const [createName, setCreateName] = React.useState('')
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const createNameId = React.useId()
  const createNameRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(async () => {
    if (!activeWorkspaceId) return
    setLoading(true)
    setError(null)
    try {
      const next = await window.electronAPI.listWorkspaceResearchScopeFolder({ workspaceId: activeWorkspaceId, kind, id: itemId })
      setFolder(next)
      setCurrentPath(current => current === next.folderPath || next.entries.some(entry => entry.type === 'directory' && entry.relativePath === current) ? current : next.folderPath)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId, itemId, kind])

  React.useEffect(() => { setCurrentPath(folderPath) }, [folderPath, itemId])
  React.useEffect(() => { void load() }, [load])
  React.useEffect(() => {
    const refresh = () => { void load() }
    window.addEventListener('rocket:workspace-research-changed', refresh)
    return () => window.removeEventListener('rocket:workspace-research-changed', refresh)
  }, [load])

  const importPaths = async (sourcePaths: string[]) => {
    if (!activeWorkspaceId || sourcePaths.length === 0) return
    setImporting(true)
    try {
      const result = await window.electronAPI.importToWorkspaceResearchScopeFolder({
        workspaceId: activeWorkspaceId,
        kind,
        id: itemId,
        targetRelativePath: currentPath,
        sourcePaths,
      })
      await load()
      toast.success(`已导入 ${result.imported.length} 个文件`, { description: currentPath })
    } catch (importError) {
      toast.error('导入失败', { description: importError instanceof Error ? importError.message : String(importError) })
    } finally {
      setImporting(false)
    }
  }

  const openImportDialog = async () => {
    const paths = await window.electronAPI.openFileDialog()
    await importPaths(paths)
  }

  const openCreateDialog = (type: 'directory' | 'markdown') => {
    setCreateType(type)
    setCreateName('')
    setCreateError(null)
  }

  const createEntry = async () => {
    if (!activeWorkspaceId || !createType) return
    if (!createName.trim()) {
      setCreateError('请输入名称。')
      createNameRef.current?.focus()
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const entry = await window.electronAPI.createWorkspaceResearchScopeFolderEntry({
        workspaceId: activeWorkspaceId,
        kind,
        id: itemId,
        parentRelativePath: currentPath,
        name: createName,
        type: createType,
      })
      await load()
      setCreateType(null)
      toast.success(createType === 'directory' ? '文件夹已创建' : 'Markdown 已创建', { description: entry.name })
      if (entry.type === 'file') onOpenFile(entry.relativePath)
    } catch (createEntryError) {
      setCreateError(createEntryError instanceof Error ? createEntryError.message : String(createEntryError))
    } finally {
      setCreating(false)
    }
  }

  const currentEntries = React.useMemo(() => (folder?.entries ?? [])
    .filter(entry => entry.parentRelativePath === currentPath)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      const aOrder = DEFAULT_FOLDER_ORDER.get(a.name)
      const bOrder = DEFAULT_FOLDER_ORDER.get(b.name)
      if (aOrder !== undefined || bOrder !== undefined) return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER)
      return a.name.localeCompare(b.name, 'zh-CN')
    }), [currentPath, folder])

  const breadcrumbs = React.useMemo(() => {
    const suffix = currentPath === folderPath ? [] : currentPath.slice(folderPath.length + 1).split('/').filter(Boolean)
    return [
      { label: '全部文件', path: folderPath },
      ...suffix.map((label, index) => ({ label, path: `${folderPath}/${suffix.slice(0, index + 1).join('/')}` })),
    ]
  }, [currentPath, folderPath])

  const parentPath = currentPath === folderPath
    ? null
    : folder?.entries.find(entry => entry.type === 'directory' && entry.relativePath === currentPath)?.parentRelativePath ?? folderPath
  const currentDirectoryName = breadcrumbs.at(-1)?.label ?? '全部文件'

  const openEntry = (entry: WorkspaceResearchFolderEntry) => {
    if (entry.type === 'directory') {
      setCurrentPath(entry.relativePath)
      return
    }
    if (entry.kind === 'other') {
      toast.info('该文件已保存在资料目录中', { description: '当前格式暂不支持应用内预览。' })
      return
    }
    onOpenFile(entry.relativePath)
  }

  return (
    <section
      className={cn('relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-[10px] border border-border/50 bg-foreground/[0.012]', dragActive && 'border-accent/60 bg-accent/[0.045]')}
      onDragOver={event => { event.preventDefault(); setDragActive(true) }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false) }}
      onDrop={event => {
        event.preventDefault()
        setDragActive(false)
        const paths = Array.from(event.dataTransfer.files).map(file => window.electronAPI.getFilePath(file)).filter((path): path is string => Boolean(path))
        void importPaths(paths)
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-2.5">
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={!parentPath} onClick={() => parentPath && setCurrentPath(parentPath)} aria-label="返回上一级文件夹">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" aria-label="文件夹路径">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/55" aria-hidden="true" />}
              {index === breadcrumbs.length - 1 ? (
                <span className="shrink-0 rounded px-1.5 py-1 text-xs font-medium" aria-current="page">{crumb.label}</span>
              ) : (
                <button type="button" className="shrink-0 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setCurrentPath(crumb.path)}>{crumb.label}</button>
              )}
            </React.Fragment>
          ))}
        </nav>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => openCreateDialog('directory')} aria-label="新建文件夹" title="新建文件夹"><FolderPlus className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => openCreateDialog('markdown')} aria-label="新建 Markdown" title="新建 Markdown"><FilePlus2 className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { void openImportDialog() }} disabled={importing}>
          {importing ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Upload className="mr-1.5 h-3 w-3" />}导入
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { void load() }} aria-label="刷新研究文件夹"><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_110px_72px] gap-3 border-b border-border/35 bg-foreground/[0.018] px-4 py-2 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>名称</span><span className="hidden sm:block">修改时间</span><span className="text-right">大小</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading ? <div role="status" aria-live="polite" className="flex h-full min-h-40 items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />正在读取文件夹</div>
          : error ? <div role="alert" className="flex h-full min-h-40 flex-col items-center justify-center gap-2 px-6 text-center text-xs text-destructive"><div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" />{error}</div><Button size="sm" variant="outline" onClick={() => { void load() }}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />重试</Button></div>
            : currentEntries.length > 0 ? currentEntries.map(entry => (
              <button
                key={entry.relativePath}
                type="button"
                onClick={() => openEntry(entry)}
                className="group grid h-11 w-full grid-cols-[minmax(0,1fr)_110px_72px] items-center gap-3 rounded-[7px] px-2.5 text-left hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                title={entry.relativePath}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {entry.type === 'directory' ? <Folder className="h-4 w-4 shrink-0 fill-amber-400/20 text-amber-500/90" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{entry.name}</span>
                  {entry.type === 'directory' && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />}
                </span>
                <span className="hidden truncate text-[10px] text-muted-foreground sm:block">{formatModifiedTime(entry.modifiedAt)}</span>
                <span className="text-right text-[10px] text-muted-foreground">{entry.type === 'file' ? formatFileSize(entry.size) : '—'}</span>
              </button>
            ))
              : <div role="status" className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center text-xs text-muted-foreground"><FolderOpen className="mb-2 h-5 w-5" /><p>“{currentDirectoryName}”中还没有文件</p><p className="mt-1 text-[10px]">可将资料拖入这里，或点击“导入”。</p></div>}
        {folder?.truncated && <p className="px-2 py-1 text-[9px] text-amber-600">文件过多，仅显示前 2,000 项。</p>}
      </div>
      {dragActive && <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-[9px] border-2 border-dashed border-accent/55 bg-background/90 text-xs font-medium text-accent">释放后导入到“{currentDirectoryName}”</div>}
      <Dialog open={createType !== null} onOpenChange={open => { if (!open && !creating) setCreateType(null) }}>
        <DialogContent className="sm:max-w-[380px]">
          <form onSubmit={event => { event.preventDefault(); void createEntry() }}>
            <DialogHeader>
              <DialogTitle>{createType === 'directory' ? '新建文件夹' : '新建 Markdown'}</DialogTitle>
              <DialogDescription>将在“{currentDirectoryName}”中创建。</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label htmlFor={createNameId} className="mb-1.5 block text-xs font-medium">名称</label>
              <Input ref={createNameRef} id={createNameId} name="research-entry-name" autoComplete="off" value={createName} onChange={event => setCreateName(event.target.value)} placeholder={createType === 'directory' ? '例如：财务模型…' : '例如：研究笔记.md…'} aria-invalid={!!createError} aria-describedby={createError ? `${createNameId}-error` : undefined} />
              {createType === 'markdown' && <p className="mt-1.5 text-[10px] text-muted-foreground">未填写扩展名时会自动添加 .md。</p>}
              {createError && <p id={`${createNameId}-error`} role="alert" className="mt-2 break-words text-xs text-destructive">{createError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateType(null)} disabled={creating}>取消</Button>
              <Button type="submit" disabled={creating}>{creating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}创建</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function ResearchScopeWorkspace({ kind, research }: { kind: ScopeKind; research: WorkspaceResearchController }) {
  const { scope, loading, error, load, commit } = useWorkspaceResearchScope()
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState('all')
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<ScopeItem | undefined>()
  const [removeItem, setRemoveItem] = React.useState<ScopeItem | null>(null)

  const items = React.useMemo(() => {
    if (!scope) return []
    const source: ScopeItem[] = kind === 'watchlist' ? scope.watchlist : scope.sectors
    const normalizedQuery = query.trim().toLowerCase()
    return source.filter(item => {
      const matchesQuery = !normalizedQuery || JSON.stringify(item).toLowerCase().includes(normalizedQuery)
      const matchesFilter = filter === 'all' || ('code' in item ? item.group === filter : item.attention === filter)
      return matchesQuery && matchesFilter
    })
  }, [filter, kind, query, scope])

  const filters = React.useMemo(() => {
    if (!scope) return []
    return kind === 'watchlist'
      ? [...new Set(scope.watchlist.map(item => item.group).filter(Boolean))]
      : ATTENTION_OPTIONS.map(option => option.value)
  }, [kind, scope])

  if (loading) return <div role="status" aria-live="polite" className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />正在读取研究范围</div>
  if (error || !scope) return <div className="flex flex-1 items-center justify-center p-6"><div role="alert" className="max-w-md rounded-[10px] border border-destructive/20 bg-destructive/5 p-4 text-sm"><div className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 text-destructive" /><div><p className="font-medium">无法读取研究范围</p><p className="mt-1 break-words text-xs text-muted-foreground">{error || '研究范围返回了无效数据。'}</p><Button size="sm" variant="outline" className="mt-3" onClick={() => { void load() }}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />重试</Button></div></div></div></div>

  const Icon = kind === 'watchlist' ? Star : Tags
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/50 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-accent/10"><Icon className="h-4 w-4 text-accent" /></div>
        <div className="min-w-0 flex-1"><h1 className="text-sm font-semibold">{kind === 'watchlist' ? '公司' : '行业'}</h1><p className="text-[10px] text-muted-foreground">研究范围与进度 · 不含模拟行情</p></div>
        <Button size="sm" className="h-8 text-xs" onClick={() => { setEditingItem(undefined); setEditorOpen(true) }}><Plus className="mr-1.5 h-3.5 w-3.5" />新增</Button>
      </header>
      <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-4 py-2.5">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} className="h-8 pl-8 text-xs" aria-label={kind === 'watchlist' ? '搜索公司研究范围' : '搜索行业研究范围'} placeholder={kind === 'watchlist' ? '搜索名称、代码、标签或关注逻辑' : '搜索行业、逻辑或关联资料'} /></div>
        <select aria-label={kind === 'watchlist' ? '按公司分组筛选' : '按行业关注等级筛选'} value={filter} onChange={event => setFilter(event.target.value)} className="h-8 max-w-36 rounded-md border border-foreground/15 bg-background px-2 text-xs"><option value="all">全部{kind === 'watchlist' ? '分组' : '等级'}</option>{filters.map(value => <option key={value} value={value}>{kind === 'sectors' ? ATTENTION_LABEL[value as ResearchAttentionLevel] : value}</option>)}</select>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div role="status" className="flex min-h-60 flex-col items-center justify-center text-center"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/[0.04]"><Icon className="h-4 w-4 text-muted-foreground" /></div><p className="mt-3 text-sm font-medium">{query || filter !== 'all' ? '没有匹配的研究条目' : `尚未添加${kind === 'watchlist' ? '公司' : '行业'}`}</p><p className="mt-1 max-w-sm text-xs text-muted-foreground">{query || filter !== 'all' ? '调整搜索或筛选条件。' : '从真实研究对象开始建立范围、逻辑与进度，不会填充任何模拟数据。'}</p>{!query && filter === 'all' && <Button size="sm" variant="outline" className="mt-4" onClick={() => setEditorOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />新增第一条</Button>}</div>
        ) : (
          <div className="grid gap-2">
            {items.map(item => {
              const company = 'code' in item
              return (
                <article key={item.id} className="group rounded-[10px] border border-border/45 bg-foreground-2/45 p-3 transition-colors hover:border-foreground/15 hover:bg-foreground-2">
                  <div className="flex items-start gap-3">
                    <button className="min-w-0 flex-1 text-left" onClick={() => openItemTab(item, research)}>
                      <div className="flex flex-wrap items-center gap-2"><h2 className="text-[13px] font-semibold">{item.name}</h2>{company && <span className="font-mono text-[10px] text-muted-foreground">{item.code} · {item.market}</span>}{!company && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">{ATTENTION_LABEL[item.attention]}</span>}<StatusPill status={item.status} /></div>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-foreground/65">{item.thesis || '尚未记录研究逻辑。'}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground"><span className="flex min-w-0 items-center gap-1" title={item.folderPath}><Folder className="h-3 w-3" />{item.folderPath.split('/').pop()}</span>{company && item.group && <span>{item.group}</span>}{company && item.tags.map(tag => <span key={tag}>#{tag}</span>)}{!company && <span>{item.companyIds.length} 家关联公司</span>}<span>{item.relatedResources.length} 份外部关联资料</span><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{formatTime(item.lastResearchedAt)}</span></div>
                    </button>
                    <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"><Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`编辑 ${item.name}`} onClick={() => { setEditingItem(item); setEditorOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`移除 ${item.name}`} onClick={() => setRemoveItem(item)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
      <ScopeEditorDialog open={editorOpen} kind={kind} initialItem={editingItem} scope={scope} onOpenChange={setEditorOpen} onSaved={commit} />
      <ConfirmRemoveDialog item={removeItem} kind={kind} scope={scope} onOpenChange={open => { if (!open) setRemoveItem(null) }} onRemoved={commit} />
    </div>
  )
}

export function ResearchScopeDetail({ tab, research }: { tab: ResearchTab; research: WorkspaceResearchController }) {
  const { activeWorkspaceId } = useAppShellContext()
  const { scope, loading, error, load, commit } = useWorkspaceResearchScope()
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [removeOpen, setRemoveOpen] = React.useState(false)
  const kind: ScopeKind = tab.type === 'company' ? 'watchlist' : 'sectors'
  const item = scope && (kind === 'watchlist' ? scope.watchlist : scope.sectors).find(entry => entry.id === tab.resource?.resourceId)

  const openResource = async (relativePath: string) => {
    try {
      if (!activeWorkspaceId) return
      const context = await window.electronAPI.getWorkspaceAgentContext(activeWorkspaceId, relativePath)
      research.openTab({ id: `research:${context.area}:${context.relativePath}`, title: context.name, type: context.area === 'notes' ? 'note' : 'file', resource: { kind: context.area === 'notes' ? 'note' : 'file', path: context.relativePath, mediaType: context.mediaType } })
    } catch (openError) {
      toast.error('无法打开关联资料', { description: openError instanceof Error ? openError.message : String(openError) })
    }
  }

  if (loading) return <div role="status" aria-live="polite" aria-label="正在读取研究条目" className="flex flex-1 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
  if (error || !scope) return <div className="flex flex-1 items-center justify-center p-6"><div role="alert" className="rounded-[10px] border border-destructive/20 bg-destructive/5 p-4 text-center text-xs text-destructive"><p className="break-words">{error || '研究范围返回了无效数据。'}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => { void load() }}>重试</Button></div></div>
  if (!item) return <div role="alert" className="flex flex-1 flex-col items-center justify-center text-center"><AlertTriangle className="h-5 w-5 text-amber-500" /><p className="mt-2 text-sm font-medium">该研究条目已不存在</p><p className="mt-1 text-xs text-muted-foreground">它可能已在其他视图或被 Agent 移除。</p><Button size="sm" variant="outline" className="mt-4" onClick={() => research.closeTab(tab.id)}>关闭标签页</Button></div>

  const company = 'code' in item
  const companyLinks = company ? [] : item.companyIds.map(id => scope.watchlist.find(entry => entry.id === id)).filter((entry): entry is WatchlistItem => !!entry)
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="shrink-0 border-b border-border/50 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-accent/10">{company ? <Building2 className="h-4 w-4 text-accent" /> : <Tags className="h-4 w-4 text-accent" />}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[15px] font-semibold leading-6">{item.name}</h1>
              <StatusPill status={item.status} />
              {company ? <span className="font-mono text-[10px] text-muted-foreground">{item.code} · {item.market}</span> : <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">{ATTENTION_LABEL[item.attention]}关注</span>}
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
              {company && item.group && <span className="rounded-full bg-foreground/[0.05] px-2 py-0.5">{item.group}</span>}
              {company && item.tags.map(tag => <span key={tag} className="rounded-full bg-foreground/[0.05] px-2 py-0.5">#{tag}</span>)}
              {!company && <span>{companyLinks.length} 家关联公司</span>}
              <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />最近研究：{formatTime(item.lastResearchedAt)}</span>
              <span className="flex min-w-0 items-center gap-1" title={item.folderPath}><Folder className="h-3 w-3" /><span className="truncate">{item.folderPath.split('/').pop()}</span></span>
            </div>
            <p className="mt-1.5 truncate text-[11px] text-foreground/60" title={item.thesis || undefined}>{item.thesis || (company ? '尚未记录关注逻辑。' : '尚未记录行业逻辑。')}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditorOpen(true)} aria-label={`编辑 ${item.name}`} title="编辑"><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`移除 ${item.name}`} title="移除" onClick={() => setRemoveOpen(true)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
        {(companyLinks.length > 0 || item.relatedResources.length > 0) && (
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto border-t border-border/30 pt-2">
            {companyLinks.map(entry => <button key={entry.id} type="button" onClick={() => openItemTab(entry, research)} className="flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2 text-[10px] hover:bg-foreground/[0.08]"><Building2 className="h-3 w-3 text-accent" />{entry.name}<span className="font-mono text-muted-foreground">{entry.code}</span></button>)}
            {item.relatedResources.map(path => <button key={path} type="button" onClick={() => { void openResource(path) }} className="flex h-6 max-w-56 shrink-0 items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2 text-[10px] hover:bg-foreground/[0.08]" title={path}><FileText className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="truncate">{path.split('/').pop()}</span></button>)}
          </div>
        )}
      </header>
      <main className="min-h-0 flex-1 p-3">
        <ResearchFolderBrowser kind={company ? 'watchlist' : 'sector'} itemId={item.id} folderPath={item.folderPath} onOpenFile={path => { void openResource(path) }} />
      </main>
      <ScopeEditorDialog open={editorOpen} kind={kind} initialItem={item} scope={scope} onOpenChange={setEditorOpen} onSaved={commit} />
      <ConfirmRemoveDialog item={removeOpen ? item : null} kind={kind} scope={scope} onOpenChange={open => setRemoveOpen(open)} onRemoved={next => { commit(next); research.closeTab(tab.id) }} />
    </div>
  )
}

export function ResearchScopeOverviewCard({ research }: { research: WorkspaceResearchController }) {
  const { scope, loading } = useWorkspaceResearchScope()
  return (
    <section className="rounded-[10px] bg-background p-4 shadow-minimal">
      <h2 className="text-[13px] font-medium">研究范围</h2>
      {loading || !scope ? <div className="mt-2 h-4 w-20 animate-pulse rounded bg-foreground/5" /> : <div className="mt-2 flex items-end gap-5"><button onClick={() => research.openTab({ id: 'research:watchlist', title: '公司', type: 'watchlist' })} className="text-left"><strong className="text-lg font-semibold">{scope.watchlist.length}</strong><span className="ml-1 text-[10px] text-muted-foreground">家公司</span></button><button onClick={() => research.openTab({ id: 'research:sectors', title: '行业', type: 'sectors' })} className="text-left"><strong className="text-lg font-semibold">{scope.sectors.length}</strong><span className="ml-1 text-[10px] text-muted-foreground">个行业</span></button></div>}
    </section>
  )
}
