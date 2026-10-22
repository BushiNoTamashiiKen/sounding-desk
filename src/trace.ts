import * as THREE from 'three'

const vertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragment = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uPointer;

void main() {
  float x = vUv.x;
  float y = 0.58 + sin(x * 8.5 + uTime * 0.35) * 0.08;
  y += sin(x * 17.0 - uTime * 0.22 + uPointer * 1.6) * 0.03;
  float d = abs(vUv.y - y);
  float core = smoothstep(0.012, 0.0, d);
  float glow = smoothstep(0.06, 0.0, d) * 0.4;
  float axis = smoothstep(0.003, 0.0, abs(vUv.y - 0.78)) * 0.35;
  float alpha = max(core, max(glow, axis));
  vec3 dim = vec3(0.45, 0.62, 0.56);
  vec3 mint = vec3(0.62, 0.86, 0.76);
  vec3 col = mix(dim, mint, core);
  gl_FragColor = vec4(col, alpha);
}
`

type TraceHandle = { destroy: () => void }

export function initTrace(root: HTMLElement | null): TraceHandle | null {
  if (!root) return null
  const reduce = document.documentElement.classList.contains('reduce')
  if (reduce) return null

  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null
  try {
    const probe = document.createElement('canvas')
    gl = probe.getContext('webgl2') || probe.getContext('webgl')
  } catch {
    gl = null
  }
  if (!gl) return null

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' })
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  canvas.setAttribute('aria-hidden', 'true')
  root.append(canvas)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const geometry = new THREE.PlaneGeometry(2, 2)
  const uniforms = {
    uTime: { value: 0 },
    uPointer: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms,
    transparent: true,
    depthWrite: false,
  })
  scene.add(new THREE.Mesh(geometry, material))

  const started = performance.now()
  let pointer = 0
  let target = 0
  let running = true
  let frame = 0
  let visible = true

  const resize = () => {
    const width = canvas.clientWidth || root.clientWidth || 1
    const height = canvas.clientHeight || 120
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
  }

  const paint = () => {
    if (!running || !visible || document.hidden) {
      frame = 0
      return
    }
    uniforms.uTime.value = (performance.now() - started) / 1000
    pointer += (target - pointer) * 0.08
    uniforms.uPointer.value = pointer
    renderer.render(scene, camera)
    frame = requestAnimationFrame(paint)
  }

  const start = () => {
    if (!running || frame) return
    frame = requestAnimationFrame(paint)
  }

  const stopLoop = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  resize()
  root.classList.add('is-live')
  start()

  const onPointer = (event: Event) => {
    const detail = (event as CustomEvent<number>).detail
    if (typeof detail === 'number') target = detail
  }

  const onVisibility = () => {
    visible = !document.hidden
    if (visible) start()
    else stopLoop()
  }

  const onBlur = () => {
    visible = false
    stopLoop()
  }

  const onFocus = () => {
    visible = true
    start()
  }

  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting) && !document.hidden
    if (visible) start()
    else stopLoop()
  })
  observer.observe(root)

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(root)

  const onLost = (event: Event) => {
    event.preventDefault()
    running = false
    stopLoop()
    root.classList.remove('is-live')
    canvas.remove()
  }

  canvas.addEventListener('webglcontextlost', onLost)
  window.addEventListener('desk-pointer', onPointer)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('blur', onBlur)
  window.addEventListener('focus', onFocus)

  return {
    destroy() {
      running = false
      stopLoop()
      observer.disconnect()
      resizeObserver.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      window.removeEventListener('desk-pointer', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
