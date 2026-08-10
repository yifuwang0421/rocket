import type { StockSearchSuggestion } from '@rocket/shared/protocol'

const SEARCH_ENDPOINT = 'https://searchapi.eastmoney.com/api/suggest/get'
const SEARCH_TOKEN = 'D43BF722C8E33BDC906FB84D85E326E8'
const DEFAULT_LIMIT = 8
const MAX_LIMIT = 12
const STOCK_CLASSIFICATIONS = new Set(['AStock', 'BStock', 'HK', 'UsStock'])

export type StockSearchFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export class StockSearchError extends Error {
  constructor(public readonly code: 'INVALID_QUERY' | 'PROVIDER_UNAVAILABLE', message: string) {
    super(message)
    this.name = 'StockSearchError'
  }
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseSuggestions(value: unknown, limit: number): StockSearchSuggestion[] {
  if (!value || typeof value !== 'object') return []
  const table = (value as Record<string, unknown>).QuotationCodeTable
  if (!table || typeof table !== 'object') return []
  const data = (table as Record<string, unknown>).Data
  if (!Array.isArray(data)) return []

  const suggestions: StockSearchSuggestion[] = []
  const seen = new Set<string>()
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue
    const record = raw as Record<string, unknown>
    if (!STOCK_CLASSIFICATIONS.has(cleanString(record.Classify))) continue
    const name = cleanString(record.Name)
    const code = cleanString(record.Code)
    const market = cleanString(record.SecurityTypeName)
    if (!name || !code || !market) continue
    const key = `${market}:${code}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    suggestions.push({ name, code, market })
    if (suggestions.length >= limit) break
  }
  return suggestions
}

export async function searchStockSuggestions(
  query: string,
  requestedLimit = DEFAULT_LIMIT,
  fetchImpl: StockSearchFetch = fetch,
): Promise<StockSearchSuggestion[]> {
  const normalizedQuery = query.trim()
  if (!normalizedQuery || normalizedQuery.length > 100) {
    throw new StockSearchError('INVALID_QUERY', 'Enter a stock name or code between 1 and 100 characters')
  }
  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(requestedLimit) || DEFAULT_LIMIT))
  const url = new URL(SEARCH_ENDPOINT)
  url.searchParams.set('input', normalizedQuery)
  url.searchParams.set('type', '14')
  url.searchParams.set('token', SEARCH_TOKEN)

  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: 'application/json',
        referer: 'https://quote.eastmoney.com/',
        'user-agent': 'Rocket',
      },
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return parseSuggestions(await response.json(), limit)
  } catch (error) {
    if (error instanceof StockSearchError) throw error
    const message = error instanceof Error ? error.message : String(error)
    throw new StockSearchError('PROVIDER_UNAVAILABLE', `Stock search is temporarily unavailable: ${message}`)
  }
}
