const CHART = 'https://api.nasdaq.com/api/quote/DVLT/chart?assetclass=stocks'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/dvlt-chart') {
      if (request.method !== 'GET') return new Response(null, { status: 405 })
      const upstream = await fetch(CHART, {
        headers: { Accept: 'application/json', 'User-Agent': 'dvlt-insights' },
      })
      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, max-age=15',
        },
      })
    }
    return env.ASSETS.fetch(request)
  },
}
