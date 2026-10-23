export type TrackName = 'play_30s' | 'note_click' | 'subscribe_click'

export function track(name: TrackName, detail: Record<string, string> = {}) {
  const payload = { event: name, at: new Date().toISOString(), ...detail }
  window.dispatchEvent(new CustomEvent('dvlt:track', { detail: payload }))
  const g = window as Window & { dataLayer?: Array<Record<string, string>> }
  g.dataLayer?.push(payload)
}
