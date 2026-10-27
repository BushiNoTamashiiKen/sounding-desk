import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

export type Motion = {
  lenis: Lenis | null
  destroy: () => void
}

function splitHeading(heading: HTMLElement) {
  const plain = heading.querySelector<HTMLElement>('.title-plain')
  const split = heading.querySelector<HTMLElement>('.title-split')
  if (!plain || !split) return
  split.replaceChildren()

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return
        if (!part.trim()) {
          split.append(document.createTextNode(part))
          return
        }
        const word = document.createElement('span')
        word.className = 'word'
        const inner = document.createElement('span')
        inner.className = 'word-inner'
        if (node.parentElement?.tagName === 'EM') inner.classList.add('is-em')
        inner.textContent = part
        word.append(inner)
        split.append(word)
      })
      return
    }
    node.childNodes.forEach(walk)
  }

  plain.childNodes.forEach(walk)
  heading.classList.add('is-split')
}

export function initMotion(): Motion {
  const reduce = document.documentElement.classList.contains('reduce')
  if (reduce) return { lenis: null, destroy: () => undefined }

  let lenis: Lenis | null = null
  let ticker: ((time: number) => void) | null = null
  const cleanups: Array<() => void> = []

  const ctx = gsap.context(() => {
    document.querySelectorAll<HTMLElement>('[data-split]').forEach(splitHeading)

    lenis = new Lenis({
      autoRaf: false,
      lerp: 0.085,
      anchors: false,
      smoothWheel: true,
      prevent: (node) => Boolean(node.closest('.watch-rail, .nav-details[open] + .nav-links')),
    })
    lenis.on('scroll', ScrollTrigger.update)
    ticker = (time: number) => {
      lenis?.raf(time * 1000)
    }
    gsap.ticker.add(ticker)
    gsap.ticker.lagSmoothing(0)

    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
    intro
      .from('.nav', { y: -12, autoAlpha: 0, duration: 0.6 }, 0)
      .from('.billboard h1', { y: 16, autoAlpha: 0, duration: 0.7 }, 0.08)
      .from('.billboard-sub', { y: 10, autoAlpha: 0, duration: 0.55 }, 0.22)
      .from('.lead-actions', { y: 10, autoAlpha: 0, duration: 0.5 }, 0.32)
      .from('.billboard-player', { clipPath: 'inset(8% 6% 8% 6%)', duration: 1.05 }, 0.12)

    const billboard = document.querySelector<HTMLElement>('.billboard')
    const film = document.querySelector<HTMLElement>('.billboard-player')
    const copy = document.querySelector<HTMLElement>('.billboard-copy')
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (billboard && film && copy && fine.matches) {
      const xTo = gsap.quickTo(copy, 'x', { duration: 0.7, ease: 'power3.out' })
      const yTo = gsap.quickTo(copy, 'y', { duration: 0.7, ease: 'power3.out' })
      const onMove = (event: PointerEvent) => {
        const frame = film.getBoundingClientRect()
        const px = frame.width ? ((event.clientX - frame.left) / frame.width) * 100 : 70
        const py = frame.height ? ((event.clientY - frame.top) / frame.height) * 100 : 20
        film.style.setProperty('--mx', `${px}%`)
        film.style.setProperty('--my', `${py}%`)
        film.classList.add('is-hot')
        const stage = billboard.getBoundingClientRect()
        const dx = stage.width ? (event.clientX - stage.left) / stage.width - 0.5 : 0
        const dy = stage.height ? (event.clientY - stage.top) / stage.height - 0.5 : 0
        xTo(dx * 14)
        yTo(dy * 8)
      }
      const reset = () => {
        film.classList.remove('is-hot')
        xTo(0)
        yTo(0)
      }
      billboard.addEventListener('pointermove', onMove)
      billboard.addEventListener('pointerleave', reset)
      const onHide = () => {
        if (document.hidden) reset()
      }
      window.addEventListener('blur', reset)
      document.addEventListener('visibilitychange', onHide)
      cleanups.push(() => {
        billboard.removeEventListener('pointermove', onMove)
        billboard.removeEventListener('pointerleave', reset)
        window.removeEventListener('blur', reset)
        document.removeEventListener('visibilitychange', onHide)
      })
    }

    document.querySelectorAll<HTMLElement>('[data-split="scroll"]').forEach((heading) => {
      const words = heading.querySelectorAll('.word-inner')
      if (!words.length) return
      gsap.from(words, {
        yPercent: 110,
        duration: 0.75,
        stagger: 0.035,
        ease: 'power3.out',
        scrollTrigger: { trigger: heading, start: 'top 84%', once: true },
      })
    })

    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        y: 18,
        autoAlpha: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      })
    })

    const refresh = () => ScrollTrigger.refresh()
    document.fonts?.ready.then(refresh).catch(() => undefined)
    document.querySelectorAll('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', refresh, { once: true })
    })
  })

  return {
    lenis,
    destroy() {
      cleanups.forEach((fn) => fn())
      if (ticker) gsap.ticker.remove(ticker)
      lenis?.destroy()
      ctx.revert()
      document.querySelectorAll('.is-split').forEach((el) => el.classList.remove('is-split'))
    },
  }
}
