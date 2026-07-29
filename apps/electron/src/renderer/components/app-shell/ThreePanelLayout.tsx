/**
 * ThreePanelLayout — the Rocket 3-column resizable layout.
 *
 * Uses react-resizable-panels (via shadcn/ui wrapper) for drag-resizable
 * columns — no custom resize logic needed.
 */

import * as React from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { ResearchSidebar } from './ResearchSidebar'
import { WorkspaceTabs } from './WorkspaceTabs'
import { ChatPanel } from './ChatPanel'

export function ThreePanelLayout() {
  return (
    <div className="h-full w-full flex flex-col bg-background">
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0"
      >
        {/* === Left Panel: Navigation === */}
        <ResizablePanel
          defaultSize={16}
          minSize={10}
          maxSize={25}
          id="left-panel"
          order={1}
        >
          <div className="h-full flex flex-col border-r border-border/30 bg-muted/10">
            <ResearchSidebar />
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-[3px] bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-colors data-[resize-handle-active]:bg-accent/50" />

        {/* === Middle Panel: Main Workspace === */}
        <ResizablePanel
          defaultSize={55}
          minSize={30}
          id="main-panel"
          order={2}
        >
          <div className="h-full flex flex-col min-w-0">
            <WorkspaceTabs />
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-[3px] bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-colors data-[resize-handle-active]:bg-accent/50" />

        {/* === Right Panel: Agent Chat === */}
        <ResizablePanel
          defaultSize={29}
          minSize={18}
          maxSize={45}
          id="chat-panel"
          order={3}
        >
          <div className="h-full flex flex-col min-w-0 border-l border-border/30">
            <ChatPanel />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
