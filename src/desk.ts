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
    if (empty) empty.hidden = gridShown !== 0
    if (result) {
      result.textContent = gridShown === 1 ? '1 note in this index' : `${gridShown} notes in this index`
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
  const plate = document.querySelector<HTMLElement>('.hero-plate')
  const coord = document.querySelector<HTMLElement>('[data-coord]')
  if (fine.matches && plate && coord) {
    plate.addEventListener('pointermove', (event) => {
      const rect = plate.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height
      coord.textContent = `Frame ${x.toFixed(2)} / ${y.toFixed(2)}`
      window.dispatchEvent(new CustomEvent('desk-pointer', { detail: x }))
    })
  }

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
        setStatus('Saved in this browser. Confirm the alert on the investor desk.', 'ok')
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
      setStatus('Enter an email address the desk can read.', 'error')
      email.focus()
      return
    }
    email.removeAttribute('aria-invalid')
    const button = form.querySelector('button')
    const label = form.querySelector('.btn-label')
    if (button) button.disabled = true
    if (label) label.textContent = 'Filing'
    form.setAttribute('aria-busy', 'true')
    window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, value)
        setStatus('Saved in this browser only. Investor relations sends the alert. Continue there to confirm.', 'ok')
      } catch {
        setStatus('This browser could not store the address. Use the investor desk link.', 'error')
      }
      if (button) button.disabled = false
      if (label) label.textContent = 'File for alerts'
      form.removeAttribute('aria-busy')
    }, 500)
  })

  syncReader()
  apply()

  return {
    destroy() {
      shells.forEach((shell) => shell?.removeAttribute('inert'))
    },
  }
}
