/**
 * ChatPanel — right-side Agent chat panel for Rocket.
 *
 * Wraps the existing ChatPage component in a persistent right sidebar.
 */

import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ChatPanel() {
  return (
    <>
      {/* Panel header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/20 bg-muted/5">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-medium text-foreground/70">Agent</span>
        </div>
      </div>

      {/* Chat area placeholder — will connect to ChatPage in P2 */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-6">
          <Bot className="h-8 w-8 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground/50 leading-relaxed">
            Start a conversation with<br />your research agent
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 text-xs h-7 rounded-[6px]"
            disabled
          >
            New Chat
          </Button>
        </div>
      </div>
    </>
  )
}
