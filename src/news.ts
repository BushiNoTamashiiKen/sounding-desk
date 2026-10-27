const ENDPOINT =
  'https://www.nasdaq.com/api/news/topic/articlebysymbol?q=DVLT%7Cstocks&offset=0&limit=12'

type Row = {
  title?: string
  created?: string
  ago?: string
  publisher?: string
  primarysymbol?: string
  url?: string
}

function keep(row: Row) {
  const symbol = (row.primarysymbol || '').toLowerCase()
  const title = row.title || ''
  return symbol === 'dvlt' || /datavault/i.test(title)
}

function hrefFor(url: string) {
  if (url.startsWith('https://')) return url
  if (url.startsWith('/')) return `https://www.nasdaq.com${url}`
  return 'https://www.nasdaq.com/market-activity/stocks/dvlt/news-headlines'
}

function fill(list: HTMLOListElement, rows: Row[]) {
  list.replaceChildren()
  const picked = rows.filter(keep).filter((row) => row.title && row.url).slice(0, 5)
  if (!picked.length) {
    const item = document.createElement('li')
    item.className = 'news-empty'
    item.textContent = 'No Datavault headlines in this Nasdaq pull.'
    list.append(item)
    return
  }
  for (const row of picked) {
    const item = document.createElement('li')
    const link = document.createElement('a')
    link.href = hrefFor(row.url || '')
    link.target = '_blank'
    link.rel = 'noreferrer'
    const meta = document.createElement('span')
    meta.className = 'news-meta'
    const when = document.createElement('time')
    when.textContent = row.created || ''
    meta.append(when)
    if (row.publisher) {
      const source = document.createElement('span')
      source.textContent = row.publisher
      meta.append(source)
    }
    const title = document.createElement('strong')
    title.textContent = row.title || ''
    link.append(meta, title)
    item.append(link)
    list.append(item)
  }
}

function fail(list: HTMLOListElement) {
  list.replaceChildren()
  const item = document.createElement('li')
  item.className = 'news-empty'
  item.textContent = 'Headlines did not load. Use the Nasdaq link.'
  list.append(item)
}

export function initNews() {
  const list = document.querySelector<HTMLOListElement>('#news-list')
  if (!list) return { destroy() {} }
  const ac = new AbortController()
  fetch(ENDPOINT, { signal: ac.signal, headers: { Accept: 'application/json' } })
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status))
      return res.json() as Promise<{ data?: { rows?: Row[] } }>
    })
    .then((payload) => fill(list, payload.data?.rows || []))
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return
      fail(list)
    })
  return {
    destroy() {
      ac.abort()
    },
  }
}
