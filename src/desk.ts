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
  const notes = document.querySelector<HTMLElement>('#notes')
  const nav = document.querySelector<HTMLDetailsElement>('.nav-details')
  let topic = 'all'

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

  const apply = () => {
    const query = search?.value.trim().toLowerCase() ?? ''
    let shown = 0
    entries.forEach((entry) => {
      const topicOk = topic === 'all' || entry.dataset.topic === topic
      const hay = (entry.dataset.search || entry.textContent || '').toLowerCase()
      const textOk = !query || hay.includes(query)
      const visible = topicOk && textOk
      entry.hidden = !visible
      if (visible && (entry.closest('#story-grid') || entry.closest('.desk-list'))) shown += 1
    })
    if (empty) {
      empty.hidden = shown !== 0
    }
    if (result) {
      result.hidden = shown === 0
      result.textContent = shown === 1 ? '1 story' : `${shown} stories`
    }
    const railAside = document.querySelector<HTMLElement>('.watch-rail')
    if (railAside) {
      railAside.hidden = railAside.querySelectorAll('.rail > li:not([hidden])').length === 0
    }
    grid?.classList.toggle('is-filtered', topic !== 'all' || query.length > 0)
    if (notes) notes.hidden = notes.querySelectorAll('.chapter:not([hidden])').length === 0
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      topic = button.dataset.filter || 'all'
      filters.forEach((item) => item.setAttribute('aria-pressed', String(item === button)))
      apply()
    })
  })

  search?.addEventListener('input', apply)

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
    if (!(link instanceof HTMLAnchorElement) || !player) return
    event.preventDefault()
    event.stopPropagation()
    const next = readVideo(link)
    const prev = readVideo(player)
    if (!next.id || next.id === prev.id) return
    player.title = next.title
    player.dataset.video = next.id
    player.dataset.title = next.title
    player.dataset.date = next.date
    player.dataset.datetime = next.datetime
    player.dataset.source = next.source
    player.dataset.search = next.search
    cueWatch(next.id)
    if (watchTitle) watchTitle.textContent = next.title
    if (watchDate instanceof HTMLTimeElement) {
      watchDate.textContent = next.date
      watchDate.dateTime = next.datetime
    }
    if (watchSource) watchSource.textContent = next.source
    if (watchOut) watchOut.href = `https://youtu.be/${next.id}`
    writeLink(link, prev)
    apply()
    const rect = player.getBoundingClientRect()
    if (rect.top < 72 || rect.bottom > window.innerHeight) {
      scrollToEl(lenis, player, -88)
    }
  })

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
