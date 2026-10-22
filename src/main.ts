import 'lenis/dist/lenis.css'
import { initDesk } from './desk'
import { initMotion } from './motion'
import type { initTrace } from './trace'

type Trace = ReturnType<typeof initTrace>

let motion: ReturnType<typeof initMotion> | null = null
let desk: ReturnType<typeof initDesk> | null = null
let trace: Trace = null

try {
  motion = initMotion()
  desk = initDesk(motion.lenis)
  if (!document.documentElement.classList.contains('reduce')) {
    void import('./trace').then(({ initTrace: startTrace }) => {
      trace = startTrace(document.querySelector<HTMLElement>('[data-trace]'))
    })
  }
} catch {
  document.querySelectorAll('.is-split').forEach((el) => el.classList.remove('is-split'))
}

window.addEventListener('pagehide', () => {
  motion?.destroy()
  trace?.destroy()
  desk?.destroy()
})
