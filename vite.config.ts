import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

const CHART = 'https://api.nasdaq.com/api/quote/DVLT/chart?assetclass=stocks'

function chartProxy(): Plugin {
  const handle = (req: { url?: string; method?: string }, res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void }, next: () => void) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/dvlt-chart') return next()
    if (req.method !== 'GET') {
      res.statusCode = 405
      res.end()
      return
    }
    fetch(CHART, { headers: { Accept: 'application/json', 'User-Agent': 'dvlt-insights' } })
      .then(async (upstream) => {
        const body = await upstream.text()
        res.statusCode = upstream.status
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        res.end(body)
      })
      .catch(() => {
        res.statusCode = 502
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end('{"data":null}')
      })
  }
  return {
    name: 'dvlt-chart',
    configureServer(server) {
      server.middlewares.use(handle as never)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle as never)
    },
  }
}

export default defineConfig({
  plugins: [chartProxy()],
  server: {
    port: 5178,
    strictPort: false,
  },
})
