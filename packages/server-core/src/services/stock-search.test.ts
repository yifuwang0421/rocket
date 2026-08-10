import { describe, expect, it } from 'bun:test'
import { searchStockSuggestions } from './stock-search'

describe('stock search', () => {
  it('normalizes stock suggestions and excludes non-equity results', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      QuotationCodeTable: {
        Data: [
          { Code: '600519', Name: '贵州茅台', Classify: 'AStock', SecurityTypeName: '沪A' },
          { Code: '510300', Name: '沪深300ETF', Classify: 'Fund', SecurityTypeName: 'ETF' },
          { Code: '00700', Name: '腾讯控股', Classify: 'HK', SecurityTypeName: '港股' },
        ],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })

    await expect(searchStockSuggestions('茅台', 8, fetchImpl)).resolves.toEqual([
      { code: '600519', name: '贵州茅台', market: '沪A' },
      { code: '00700', name: '腾讯控股', market: '港股' },
    ])
  })

  it('rejects empty queries and masks provider failures', async () => {
    await expect(searchStockSuggestions('')).rejects.toMatchObject({ code: 'INVALID_QUERY' })
    await expect(searchStockSuggestions('AAPL', 8, async () => new Response('', { status: 503 })))
      .rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
  })
})
