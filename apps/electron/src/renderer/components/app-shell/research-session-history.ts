import type { SessionMeta } from '@/atoms/sessions'
import { getSessionTitle } from '@/utils/session'

export function filterWorkspaceSessionHistory(
  sessions: Iterable<SessionMeta>,
  workspaceId: string | null,
  query: string,
): SessionMeta[] {
  if (!workspaceId) return []
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return Array.from(sessions)
    .filter(session => session.workspaceId === workspaceId && !session.hidden)
    .filter(session => {
      if (!normalizedQuery) return true
      return `${getSessionTitle(session)} ${session.preview ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)
    })
    .sort((a, b) => (b.lastMessageAt ?? b.createdAt ?? 0) - (a.lastMessageAt ?? a.createdAt ?? 0))
}
