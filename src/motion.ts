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

  const ctx = gsap.context(() => {
    document.querySelectorAll<HTMLElement>('[data-split]').forEach(splitHeading)

    lenis = new Lenis({
      autoRaf: false,
      lerp: 0.085,
      anchors: false,
      smoothWheel: true,
      prevent: (node) => Boolean(node.closest('.reader, .nav-details[open] + .nav-links')),
    })
    lenis.on('scroll', ScrollTrigger.update)
    ticker = (time: number) => {
      lenis?.raf(time * 1000)
    }
    gsap.ticker.add(ticker)
    gsap.ticker.lagSmoothing(0)

    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
    intro
      .from('.nav', { y: -12, duration: 0.6 }, 0)
      .from('.hero [data-split="intro"] .word-inner', {
        yPercent: 110,
        duration: 0.8,
        stagger: 0.028,
      }, 0.05)
      .from('.hero-aside, .trace', { y: 16, duration: 0.7 }, 0.2)
      .fromTo(
        '.hero-plate img',
        { clipPath: 'inset(8% 5% 10% 5%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.25, ease: 'power3.inOut' },
        0.15,
      )
      .from('.rule', { scaleX: 0, duration: 0.9 }, 0.2)

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

    const track = document.querySelector<HTMLElement>('[data-tape]')
    const pin = document.querySelector<HTMLElement>('.tape-pin')
    const desktop = window.matchMedia('(min-width: 960px)')
    let tapeTween: gsap.core.Tween | null = null

    const mountTape = () => {
      tapeTween?.scrollTrigger?.kill()
      tapeTween?.kill()
      tapeTween = null
      document.querySelector('.tape')?.classList.remove('is-motion')
      if (!track || !pin || !desktop.matches) return
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 64)
      if (distance() < 48) return
      document.querySelector('.tape')?.classList.add('is-motion')
      tapeTween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.tape',
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: pin,
          scrub: 0.7,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      })
    }

    mountTape()
    desktop.addEventListener('change', mountTape)

    const refresh = () => ScrollTrigger.refresh()
    document.fonts?.ready.then(refresh).catch(() => undefined)
    document.querySelectorAll('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', refresh, { once: true })
    })
  })

  return {
    lenis,
    destroy() {
      if (ticker) gsap.ticker.remove(ticker)
      lenis?.destroy()
      ctx.revert()
      document.querySelectorAll('.is-split').forEach((el) => el.classList.remove('is-split'))
    },
  }
}
