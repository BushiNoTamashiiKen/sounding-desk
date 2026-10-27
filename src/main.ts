import 'lenis/dist/lenis.css'
import { initDesk } from './desk'
import { initFilms } from './film'
import { initMotion } from './motion'
import { initNews } from './news'
import { initQuote } from './quote'

let motion: ReturnType<typeof initMotion> | null = null
let desk: ReturnType<typeof initDesk> | null = null
let films: ReturnType<typeof initFilms> | null = null
let news: ReturnType<typeof initNews> | null = null
let quote: ReturnType<typeof initQuote> | null = null

try {
  motion = initMotion()
  films = initFilms()
  desk = initDesk(motion.lenis)
  news = initNews()
  quote = initQuote()
} catch {
  document.querySelectorAll('.is-split').forEach((el) => el.classList.remove('is-split'))
}

window.addEventListener('pagehide', () => {
  motion?.destroy()
  films?.destroy()
  desk?.destroy()
  news?.destroy()
  quote?.destroy()
})
