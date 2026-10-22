import 'lenis/dist/lenis.css'
import { initDesk } from './desk'
import { initMotion } from './motion'

let motion: ReturnType<typeof initMotion> | null = null
let desk: ReturnType<typeof initDesk> | null = null

try {
  motion = initMotion()
  desk = initDesk(motion.lenis)
} catch {
  document.querySelectorAll('.is-split').forEach((el) => el.classList.remove('is-split'))
}

window.addEventListener('pagehide', () => {
  motion?.destroy()
  desk?.destroy()
})
