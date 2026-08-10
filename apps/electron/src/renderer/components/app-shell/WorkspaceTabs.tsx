import * as React from 'react'
import {
  BookOpen,
  Building2,
  FileText,
  FolderOpen,
  Landmark,
  NotebookPen,
  AlertTriangle,
  Star,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import type { ResearchTab } from '@/atoms/workspace-tabs'
import type { WorkspaceResearchController } from '@/hooks/useWorkspaceResearchState'
import { getResearchTabDomId, WorkspaceTabBar } from './WorkspaceTabBar'
import { ResearchAdminWorkspace } from './ResearchAdminWorkspace'
import { ResearchFilesWorkspace } from './ResearchFilesWorkspace'
import { MarkdownResearchEditor } from './MarkdownResearchEditor'
import { ResearchDocumentViewer } from './ResearchDocumentViewer'
import { ResearchScopeDetail, ResearchScopeOverviewCard, ResearchScopeWorkspace } from './ResearchScopeWorkspace'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Button } from '@/components/ui/button'

interface WorkspaceTabsProps {
  research: WorkspaceResearchController
}

const RESEARCH_META: Record<ResearchTab['type'], { title: string; description: string; icon: LucideIcon }> = {
  overview: { title: '投研概览', description: '继续当前 Workspace 的研究工作。', icon: BookOpen },
  watchlist: { title: '公司', description: '管理公司研究范围、状态、标签和关联资料。', icon: Star },
  sectors: { title: '行业', description: '管理行业研究范围、状态和关联公司。', icon: Tags },
  notes: { title: '笔记', description: '创建或导入 Markdown 笔记。', icon: NotebookPen },
  materials: { title: '资料目录', description: '浏览并导入当前 Workspace 的研究资料。', icon: FolderOpen },
  note: { title: '笔记', description: 'Markdown 笔记。', icon: NotebookPen },
  file: { title: '文件', description: '阅读当前 Workspace 中的研究资料。', icon: FileText },
  company: { title: '公司研究', description: '浏览公司属性、文件夹和研究文件。', icon: Building2 },
  industry: { title: '行业研究', description: '浏览行业属性、文件夹和研究文件。', icon: Landmark },
}

function ResearchOverview({ research }: WorkspaceTabsProps) {
  const otherTabs = research.state.tabs.filter(tab => tab.type !== 'overview')

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto grid w-full max-w-4xl gap-4">
        <div>
          <h1 className="text-base font-semibold text-foreground">投研概览</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">当前 Workspace 的研究入口与运行状态</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <section className="rounded-[10px] bg-background p-4 shadow-minimal">
            <h2 className="text-[13px] font-medium">继续研究</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              {otherTabs.length > 0 ? `当前已打开 ${otherTabs.length} 个研究标签页。` : '尚未打开其他研究内容。'}
            </p>
          </section>
          <ResearchScopeOverviewCard research={research} />
          <section className="rounded-[10px] bg-background p-4 shadow-minimal">
            <h2 className="text-[13px] font-medium">运行状态</h2>
            <p className="mt-2 text-xs text-muted-foreground">研究 Tab 状态已按 Workspace 隔离并持久化。</p>
          </section>
        </div>

        <section className="rounded-[10px] bg-background p-4 shadow-minimal">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-medium">研究资料</h2>
              <p className="mt-1 text-xs text-muted-foreground">浏览 documents/，或将外部研究文件复制导入当前 Workspace。</p>
            </div>
            <button
              onClick={() => research.openTab({ id: 'research:materials', title: '资料目录', type: 'materials' })}
              className="rounded-[7px] bg-foreground/5 px-3 py-1.5 text-xs hover:bg-foreground/10"
            >
              打开资料目录
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function ResearchPlaceholder({ tab }: { tab: ResearchTab }) {
  const meta = RESEARCH_META[tab.type]
  const Icon = meta.icon
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon /></EmptyMedia>
        <EmptyTitle>{tab.title || meta.title}</EmptyTitle>
        <EmptyDescription>{meta.description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function MissingResearchResource({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <section role="alert" className="w-full max-w-sm rounded-[10px] border border-amber-500/20 bg-amber-500/[0.06] p-4 text-center">
        <AlertTriangle className="mx-auto h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <h1 className="mt-2 text-sm font-medium">无法定位该研究文件</h1>
        <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
          标签页缺少可读取的 Workspace 路径或文件类型。请关闭后从“笔记”或“资料目录”重新打开。
        </p>
        <Button size="sm" variant="outline" className="mt-4" onClick={onClose}>关闭标签页</Button>
      </section>
    </div>
  )
}

export function WorkspaceTabs({ research }: WorkspaceTabsProps) {
  const { state } = research

  if (state.middleView.mode === 'standalone') {
    return <ResearchAdminWorkspace view={state.middleView.view} onBack={research.returnToResearch} />
  }

  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId) ?? state.tabs[0]
  const activeTabDomId = getResearchTabDomId(activeTab.id)
  const isFileTab = activeTab.type === 'note' || activeTab.type === 'file'
  const hasFileResource = Boolean(activeTab.resource?.path && activeTab.resource.mediaType)

  return (
    <>
      <WorkspaceTabBar
        tabs={state.tabs}
        activeTabId={activeTab.id}
        onActivate={research.activateTab}
        onClose={research.closeTab}
      />
      <div
        id={`${activeTabDomId}-panel`}
        role="tabpanel"
        aria-labelledby={activeTabDomId}
        tabIndex={0}
        className="flex min-h-0 flex-1 flex-col overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {activeTab.type === 'overview' && <ResearchOverview research={research} />}
        {activeTab.type === 'notes' && <ResearchFilesWorkspace area="notes" research={research} />}
        {activeTab.type === 'materials' && <ResearchFilesWorkspace area="documents" research={research} />}
        {activeTab.type === 'watchlist' && <ResearchScopeWorkspace kind="watchlist" research={research} />}
        {activeTab.type === 'sectors' && <ResearchScopeWorkspace kind="sectors" research={research} />}
        {(activeTab.type === 'company' || activeTab.type === 'industry') && <ResearchScopeDetail tab={activeTab} research={research} />}
        {isFileTab && !hasFileResource && <MissingResearchResource onClose={() => research.closeTab(activeTab.id)} />}
        {isFileTab && hasFileResource && activeTab.resource?.mediaType === 'text/markdown'
          && <MarkdownResearchEditor key={activeTab.id} tab={activeTab} research={research} />}
        {isFileTab && hasFileResource && activeTab.resource?.mediaType !== 'text/markdown'
          && <ResearchDocumentViewer key={activeTab.id} tab={activeTab} research={research} />}
        {!['overview', 'notes', 'materials', 'note', 'file', 'watchlist', 'sectors', 'company', 'industry'].includes(activeTab.type)
          && <ResearchPlaceholder tab={activeTab} />}
      </div>
    </>
  )
}
