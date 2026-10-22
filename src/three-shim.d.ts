declare module 'three' {
  export class Scene {
    add(object: Mesh): void
  }
  export class OrthographicCamera {
    constructor(left: number, right: number, top: number, bottom: number, near: number, far: number)
  }
  export class PlaneGeometry {
    constructor(width: number, height: number)
    dispose(): void
  }
  export class ShaderMaterial {
    constructor(params: {
      vertexShader: string
      fragmentShader: string
      uniforms: Record<string, { value: number }>
      transparent?: boolean
      depthWrite?: boolean
    })
    dispose(): void
  }
  export class Mesh {
    constructor(geometry: PlaneGeometry, material: ShaderMaterial)
  }
  export class Clock {
    getElapsedTime(): number
    start(): void
  }
  export class WebGLRenderer {
    domElement: HTMLCanvasElement
    constructor(params?: { alpha?: boolean; antialias?: boolean; powerPreference?: string })
    setClearColor(color: number, alpha: number): void
    setPixelRatio(value: number): void
    setSize(width: number, height: number, updateStyle?: boolean): void
    render(scene: Scene, camera: OrthographicCamera): void
    dispose(): void
    forceContextLoss(): void
  }
}
