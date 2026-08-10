import type { SessionToolContext } from '../context.ts'
import type { ToolResult } from '../types.ts'
import { errorResponse, successResponse } from '../response.ts'

export interface ManageResearchScopeArgs {
  action: 'list' | 'upsert' | 'remove'
  kind?: 'watchlist' | 'sector'
  id?: string
  confirm?: boolean
  item?: Record<string, unknown>
}

export async function handleManageResearchScope(ctx: SessionToolContext, args: ManageResearchScopeArgs): Promise<ToolResult> {
  if (!ctx.manageResearchScope) return errorResponse('Research scope management is not available in this environment.')
  if (args.action !== 'list' && !args.kind) return errorResponse('kind is required for upsert and remove actions.')
  if (args.action === 'upsert' && !args.item) return errorResponse('item is required for an upsert action.')
  if (args.action === 'remove' && (!args.id || args.confirm !== true)) {
    return errorResponse('Removing a research item requires its id and confirm=true after explicit user confirmation.')
  }
  try {
    const result = await ctx.manageResearchScope(args)
    return successResponse(JSON.stringify(result, null, 2))
  } catch (error) {
    return errorResponse(`Failed to manage research scope: ${error instanceof Error ? error.message : String(error)}`)
  }
}
