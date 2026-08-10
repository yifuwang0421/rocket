import * as React from 'react'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Database, Plus, Timer, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { automationsAtom } from '@/atoms/automations'
import type { StandaloneViewType } from '@/atoms/workspace-tabs'
import { useActiveWorkspace, useAppShellContext } from '@/context/AppShellContext'
import { EditPopover, getEditConfig, type EditContextKey } from '@/components/ui/EditPopover'
import { deriveConnectionStatus } from '@/components/ui/source-status-indicator'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { SkillsListPanel } from './SkillsListPanel'
import { SourcesListPanel } from './SourcesListPanel'
import { AutomationsListPanel } from '@/components/automations/AutomationsListPanel'
import { AutomationInfoPage } from '@/components/automations/AutomationInfoPage'
import type { ExecutionEntry } from '@/components/automations/types'
import SkillInfoPage from '@/pages/SkillInfoPage'
import SourceInfoPage from '@/pages/SourceInfoPage'
import SettingsNavigator from '@/pages/settings/SettingsNavigator'
import { getSettingsPageComponent } from '@/pages/settings/settings-pages'
import type { LoadedSource, SettingsSubpage, SourceFilter } from '../../../shared/types'
import { cn } from '@/lib/utils'

interface ResearchAdminWorkspaceProps {
  view: StandaloneViewType
  onBack: () => void
}

const VIEW_TITLES: Record<StandaloneViewType, string> = {
  skills: 'Skills',
  'sources-mcp': 'MCP 数据源',
  'sources-api': 'API 数据源',
  scheduled: '定时任务',
  settings: '设置',
}

function AdminHeader({
  title,
  onBack,
  addContext,
  workspaceRootPath,
}: {
  title: string
  onBack: () => void
  addContext?: EditContextKey
  workspaceRootPath?: string
}) {
  return (
    <div className="flex h-[42px] shrink-0 items-center gap-2 border-b border-border/50 px-3">
      <button
        onClick={onBack}
        className="flex h-7 w-7 items-center justify-center rounded-[6px] hover:bg-foreground/5"
        aria-label="返回研究视图"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
      {addContext && workspaceRootPath && (
        <EditPopover
          align="end"
          trigger={
            <button
              className="flex h-7 w-7 items-center justify-center rounded-[6px] hover:bg-foreground/5"
              aria-label={`新建${title}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          }
          {...getEditConfig(addContext, workspaceRootPath)}
        />
      )}
    </div>
  )
}

function EmptyDetail({ icon: Icon, title, description }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function MasterDetail({ list, detail }: { list: React.ReactNode; detail: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-[34%] min-w-[240px] max-w-[360px] shrink-0 flex-col border-r border-border/50 bg-foreground-2">
        {list}
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {detail}
      </div>
    </div>
  )
}

function SkillsWorkspace() {
  const { t } = useTranslation()
  const { activeWorkspaceId, skills = [], activeSessionWorkingDirectory } = useAppShellContext()
  const workspace = useActiveWorkspace()
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (selectedSlug && !skills.some(skill => skill.slug === selectedSlug)) setSelectedSlug(null)
  }, [selectedSlug, skills])

  const handleDelete = React.useCallback(async (slug: string) => {
    if (!activeWorkspaceId) return
    try {
      await window.electronAPI.deleteSkill(activeWorkspaceId, slug)
      if (selectedSlug === slug) setSelectedSlug(null)
      toast.success(t('toast.deletedSkill', { slug }))
    } catch (error) {
      toast.error(t('toast.failedToDeleteSkill'), {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }, [activeWorkspaceId, selectedSlug, t])

  const handleToggle = React.useCallback(async (slug: string, enabled: boolean) => {
    if (!activeWorkspaceId) return
    try {
      await window.electronAPI.setSkillEnabled(activeWorkspaceId, slug, enabled)
    } catch (error) {
      toast.error('无法更新 Skill 状态', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }, [activeWorkspaceId])

  return (
    <MasterDetail
      list={
        <SkillsListPanel
          skills={skills}
          workspaceId={activeWorkspaceId ?? undefined}
          workspaceRootPath={workspace?.rootPath}
          selectedSkillSlug={selectedSlug}
          onSkillClick={skill => setSelectedSlug(skill.slug)}
          onDeleteSkill={handleDelete}
          onToggleSkill={handleToggle}
        />
      }
      detail={selectedSlug && activeWorkspaceId
        ? <SkillInfoPage skillSlug={selectedSlug} workspaceId={activeWorkspaceId} workingDirectory={activeSessionWorkingDirectory} />
        : <EmptyDetail icon={Zap} title="选择一个 Skill" description="查看、编辑或管理当前 Workspace 的 Skill。" />}
    />
  )
}

const API_PROVIDERS = [
  {
    id: 'akshare',
    name: 'AKShare',
    description: '面向 A 股、港股及中国宏观数据的 Python 数据接口。P1 仅管理配置与连接状态。',
  },
  {
    id: 'yfinance',
    name: 'yfinance',
    description: '面向美股及全球市场的 Yahoo Finance 数据接口。P1 仅管理配置与连接状态。',
  },
] as const

function findProviderSource(sources: LoadedSource[], providerId: string): LoadedSource | undefined {
  return sources.find(source => {
    const fields = [source.config.slug, source.config.name, source.config.provider]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLowerCase()
    if (providerId === 'yfinance') return fields.includes('yfinance') || fields.includes('yahoo finance')
    return fields.includes(providerId)
  })
}

const CONNECTION_LABELS = {
  connected: '已连接',
  needs_auth: '需要认证',
  failed: '连接失败',
  untested: '尚未测试',
  local_disabled: '已停用',
} as const

function ApiProviderOverview({ sources, onSelectSource, workspaceRootPath }: {
  sources: LoadedSource[]
  onSelectSource: (source: LoadedSource) => void
  workspaceRootPath?: string
}) {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-base font-semibold">API 提供商</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">配置连接信息并查看状态；P1 不在这里加载行情数据。</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {API_PROVIDERS.map(provider => {
            const source = findProviderSource(sources, provider.id)
            const status = source ? deriveConnectionStatus(source, true) : null
            return (
              <section key={provider.id} className="rounded-[10px] border border-border/50 bg-background p-4 shadow-minimal">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-foreground/5">
                    <Database className="h-4 w-4 text-foreground/60" />
                  </div>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px]',
                    status === 'connected' ? 'bg-success/10 text-success' : 'bg-foreground/5 text-muted-foreground',
                  )}>
                    {status ? CONNECTION_LABELS[status] : '未配置'}
                  </span>
                </div>
                <h3 className="mt-3 text-[13px] font-medium">{provider.name}</h3>
                <p className="mt-1 min-h-12 text-xs leading-relaxed text-muted-foreground">{provider.description}</p>
                <div className="mt-4">
                  {source ? (
                    <button
                      onClick={() => onSelectSource(source)}
                      className="rounded-[7px] bg-foreground/5 px-3 py-1.5 text-xs hover:bg-foreground/10"
                    >
                      查看配置
                    </button>
                  ) : workspaceRootPath ? (
                    <EditPopover
                      align="start"
                      trigger={
                        <button className="rounded-[7px] bg-foreground/5 px-3 py-1.5 text-xs hover:bg-foreground/10">
                          配置 API
                        </button>
                      }
                      {...getEditConfig('add-source-api', workspaceRootPath)}
                    />
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SourcesWorkspace({ view }: { view: 'sources-mcp' | 'sources-api' }) {
  const { t } = useTranslation()
  const { activeWorkspaceId, enabledSources = [] } = useAppShellContext()
  const workspace = useActiveWorkspace()
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null)
  const sourceType = view === 'sources-mcp' ? 'mcp' : 'api'
  const filteredSources = React.useMemo(
    () => enabledSources.filter(source => source.config.type === sourceType),
    [enabledSources, sourceType],
  )
  const sourceFilter = React.useMemo<SourceFilter>(
    () => ({ kind: 'type', sourceType }),
    [sourceType],
  )

  React.useEffect(() => {
    setSelectedSlug(current => current && filteredSources.some(source => source.config.slug === current) ? current : null)
  }, [filteredSources, view])

  const handleDelete = React.useCallback(async (slug: string) => {
    if (!activeWorkspaceId) return
    try {
      await window.electronAPI.deleteSource(activeWorkspaceId, slug)
      if (selectedSlug === slug) setSelectedSlug(null)
      toast.success(t('toast.deletedSource'))
    } catch (error) {
      toast.error(t('toast.failedToDeleteSource'), {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }, [activeWorkspaceId, selectedSlug, t])

  return (
    <MasterDetail
      list={
        <SourcesListPanel
          sources={enabledSources}
          sourceFilter={sourceFilter}
          workspaceRootPath={workspace?.rootPath}
          selectedSourceSlug={selectedSlug}
          onSourceClick={source => setSelectedSlug(source.config.slug)}
          onDeleteSource={handleDelete}
        />
      }
      detail={selectedSlug && activeWorkspaceId
        ? <SourceInfoPage sourceSlug={selectedSlug} workspaceId={activeWorkspaceId} onDelete={() => setSelectedSlug(null)} />
        : view === 'sources-api'
          ? <ApiProviderOverview sources={filteredSources} onSelectSource={source => setSelectedSlug(source.config.slug)} workspaceRootPath={workspace?.rootPath} />
          : <EmptyDetail icon={Database} title="选择一个 MCP 数据源" description="查看配置、认证信息、连接状态和可用工具。" />}
    />
  )
}

function ScheduledWorkspace() {
  const {
    onTestAutomation,
    onToggleAutomation,
    onDuplicateAutomation,
    onDeleteAutomation,
    onReplayAutomation,
    automationTestResults,
    getAutomationHistory,
  } = useAppShellContext()
  const workspace = useActiveWorkspace()
  const automations = useAtomValue(automationsAtom)
  const scheduled = React.useMemo(
    () => automations.filter(automation => automation.event === 'SchedulerTick'),
    [automations],
  )
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [executions, setExecutions] = React.useState<ExecutionEntry[]>([])
  const selected = scheduled.find(automation => automation.id === selectedId)

  React.useEffect(() => {
    if (selectedId && !scheduled.some(automation => automation.id === selectedId)) setSelectedId(null)
  }, [scheduled, selectedId])

  React.useEffect(() => {
    let cancelled = false
    if (!selectedId || !getAutomationHistory) {
      setExecutions([])
      return
    }
    void getAutomationHistory(selectedId).then(entries => {
      if (!cancelled) setExecutions(entries)
    })
    return () => { cancelled = true }
  }, [getAutomationHistory, selectedId])

  return (
    <MasterDetail
      list={
        <AutomationsListPanel
          automations={automations}
          automationFilter={{ kind: 'scheduled' }}
          selectedAutomationId={selectedId}
          workspaceRootPath={workspace?.rootPath}
          onAutomationClick={setSelectedId}
          onTestAutomation={onTestAutomation}
          onToggleAutomation={onToggleAutomation}
          onDuplicateAutomation={onDuplicateAutomation}
          onDeleteAutomation={onDeleteAutomation}
        />
      }
      detail={selected
        ? <AutomationInfoPage
            automation={selected}
            executions={executions}
            testResult={automationTestResults?.[selected.id]}
            onTest={onTestAutomation ? () => onTestAutomation(selected.id) : undefined}
            onToggleEnabled={onToggleAutomation ? () => onToggleAutomation(selected.id) : undefined}
            onDuplicate={onDuplicateAutomation ? () => onDuplicateAutomation(selected.id) : undefined}
            onDelete={onDeleteAutomation ? () => onDeleteAutomation(selected.id) : undefined}
            onReplay={onReplayAutomation}
          />
        : <EmptyDetail icon={Timer} title="选择一个定时任务" description="查看计划、立即运行、执行历史和启用状态。" />}
    />
  )
}

function SettingsWorkspace() {
  const [selectedSubpage, setSelectedSubpage] = React.useState<SettingsSubpage>('app')
  const SettingsPage = getSettingsPageComponent(selectedSubpage)
  return (
    <MasterDetail
      list={<SettingsNavigator selectedSubpage={selectedSubpage} onSelectSubpage={setSelectedSubpage} />}
      detail={<SettingsPage />}
    />
  )
}

export function ResearchAdminWorkspace({ view, onBack }: ResearchAdminWorkspaceProps) {
  const workspace = useActiveWorkspace()
  const addContext: EditContextKey | undefined = view === 'skills'
    ? 'add-skill'
    : view === 'sources-mcp'
      ? 'add-source-mcp'
      : view === 'sources-api'
        ? 'add-source-api'
        : view === 'scheduled'
          ? 'automation-config'
          : undefined

  return (
    <>
      <AdminHeader
        title={VIEW_TITLES[view]}
        onBack={onBack}
        addContext={addContext}
        workspaceRootPath={workspace?.rootPath}
      />
      {view === 'skills' && <SkillsWorkspace />}
      {(view === 'sources-mcp' || view === 'sources-api') && <SourcesWorkspace view={view} />}
      {view === 'scheduled' && <ScheduledWorkspace />}
      {view === 'settings' && <SettingsWorkspace />}
    </>
  )
}
