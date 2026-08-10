import { getWorkspaceByNameOrId } from '@rocket/shared/config'
import {
  RPC_CHANNELS,
  type CreateResearchScopeFolderEntryInput,
  type ImportResearchScopeFolderInput,
  type RemoveResearchScopeItemInput,
  type ResearchScopeFolderInput,
  type StockSearchInput,
  type UpsertSectorItemInput,
  type UpsertWatchlistItemInput,
} from '@rocket/shared/protocol'
import type { RpcServer } from '@rocket/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import {
  getWorkspaceResearchScope,
  createWorkspaceResearchScopeFolderEntry,
  importFilesToWorkspaceResearchScopeFolder,
  listWorkspaceResearchScopeFolder,
  removeWorkspaceResearchScopeItem,
  upsertWorkspaceSectorItem,
  upsertWorkspaceWatchlistItem,
} from '../../services/workspace-research-scope'
import { searchStockSuggestions } from '../../services/stock-search'

export const HANDLED_CHANNELS = Object.values(RPC_CHANNELS.researchScope)

export function registerResearchScopeHandlers(server: RpcServer, _deps: HandlerDeps): void {
  const getWorkspaceRoot = (contextWorkspaceId: string | null | undefined, workspaceId: string): string => {
    if (contextWorkspaceId && contextWorkspaceId !== workspaceId) throw new Error('Workspace mismatch')
    const workspace = getWorkspaceByNameOrId(workspaceId)
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
    return workspace.rootPath
  }

  server.handle(RPC_CHANNELS.researchScope.GET, async (ctx, workspaceId: string) => {
    return getWorkspaceResearchScope(getWorkspaceRoot(ctx.workspaceId, workspaceId))
  })
  server.handle(RPC_CHANNELS.researchScope.SEARCH_STOCKS, async (ctx, input: StockSearchInput) => {
    getWorkspaceRoot(ctx.workspaceId, input.workspaceId)
    return searchStockSuggestions(input.query, input.limit)
  })
  server.handle(RPC_CHANNELS.researchScope.LIST_FOLDER, async (ctx, input: ResearchScopeFolderInput) => {
    return listWorkspaceResearchScopeFolder(getWorkspaceRoot(ctx.workspaceId, input.workspaceId), input.kind, input.id)
  })
  server.handle(RPC_CHANNELS.researchScope.CREATE_FOLDER_ENTRY, async (ctx, input: CreateResearchScopeFolderEntryInput) => {
    const { workspaceId, ...request } = input
    return createWorkspaceResearchScopeFolderEntry(getWorkspaceRoot(ctx.workspaceId, workspaceId), request)
  })
  server.handle(RPC_CHANNELS.researchScope.IMPORT_TO_FOLDER, async (ctx, input: ImportResearchScopeFolderInput) => {
    return importFilesToWorkspaceResearchScopeFolder(
      getWorkspaceRoot(ctx.workspaceId, input.workspaceId),
      input.kind,
      input.id,
      input.targetRelativePath,
      input.sourcePaths,
    )
  })
  server.handle(RPC_CHANNELS.researchScope.UPSERT_WATCHLIST, async (ctx, input: UpsertWatchlistItemInput) => {
    const { workspaceId, ...mutation } = input
    return upsertWorkspaceWatchlistItem(getWorkspaceRoot(ctx.workspaceId, workspaceId), mutation)
  })
  server.handle(RPC_CHANNELS.researchScope.REMOVE_WATCHLIST, async (ctx, input: RemoveResearchScopeItemInput) => {
    return removeWorkspaceResearchScopeItem(getWorkspaceRoot(ctx.workspaceId, input.workspaceId), 'watchlist', input.id, input.expectedRevision)
  })
  server.handle(RPC_CHANNELS.researchScope.UPSERT_SECTOR, async (ctx, input: UpsertSectorItemInput) => {
    const { workspaceId, ...mutation } = input
    return upsertWorkspaceSectorItem(getWorkspaceRoot(ctx.workspaceId, workspaceId), mutation)
  })
  server.handle(RPC_CHANNELS.researchScope.REMOVE_SECTOR, async (ctx, input: RemoveResearchScopeItemInput) => {
    return removeWorkspaceResearchScopeItem(getWorkspaceRoot(ctx.workspaceId, input.workspaceId), 'sector', input.id, input.expectedRevision)
  })
}
