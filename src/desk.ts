import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type Lenis from 'lenis'
import { cueWatch } from './film'
import { track } from './track'

gsap.registerPlugin(ScrollTrigger)

const SEEN_KEY = 'dvlt-media-seen'

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function writeSeen() {
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
  } catch {
    /* private mode */
  }
}

function scrollToEl(lenis: Lenis | null, el: Element, offset = -72, immediate = false) {
  const top = Math.max(0, window.scrollY + el.getBoundingClientRect().top + offset)
  if (lenis && typeof lenis.scrollTo === 'function') {
    lenis.scrollTo(top, { immediate, duration: immediate ? 0 : 1.05 })
    return
  }
  window.scrollTo({ top, behavior: immediate ? 'auto' : 'smooth' })
}

export function initDesk(lenis: Lenis | null) {
  const entries = Array.from(document.querySelectorAll<HTMLElement>('[data-entry]'))
  const filters = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-filter]'))
  const search = document.querySelector<HTMLInputElement>('#search')
  const empty = document.querySelector<HTMLElement>('#empty')
  const result = document.querySelector<HTMLElement>('#result')
  const grid = document.querySelector<HTMLElement>('#story-grid')
  const nav = document.querySelector<HTMLDetailsElement>('.nav-details')
  let topic = 'all'
  let format = 'all'
  let limit = 6
  const views = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-view]'))
  const more = document.querySelector<HTMLAnchorElement>('#load-more')
  const searchToggle = document.querySelector<HTMLButtonElement>('.nav-search-toggle')
  const navBar = document.querySelector<HTMLElement>('.nav')
  const shell = document.querySelector<HTMLElement>('.billboard-player')
  const leadPlay = document.querySelector<HTMLAnchorElement>('#lead-play')

  const seen = readSeen()
  const visitLabel = document.querySelector<HTMLElement>('#visit-label')
  if (seen && visitLabel) visitLabel.hidden = false
  if (seen) {
    const then = Date.parse(seen)
    if (!Number.isNaN(then)) {
      document.querySelectorAll<HTMLElement>('[data-published]').forEach((el) => {
        const published = Date.parse(el.dataset.published || '')
        if (!Number.isNaN(published) && published > then) el.classList.add('is-new')
      })
    }
  }
  window.addEventListener('pagehide', writeSeen)

  const cards = () => entries.filter((entry) => entry.closest('#story-grid'))

  const topicMatch = (entry: HTMLElement) => {
    if (topic === 'all') return true
    const tags = `${entry.dataset.topic || ''} ${entry.dataset.tags || ''}`.split(/\s+/).filter(Boolean)
    return tags.includes(topic)
  }

  const openChapter = (target: Element) => {
    if (!target.classList.contains('chapter')) return
    document.querySelectorAll('.chapter.is-open').forEach((node) => {
      if (node !== target) node.classList.remove('is-open')
    })
    target.classList.add('is-open')
    if (target instanceof HTMLElement) target.hidden = false
  }

  const apply = () => {
    const query = search?.value.trim().toLowerCase() ?? ''
    entries.forEach((entry) => {
      const hay = `${entry.dataset.search || ''} ${entry.textContent || ''}`.toLowerCase()
      const textOk = !query || hay.includes(query)
      entry.dataset.match = topicMatch(entry) && textOk ? '1' : '0'
    })
    const paging = topic === 'all' && format === 'all' && query.length === 0
    let matched = 0
    let shown = 0
    cards().forEach((card) => {
      const href = card.querySelector('a')?.getAttribute('href') || ''
      const chapter = href.startsWith('#') ? document.getElementById(href.slice(1)) : null
      const formatOk = format === 'all' || card.dataset.format === format
      const matches = formatOk && (card.dataset.match === '1' || chapter?.dataset.match === '1')
      if (!matches) {
        card.hidden = true
        if (chapter) chapter.hidden = true
        return
      }
      matched += 1
      const within = !paging || matched <= limit
      card.hidden = !within
      if (chapter) chapter.hidden = !(within || chapter.classList.contains('is-open'))
      if (within) shown += 1
    })
    document.querySelector<HTMLButtonElement>('.search-clear')?.toggleAttribute('hidden', query.length === 0)
    if (query && navBar) {
      navBar.classList.add('is-searching')
      searchToggle?.setAttribute('aria-expanded', 'true')
    }
    if (empty) empty.hidden = matched !== 0
    if (result) {
      result.hidden = matched === 0
      if (paging && matched > shown) result.textContent = `${shown} of ${matched} stories`
      else result.textContent = matched === 1 ? '1 story' : `${matched} stories`
    }
    if (more) {
      const remain = paging && matched > shown
      if (remain) {
        more.hidden = false
        more.dataset.more = '1'
        more.textContent = 'Load more stories'
        more.href = '#index'
      } else if (paging && matched > 0) {
        more.hidden = false
        more.dataset.more = '0'
        more.textContent = 'All stories'
        more.href = 'https://dvlt.ai/insights'
      } else {
        more.hidden = true
      }
    }
    grid?.classList.toggle('is-filtered', topic !== 'all' || format !== 'all' || query.length > 0)
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      topic = button.dataset.filter || 'all'
      limit = 6
      filters.forEach((item) => item.setAttribute('aria-pressed', String(item === button)))
      apply()
    })
  })

  views.forEach((button) => {
    button.addEventListener('click', () => {
      format = button.dataset.view || 'all'
      limit = 6
      views.forEach((item) => item.setAttribute('aria-pressed', String(item === button)))
      apply()
    })
  })

  more?.addEventListener('click', (event) => {
    if (more.dataset.more !== '1') return
    event.preventDefault()
    limit += 6
    apply()
  })

  const revealResults = () => {
    const index = document.querySelector('#index')
    if (!index || index.getBoundingClientRect().top < 88) return
    scrollToEl(lenis, index)
  }

  let hadQuery = false
  search?.addEventListener('input', () => {
    const query = search.value.trim()
    const started = !hadQuery && query.length > 0
    hadQuery = query.length > 0
    apply()
    if (started) revealResults()
  })
  document.querySelector('.search-clear')?.addEventListener('click', () => {
    if (!search) return
    search.value = ''
    hadQuery = false
    search.focus()
    apply()
  })
  initAlerts(lenis)

  document.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest('a')
    if (!(link instanceof HTMLAnchorElement)) return
    const href = link.getAttribute('href') || ''

    if (window.matchMedia('(max-width: 959px)').matches && link.closest('.nav-links')) {
      nav?.removeAttribute('open')
    }

    if (link.dataset.track === 'subscribe_click') {
      track('subscribe_click', { href: link.href })
    }

    if (
      link.classList.contains('story-link') ||
      link.classList.contains('desk-link') ||
      (link.classList.contains('btn') && link.closest('.chapter-prose'))
    ) {
      track('note_click', { href: link.href })
    }

    if (!href.startsWith('#') || href === '#') return
    const target = document.querySelector(href)
    if (!target) return
    event.preventDefault()
    openChapter(target)
    if (location.hash !== href) history.pushState(null, '', href)
    scrollToEl(lenis, target, -72)
  })

  const fine = window.matchMedia('(pointer: fine)')

  document.querySelectorAll<HTMLElement>('.story, .wide, .earn').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      if (!fine.matches) return
      const rect = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${event.clientX - rect.left}px`)
      card.style.setProperty('--my', `${event.clientY - rect.top}px`)
    })
  })

  const playClip = (node: HTMLElement) => {
    const id = node.dataset.video || ''
    if (!id || !shell) return
    const title = node.dataset.title || 'Coverage'
    const chip = document.querySelector<HTMLElement>('#lead-duration')
    if (chip) chip.hidden = true
    shell.dataset.film = title
    const frame = shell.querySelector('iframe')
    if (frame) {
      frame.title = title
      frame.dataset.video = id
      frame.dataset.title = title
      frame.dataset.film = title
    }
    const heading = document.querySelector('#billboard-title')
    if (heading) heading.textContent = title
    const sourceEl = document.querySelector('#lead-source')
    const dateEl = document.querySelector('#lead-date')
    if (sourceEl) sourceEl.textContent = node.dataset.source || ''
    if (dateEl instanceof HTMLTimeElement) {
      dateEl.textContent = node.dataset.date || ''
      dateEl.dateTime = node.dataset.datetime || ''
      dateEl.hidden = !node.dataset.date
    }
    const href = `https://youtu.be/${id}`
    const out = document.querySelector<HTMLAnchorElement>('#lead-out')
    if (out) out.href = href
    if (leadPlay) leadPlay.href = href
    const play = shell.querySelector<HTMLAnchorElement>('.film-play')
    if (play) play.href = href
    cueWatch(id, true)
    const top = document.querySelector('#top')
    if (top) scrollToEl(lenis, top, -72)
  }

  document.querySelector('#story-grid')?.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest('button.card-play')
    if (!(button instanceof HTMLButtonElement)) return
    playClip(button)
  })

  leadPlay?.addEventListener('click', (event) => {
    event.preventDefault()
    shell?.querySelector<HTMLElement>('.film-play')?.click()
  })

  const leadLabel = leadPlay?.querySelector<HTMLElement>('.lead-label')
  if (shell && leadPlay && leadLabel) {
    const syncLead = () => {
      const playing = shell.classList.contains('is-playing')
      leadPlay.classList.toggle('is-playing', playing)
      leadLabel.textContent = playing ? 'Pause' : 'Watch now'
    }
    new MutationObserver(syncLead).observe(shell, { attributes: true, attributeFilter: ['class'] })
  }

  const durationEl = shell?.querySelector<HTMLElement>('.film-duration')
  const chip = document.querySelector<HTMLElement>('#lead-duration')
  if (durationEl && chip) {
    const syncDuration = () => {
      const value = (durationEl.textContent || '').trim()
      const known = value.length > 0 && value !== '0:00'
      chip.hidden = !known
      chip.textContent = known ? value : ''
    }
    syncDuration()
    new MutationObserver(syncDuration).observe(durationEl, {
      childList: true,
      characterData: true,
      subtree: true,
    })
  }

  searchToggle?.addEventListener('click', () => {
    const open = navBar?.classList.contains('is-searching') ?? false
    if (open && search?.value.trim()) {
      search.focus()
      return
    }
    const next = navBar?.classList.toggle('is-searching') ?? false
    searchToggle.setAttribute('aria-expanded', String(next))
    if (next) search?.focus()
  })

  const closeSearch = () => {
    if (search?.value.trim()) return
    navBar?.classList.remove('is-searching')
    searchToggle?.setAttribute('aria-expanded', 'false')
  }

  document.addEventListener('click', (event) => {
    if (!navBar?.classList.contains('is-searching')) return
    if (event.target instanceof Node && navBar.contains(event.target)) return
    closeSearch()
  })

  search?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (search.value) {
      search.value = ''
      hadQuery = false
      apply()
    }
    navBar?.classList.remove('is-searching')
    searchToggle?.setAttribute('aria-expanded', 'false')
    if (searchToggle && getComputedStyle(searchToggle).display !== 'none') searchToggle.focus()
  })

  const player = document.querySelector<HTMLIFrameElement>('#player')
  const watchTitle = document.querySelector('#watch-title')
  const watchDate = document.querySelector('#watch-date')
  const watchSource = document.querySelector('#watch-source')
  const watchOut = document.querySelector<HTMLAnchorElement>('#watch-out')
  const rail = document.querySelector('.rail')

  const readVideo = (node: HTMLElement) => ({
    id: node.dataset.video || '',
    title: node.dataset.title || '',
    date: node.dataset.date || '',
    datetime: node.dataset.datetime || '',
    source: node.dataset.source || '',
    search: node.dataset.search || '',
  })

  const writeLink = (link: HTMLAnchorElement, video: ReturnType<typeof readVideo>) => {
    const item = link.closest('li')
    if (item instanceof HTMLElement) item.dataset.search = video.search
    link.dataset.video = video.id
    link.dataset.title = video.title
    link.dataset.date = video.date
    link.dataset.datetime = video.datetime
    link.dataset.source = video.source
    link.dataset.search = video.search
    link.href = `https://youtu.be/${video.id}`
    const strong = link.querySelector('strong')
    const time = link.querySelector('time')
    const img = link.querySelector('img')
    if (strong) strong.textContent = video.title
    if (time instanceof HTMLTimeElement) {
      time.textContent = video.date
      time.dateTime = video.datetime
    }
    if (img) img.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`
  }

  rail?.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest('a.upnext')
    const shell = document.querySelector<HTMLElement>('#watch .player')
    const frame = shell?.querySelector<HTMLIFrameElement>('iframe') ?? player
    if (!(link instanceof HTMLAnchorElement) || !frame) return
    event.preventDefault()
    event.stopPropagation()
    const next = readVideo(link)
    const prev = readVideo(frame)
    if (!next.id || next.id === prev.id) return
    if (shell) shell.dataset.film = next.title
    frame.title = next.title
    frame.dataset.video = next.id
    frame.dataset.title = next.title
    frame.dataset.date = next.date
    frame.dataset.datetime = next.datetime
    frame.dataset.source = next.source
    frame.dataset.search = next.search
    cueWatch(next.id, true)
    if (watchTitle) watchTitle.textContent = next.title
    if (watchDate instanceof HTMLTimeElement) {
      watchDate.textContent = next.date
      watchDate.dateTime = next.datetime
    }
    if (watchSource) watchSource.textContent = next.source
    if (watchOut) watchOut.href = `https://youtu.be/${next.id}`
    writeLink(link, prev)
    apply()
    const rect = (shell ?? frame).getBoundingClientRect()
    if (rect.top < 72 || rect.bottom > window.innerHeight) {
      scrollToEl(lenis, shell ?? frame, -88)
    }
  })

  if (location.hash.length > 1) {
    const id = location.hash.slice(1)
    const target = document.getElementById(id)
    if (target?.classList.contains('chapter')) {
      target.classList.add('is-open')
      const index = cards().findIndex((card) => card.querySelector('a')?.getAttribute('href') === `#${id}`)
      if (index >= limit) limit = index + 1
    }
  }

  apply()

  if (location.hash.length > 1) {
    const target = document.querySelector(location.hash)
    if (target) scrollToEl(lenis, target, -72, true)
  }

  return {
    destroy() {
      /* listeners live with the page */
    },
  }
}

function initAlerts(lenis: Lenis | null) {
  const dialog = document.querySelector<HTMLDialogElement>('#alerts')
  if (!dialog) return
  let returnFocus: HTMLElement | null = null

  const stopScroll = (open: boolean) => {
    document.documentElement.classList.toggle('alerts-open', open)
    if (open) lenis?.stop()
    else lenis?.start()
  }

  const close = () => {
    if (dialog.open) dialog.close()
  }

  document.querySelectorAll<HTMLButtonElement>('[data-open-alerts]').forEach((button) => {
    button.addEventListener('click', () => {
      if (dialog.open) return
      returnFocus = button
      dialog.showModal()
      stopScroll(true)
      dialog.querySelector<HTMLElement>('.btn')?.focus()
    })
  })

  dialog.addEventListener('close', () => {
    stopScroll(false)
    returnFocus?.focus()
  })
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close()
  })
  dialog.querySelector('[data-close-alerts]')?.addEventListener('click', close)
  dialog.querySelector('.btn')?.addEventListener('click', close)
}
