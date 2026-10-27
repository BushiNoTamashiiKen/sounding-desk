const ENDPOINT = '/api/dvlt-chart'
const POLL_MS = 30_000
const W = 320
const H = 96

type Point = { y?: number }
type ChartData = {
  lastSalePrice?: string
  netChange?: string
  percentageChange?: string
  deltaIndicator?: string
  timeAsOf?: string
  chart?: Point[]
}

function money(value: string | undefined) {
  return value && /^\$\d+\.\d+$/.test(value) ? value : ''
}

function signed(value: string | undefined) {
  return value && /^[+-]\d+\.\d+$/.test(value) ? value : ''
}

function percent(value: string | undefined) {
  return value && /^[+-]\d+\.\d+%$/.test(value) ? value : ''
}

function asOf(value: string | undefined) {
  if (!value || value.length > 48 || /[<>]/.test(value)) return ''
  return value
}

function series(points: Point[] | undefined) {
  return (points || []).map((point) => point.y).filter((y): y is number => typeof y === 'number' && Number.isFinite(y))
}

function geometry(values: number[]) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.18, 0.0004)
  const lo = min - pad
  const hi = max + pad
  const left = 6
  const right = 8
  const top = 10
  const bottom = 12
  const innerW = W - left - right
  const innerH = H - top - bottom
  const coords = values.map((value, index) => {
    const x = values.length === 1 ? left + innerW / 2 : left + (index / (values.length - 1)) * innerW
    const y = top + (1 - (value - lo) / (hi - lo)) * innerH
    return [x, y] as const
  })
  const line = coords.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')
  const area = `${line} L${coords[coords.length - 1][0].toFixed(2)} ${H - bottom} L${coords[0][0].toFixed(2)} ${H - bottom} Z`
  const open = coords[0]
  return { line, area, end: coords[coords.length - 1], openY: open[1] }
}

export function initQuote() {
  const plate = document.querySelector<HTMLElement>('#quote')
  const price = document.querySelector<HTMLElement>('#quote-px')
  const change = document.querySelector<HTMLElement>('#quote-chg')
  const note = document.querySelector<HTMLElement>('#quote-asof')
  const stroke = document.querySelector<SVGPathElement>('#quote-stroke')
  const area = document.querySelector<SVGPathElement>('#quote-area')
  const base = document.querySelector<SVGLineElement>('#quote-base')
  const dot = document.querySelector<SVGCircleElement>('#quote-dot')
  if (!plate || !price || !change || !note || !stroke || !area || !base || !dot) return { destroy() {} }

  let timer = 0
  let drawn = false
  let ac = new AbortController()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const paint = (data: ChartData) => {
    const last = money(data.lastSalePrice)
    const move = signed(data.netChange)
    const pct = percent(data.percentageChange)
    const when = asOf(data.timeAsOf)
    const values = series(data.chart)
    if (!last || values.length < 2) throw new Error('incomplete')
    price.textContent = last
    change.textContent = [move, pct].filter(Boolean).join('  ')
    note.textContent = when ? `Nasdaq line, as of ${when}.` : 'Nasdaq line.'
    const direction = data.deltaIndicator === 'down' ? 'is-down' : data.deltaIndicator === 'up' ? 'is-up' : 'is-flat'
    plate.classList.remove('is-up', 'is-down', 'is-flat', 'is-empty')
    plate.classList.add(direction)
    const shape = geometry(values)
    stroke.setAttribute('d', shape.line)
    area.setAttribute('d', shape.area)
    base.setAttribute('x1', '6')
    base.setAttribute('x2', String(W - 8))
    base.setAttribute('y1', shape.openY.toFixed(2))
    base.setAttribute('y2', shape.openY.toFixed(2))
    dot.setAttribute('cx', shape.end[0].toFixed(2))
    dot.setAttribute('cy', shape.end[1].toFixed(2))
    if (!drawn && !reduce) {
      stroke.classList.add('is-draw')
      drawn = true
    }
  }

  const fail = () => {
    if (plate.classList.contains('is-up') || plate.classList.contains('is-down') || plate.classList.contains('is-flat')) {
      note.textContent = 'The latest pull did not load. Showing the last line.'
      return
    }
    plate.classList.add('is-empty')
    price.textContent = ''
    change.textContent = ''
    note.textContent = 'The Nasdaq line did not load.'
  }

  const load = () => {
    ac.abort()
    ac = new AbortController()
    fetch(ENDPOINT, { signal: ac.signal, headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json() as Promise<{ data?: ChartData | null }>
      })
      .then((payload) => {
        if (!payload.data) throw new Error('empty')
        paint(payload.data)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        fail()
      })
  }

  const arm = () => {
    window.clearInterval(timer)
    if (document.hidden) return
    timer = window.setInterval(load, POLL_MS)
  }

  const onHide = () => {
    if (document.hidden) window.clearInterval(timer)
    else {
      load()
      arm()
    }
  }

  load()
  arm()
  document.addEventListener('visibilitychange', onHide)

  return {
    destroy() {
      window.clearInterval(timer)
      ac.abort()
      document.removeEventListener('visibilitychange', onHide)
    },
  }
}
