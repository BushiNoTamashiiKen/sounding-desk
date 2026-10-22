import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

const STORAGE_KEY = 'dvlt-media-alert'

export function initDesk(lenis: Lenis | null) {
  const entries = Array.from(document.querySelectorAll<HTMLElement>('[data-entry]'))
  const filters = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-filter]'))
  const search = document.querySelector<HTMLInputElement>('#search')
  const empty = document.querySelector<HTMLElement>('#empty')
  const result = document.querySelector<HTMLElement>('#result')
  const grid = document.querySelector<HTMLElement>('#story-grid')
  const readers = Array.from(document.querySelectorAll<HTMLElement>('.reader'))
  const shells = [document.querySelector('header'), document.querySelector('main'), document.querySelector('footer')]
  const form = document.querySelector<HTMLFormElement>('#alert-form')
  const status = document.querySelector<HTMLElement>('#alert-status')
  const email = document.querySelector<HTMLInputElement>('#email')
  const nav = document.querySelector<HTMLDetailsElement>('.nav-details')
  let topic = 'all'
  let lastTrigger: HTMLElement | null = null

  const apply = () => {
    const query = search?.value.trim().toLowerCase() ?? ''
    let gridShown = 0
    entries.forEach((entry) => {
      const topicOk = topic === 'all' || entry.dataset.topic === topic
      const hay = (entry.dataset.search || entry.textContent || '').toLowerCase()
      const textOk = !query || hay.includes(query)
      const visible = topicOk && textOk
      entry.hidden = !visible
      if (visible && entry.closest('#story-grid')) gridShown += 1
    })
    if (empty) {
      empty.hidden = gridShown !== 0
      const label = empty.querySelector('strong')
      if (label) {
        label.textContent = topic === 'video' && !query
          ? 'Video is in the player above.'
          : 'No stories match that.'
      }
    }
    if (result) {
      result.textContent = gridShown === 1 ? '1 story' : `${gridShown} stories`
    }
    const railAside = document.querySelector<HTMLElement>('.watch-rail')
    if (railAside) {
      railAside.hidden = railAside.querySelectorAll('.rail > li:not([hidden])').length === 0
    }
    grid?.classList.toggle('is-filtered', topic !== 'all' || query.length > 0)
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

  const syncReader = () => {
    const open = document.querySelector<HTMLElement>('.reader:target')
    document.body.classList.toggle('is-reading', Boolean(open))
    readers.forEach((reader) => {
      if (reader === open) reader.removeAttribute('inert')
      else reader.setAttribute('inert', '')
    })
    shells.forEach((shell) => {
      if (!shell) return
      if (open) shell.setAttribute('inert', '')
      else shell.removeAttribute('inert')
    })
    if (open) {
      lenis?.stop()
      open.focus()
      const title = open.querySelector('h2')?.textContent?.trim()
      if (title) document.title = `${title} · Datavault AI`
    } else {
      lenis?.start()
      document.title = 'Media & Insights · Datavault AI'
      lastTrigger?.focus()
      lastTrigger = null
    }
  }

  document.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest('a')
    if (!(link instanceof HTMLAnchorElement)) return
    const href = link.getAttribute('href') || ''
    if (href.startsWith('#note-')) lastTrigger = link

    if (window.matchMedia('(max-width: 959px)').matches && link.closest('.nav-links')) {
      nav?.removeAttribute('open')
    }

    if (!href.startsWith('#') || href === '#') return
    const target = document.querySelector(href)
    if (!target || target.classList.contains('reader') || !lenis) return
    event.preventDefault()
    if (location.hash !== href) history.pushState(null, '', href)
    lenis.scrollTo(target, { offset: -72 })
    syncReader()
  })

  window.addEventListener('hashchange', syncReader)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.querySelector('.reader:target')) {
      location.hash = 'index'
    }
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

  const setStatus = (message: string, kind: 'ok' | 'error' | '') => {
    if (!status) return
    status.textContent = message
    status.classList.toggle('is-ok', kind === 'ok')
    status.classList.toggle('is-error', kind === 'error')
  }

  if (email) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        email.value = saved
        setStatus('Saved in this browser. Confirm the alert with investor relations.', 'ok')
      }
    } catch {
      /* storage unavailable */
    }
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!email) return
    const value = email.value.trim()
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    if (!valid) {
      email.setAttribute('aria-invalid', 'true')
      setStatus('Enter an email address.', 'error')
      email.focus()
      return
    }
    email.removeAttribute('aria-invalid')
    const button = form.querySelector('button')
    const label = form.querySelector('.btn-label')
    if (button) button.disabled = true
    if (label) label.textContent = 'Saving'
    form.setAttribute('aria-busy', 'true')
    window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, value)
        setStatus('Saved in this browser only. Investor relations sends the alert. Continue there to confirm.', 'ok')
      } catch {
        setStatus('This browser could not store the address. Use the investor relations link.', 'error')
      }
      if (button) button.disabled = false
      if (label) label.textContent = 'Get alerts'
      form.removeAttribute('aria-busy')
    }, 500)
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
    player.src = `https://www.youtube-nocookie.com/embed/${next.id}?rel=0`
    player.title = next.title
    player.dataset.video = next.id
    player.dataset.title = next.title
    player.dataset.date = next.date
    player.dataset.datetime = next.datetime
    player.dataset.source = next.source
    player.dataset.search = next.search
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
      if (lenis) lenis.scrollTo(player, { offset: -88 })
      else player.scrollIntoView({ block: 'start' })
    }
  })

  syncReader()
  apply()

  return {
    destroy() {
      shells.forEach((shell) => shell?.removeAttribute('inert'))
    },
  }
}
