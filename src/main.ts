import 'lenis/dist/lenis.css'
import { initDesk } from './desk'
import { initFilms } from './film'
import { initMotion } from './motion'

let motion: ReturnType<typeof initMotion> | null = null
let desk: ReturnType<typeof initDesk> | null = null
let films: ReturnType<typeof initFilms> | null = null

try {
  motion = initMotion()
  films = initFilms()
  desk = initDesk(motion.lenis)
} catch {
  document.querySelectorAll('.is-split').forEach((el) => el.classList.remove('is-split'))
}

window.addEventListener('pagehide', () => {
  motion?.destroy()
  films?.destroy()
  desk?.destroy()
})
