/**
 * ThreePanelLayout — the Rocket 3-column resizable layout.
 *
 * Uses react-resizable-panels (via shadcn/ui wrapper) for drag-resizable
 * columns — no custom resize logic needed. Dividers use the same
 * GradientResizeHandle as the classic shell (1px separator + cursor-following
 * gradient on hover).
 */

import * as React from 'react'
import { ResizablePanelGroup, ResizablePanel } from '@/components/ui/resizable'
import { GradientResizeHandle } from '@/components/ui/gradient-resize-handle'
import { ResearchSidebar } from './ResearchSidebar'
import { WorkspaceTabs } from './WorkspaceTabs'
import { ChatPanel } from './ChatPanel'
import { useAppShellContext } from '@/context/AppShellContext'
import { useWorkspaceResearchState } from '@/hooks/useWorkspaceResearchState'
import { useResearchSessionActions } from '@/hooks/useResearchSessionActions'

export function ThreePanelLayout() {
  const { activeWorkspaceId } = useAppShellContext()
  const research = useWorkspaceResearchState(activeWorkspaceId)
  const sessionActions = useResearchSessionActions()

  return (
    <div className="h-full w-full flex flex-col bg-background">
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0"
      >
        {/* === Left Panel: Navigation === */}
        <ResizablePanel
          defaultSize={17}
          minSize={13}
          maxSize={26}
          id="left-panel"
          order={1}
        >
          <div className="h-full flex flex-col min-w-0 bg-foreground-2">
            <ResearchSidebar research={research} sessionActions={sessionActions} />
          </div>
        </ResizablePanel>

        <GradientResizeHandle headerHeight={null} />

        {/* === Middle Panel: Main Workspace === */}
        <ResizablePanel
          defaultSize={55}
          minSize={30}
          id="main-panel"
          order={2}
        >
          <div className="h-full flex flex-col min-w-0">
            <WorkspaceTabs research={research} />
          </div>
        </ResizablePanel>

        <GradientResizeHandle headerHeight={null} />

        {/* === Right Panel: Agent Chat === */}
        <ResizablePanel
          defaultSize={28}
          minSize={20}
          maxSize={42}
          id="chat-panel"
          order={3}
        >
          <div className="h-full flex flex-col min-w-0">
            <ChatPanel sessionActions={sessionActions} research={research} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
