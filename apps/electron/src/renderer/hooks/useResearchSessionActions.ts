import * as React from 'react'
import { useAppShellContext } from '@/context/AppShellContext'
import { dispatchFocusInputEvent } from '@/components/app-shell/input/focus-input-events'
import { navigate, routes } from '@/lib/navigate'

export interface ResearchSessionActions {
  isCreating: boolean
  createSession: (draft?: string) => Promise<string | null>
  selectSession: (sessionId: string) => void
}

export function useResearchSessionActions(): ResearchSessionActions {
  const { activeWorkspaceId, onCreateSession, onInputChange } = useAppShellContext()
  const [isCreating, setIsCreating] = React.useState(false)

  const selectSession = React.useCallback((sessionId: string) => {
    navigate(routes.view.allSessions(sessionId))
    window.setTimeout(() => dispatchFocusInputEvent({ sessionId }), 50)
  }, [])

  const createSession = React.useCallback(async (draft?: string): Promise<string | null> => {
    if (!activeWorkspaceId || isCreating) return null
    setIsCreating(true)
    try {
      const session = await onCreateSession(activeWorkspaceId)
      if (draft?.trim()) onInputChange(session.id, draft)
      selectSession(session.id)
      return session.id
    } finally {
      setIsCreating(false)
    }
  }, [activeWorkspaceId, isCreating, onCreateSession, onInputChange, selectSession])

  return { isCreating, createSession, selectSession }
}
