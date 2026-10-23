import { track as report } from './track'

type YTPlayer = {
  playVideo: () => void
  pauseVideo: () => void
  mute: () => void
  unMute: () => void
  isMuted: () => boolean
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  cueVideoById: (videoId: string) => void
  destroy: () => void
}

type YTApi = {
  Player: new (
    el: HTMLElement,
    options: {
      events?: {
        onReady?: (event: { target: YTPlayer }) => void
        onStateChange?: (event: { data: number; target: YTPlayer }) => void
      }
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTApi
    onYouTubeIframeAPIReady?: () => void
  }
}

const PLAYING = 1
const BUFFERING = 3

let apiPromise: Promise<void> | null = null
let apiFailed = false
let watchFilm: Film | null = null

function loadApi() {
  if (window.YT?.Player) return Promise.resolve()
  if (apiFailed) return Promise.reject(new Error('youtube'))
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady
      const timeout = window.setTimeout(() => {
        apiFailed = true
        reject(new Error('youtube'))
      }, 8000)
      window.onYouTubeIframeAPIReady = () => {
        window.clearTimeout(timeout)
        previous?.()
        resolve()
      }
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.onerror = () => {
        window.clearTimeout(timeout)
        apiFailed = true
        reject(new Error('youtube'))
      }
      document.head.appendChild(script)
    })
  }
  return apiPromise
}

function fmt(value: number) {
  const total = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (part: number) => String(part).padStart(2, '0')
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${minutes}:${pad(seconds)}`
}

function armSrc(iframe: HTMLIFrameElement) {
  const url = new URL(iframe.src)
  url.searchParams.set('rel', '0')
  url.searchParams.set('playsinline', '1')
  url.searchParams.set('controls', '0')
  url.searchParams.set('enablejsapi', '1')
  url.searchParams.set('modestbranding', '1')
  url.searchParams.set('iv_load_policy', '3')
  url.searchParams.set('fs', '0')
  url.searchParams.set('disablekb', '1')
  url.searchParams.set('origin', location.origin)
  const next = url.toString()
  if (iframe.src === next) return Promise.resolve()
  return new Promise<void>((resolve) => {
    iframe.addEventListener('load', () => resolve(), { once: true })
    iframe.src = next
  })
}

class Film {
  private yt: YTPlayer | null = null
  private queued: string | null = null
  private wantsPlay = false
  private play30 = false
  private raf = 0
  private readonly cleanups: Array<() => void> = []
  cue: (id: string) => void = () => undefined

  constructor(root: HTMLElement) {
    const iframe = root.querySelector('iframe')
    const play = root.querySelector<HTMLAnchorElement>('a.film-play')
    if (!iframe || !play) return

    const bar = document.createElement('div')
    bar.className = 'film-bar'
    bar.innerHTML = `
      <div class="film-meta">
        <span class="film-time"><span class="film-elapsed">0:00</span> / <span class="film-duration">0:00</span></span>
        <button type="button" class="film-icon" data-act="mute" aria-pressed="false" aria-label="Mute">
          <svg class="icon on" aria-hidden="true"><use href="#i-vol" /></svg>
          <svg class="icon off" aria-hidden="true"><use href="#i-mute" /></svg>
        </button>
        <button type="button" class="film-icon" data-act="full" aria-label="Full screen">
          <svg class="icon on" aria-hidden="true"><use href="#i-full" /></svg>
          <svg class="icon off" aria-hidden="true"><use href="#i-unfull" /></svg>
        </button>
      </div>
      <div class="film-track" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-valuetext="0:00"></div>
    `
    root.append(bar)

    const elapsed = bar.querySelector<HTMLElement>('.film-elapsed')
    const durationEl = bar.querySelector<HTMLElement>('.film-duration')
    const track = bar.querySelector<HTMLElement>('.film-track')
    const mute = bar.querySelector<HTMLButtonElement>('[data-act="mute"]')
    const full = bar.querySelector<HTMLButtonElement>('[data-act="full"]')
    if (!elapsed || !durationEl || !track || !mute || !full) return

    const label = play.querySelector('.film-play-label')
    const canFull =
      typeof root.requestFullscreen === 'function' ||
      'webkitRequestFullscreen' in root
    if (!canFull) full.hidden = true

    const name = () => iframe.dataset.title || 'video'

    const syncLabel = () => {
      const playing = root.classList.contains('is-playing')
      const text = playing ? 'Pause' : 'Play'
      if (label) label.textContent = text
      play.setAttribute('aria-label', `${text} ${name()}`)
    }

    const paint = () => {
      if (!this.yt) return
      let current = 0
      let duration = 0
      try {
        current = this.yt.getCurrentTime() || 0
        duration = this.yt.getDuration() || 0
      } catch {
        return
      }
      const ratio = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0
      root.style.setProperty('--p', ratio.toFixed(4))
      elapsed.textContent = fmt(current)
      durationEl.textContent = fmt(duration)
      track.setAttribute('aria-valuemax', String(Math.round(duration)))
      track.setAttribute('aria-valuenow', String(Math.round(current)))
      track.setAttribute('aria-valuetext', duration ? `${fmt(current)} of ${fmt(duration)}` : '0:00')
      if (!this.play30 && iframe.id === 'billboard' && current >= 30) {
        this.play30 = true
        report('play_30s', { video: 'vNUaPfunkEU' })
      }
    }

    const stop = () => {
      if (!this.raf) return
      cancelAnimationFrame(this.raf)
      this.raf = 0
    }

    const loop = () => {
      paint()
      this.raf = requestAnimationFrame(loop)
    }

    const start = () => {
      if (this.raf || document.hidden) return
      this.raf = requestAnimationFrame(loop)
    }

    const poster = root.querySelector<HTMLImageElement>('.film-poster')

    const onState = (state: number) => {
      const playing = state === PLAYING
      if (playing) root.classList.add('is-started')
      root.classList.toggle('is-playing', playing)
      root.setAttribute('aria-busy', state === BUFFERING ? 'true' : 'false')
      syncLabel()
      if (playing) start()
      else stop()
      paint()
    }

    const toggle = () => {
      if (!this.yt) {
        this.wantsPlay = true
        return
      }
      if (this.yt.getPlayerState() === PLAYING) this.yt.pauseVideo()
      else this.yt.playVideo()
    }

    const onPlay = (event: Event) => {
      if (apiFailed) return
      event.preventDefault()
      toggle()
    }

    const onPlayKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' || apiFailed) return
      event.preventDefault()
      toggle()
    }

    const seekToRatio = (ratio: number) => {
      if (!this.yt) return
      let duration = 0
      try {
        duration = this.yt.getDuration() || 0
      } catch {
        return
      }
      if (!duration) return
      const next = Math.min(1, Math.max(0, ratio)) * duration
      this.yt.seekTo(next, true)
      root.style.setProperty('--p', String(Math.min(1, Math.max(0, ratio))))
      elapsed.textContent = fmt(next)
      durationEl.textContent = fmt(duration)
      track.setAttribute('aria-valuemax', String(Math.round(duration)))
      track.setAttribute('aria-valuenow', String(Math.round(next)))
      track.setAttribute('aria-valuetext', `${fmt(next)} of ${fmt(duration)}`)
    }

    const ratioFrom = (event: PointerEvent) => {
      const rect = track.getBoundingClientRect()
      if (!rect.width) return 0
      return (event.clientX - rect.left) / rect.width
    }

    const onScrubDown = (event: PointerEvent) => {
      if (!this.yt) return
      root.classList.add('is-scrubbing')
      track.setPointerCapture(event.pointerId)
      seekToRatio(ratioFrom(event))
    }

    const onScrubMove = (event: PointerEvent) => {
      if (!root.classList.contains('is-scrubbing')) return
      seekToRatio(ratioFrom(event))
    }

    const onScrubEnd = () => {
      root.classList.remove('is-scrubbing')
    }

    const onTrackKey = (event: KeyboardEvent) => {
      if (!this.yt) return
      let duration = 0
      let current = 0
      try {
        duration = this.yt.getDuration() || 0
        current = this.yt.getCurrentTime() || 0
      } catch {
        return
      }
      if (!duration) return
      let next = current
      if (event.key === 'ArrowRight') next += 5
      else if (event.key === 'ArrowLeft') next -= 5
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = duration
      else return
      event.preventDefault()
      seekToRatio(next / duration)
    }

    const onMute = () => {
      if (!this.yt) return
      const muted = this.yt.isMuted()
      if (muted) this.yt.unMute()
      else this.yt.mute()
      mute.classList.toggle('is-muted', !muted)
      mute.setAttribute('aria-pressed', String(!muted))
      mute.setAttribute('aria-label', muted ? 'Mute' : 'Unmute')
    }

    const onFull = () => {
      const active = document.fullscreenElement === root
      full.classList.toggle('is-full', active)
      full.setAttribute('aria-label', active ? 'Exit full screen' : 'Full screen')
    }

    const enterFull = () => {
      if (document.fullscreenElement === root) {
        void document.exitFullscreen?.()
        return
      }
      const webkit = root as HTMLElement & { webkitRequestFullscreen?: () => void }
      if (root.requestFullscreen) void root.requestFullscreen()
      else webkit.webkitRequestFullscreen?.()
    }

    const onHide = () => {
      if (document.hidden) stop()
      else if (root.classList.contains('is-playing')) start()
    }

    play.setAttribute('role', 'button')
    syncLabel()
    play.addEventListener('click', onPlay)
    play.addEventListener('keydown', onPlayKey)
    track.addEventListener('pointerdown', onScrubDown)
    track.addEventListener('pointermove', onScrubMove)
    track.addEventListener('pointerup', onScrubEnd)
    track.addEventListener('pointercancel', onScrubEnd)
    track.addEventListener('keydown', onTrackKey)
    mute.addEventListener('click', onMute)
    full.addEventListener('click', enterFull)
    document.addEventListener('fullscreenchange', onFull)
    document.addEventListener('visibilitychange', onHide)

    this.cleanups.push(() => {
      play.removeEventListener('click', onPlay)
      play.removeEventListener('keydown', onPlayKey)
      track.removeEventListener('pointerdown', onScrubDown)
      track.removeEventListener('pointermove', onScrubMove)
      track.removeEventListener('pointerup', onScrubEnd)
      track.removeEventListener('pointercancel', onScrubEnd)
      track.removeEventListener('keydown', onTrackKey)
      mute.removeEventListener('click', onMute)
      full.removeEventListener('click', enterFull)
      document.removeEventListener('fullscreenchange', onFull)
      document.removeEventListener('visibilitychange', onHide)
    })

    void loadApi()
      .then(() => armSrc(iframe))
      .then(() => {
        if (!window.YT?.Player || apiFailed) return
        new window.YT.Player(iframe, {
          events: {
            onReady: (event) => {
              this.yt = event.target
              root.classList.add('is-armed')
              if (this.queued) {
                event.target.cueVideoById(this.queued)
                this.queued = null
              }
              if (this.wantsPlay) {
                event.target.playVideo()
                this.wantsPlay = false
              }
              syncLabel()
              paint()
            },
            onStateChange: (event) => onState(event.data),
          },
        })
      })
      .catch(() => {
        apiFailed = true
      })

    this.cue = (id: string) => {
      this.wantsPlay = false
      this.queued = id
      play.href = `https://youtu.be/${id}`
      root.classList.remove('is-playing', 'is-started')
      if (poster) poster.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
      root.style.setProperty('--p', '0')
      elapsed.textContent = '0:00'
      syncLabel()
      if (!this.yt) return
      this.yt.cueVideoById(id)
      this.queued = null
      stop()
    }
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.cleanups.forEach((fn) => fn())
    try {
      this.yt?.destroy()
    } catch {
      /* player already gone */
    }
    this.yt = null
  }
}

export function cueWatch(id: string) {
  watchFilm?.cue(id)
}

export function initFilms() {
  const billboard = document.querySelector<HTMLElement>('.billboard-player')
  const watch = document.querySelector<HTMLElement>('.watch-layout > .player')
  const films = [billboard, watch].filter((node): node is HTMLElement => Boolean(node)).map((node) => new Film(node))
  watchFilm = watch ? films[billboard ? 1 : 0] ?? null : null
  return {
    destroy() {
      films.forEach((film) => film.destroy())
      watchFilm = null
    },
  }
}
