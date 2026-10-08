import * as ort from 'onnxruntime-web'
import wasmGlue from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url'
import wasmBinary from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url'
import { decode, nms, NMS_THRESHOLD, toTensor, type Detection } from './centerface.ts'
import { defaultTiling, planPasses, type TilingOptions } from './tiling.ts'

export type Backend = 'webgpu' | 'wasm'

const MODEL_URL = `${import.meta.env.BASE_URL}models/centerface.onnx`

export class Detector {
  // Keyed by pass size; only the passes of the latest image size are kept.
  private canvases = new Map<string, OffscreenCanvasRenderingContext2D>()
  private imageSize = ''

  private constructor(
    private session: ort.InferenceSession,
    readonly backend: Backend,
  ) {}

  static async create(): Promise<Detector> {
    ort.env.wasm.wasmPaths = { mjs: new URL(wasmGlue, location.href), wasm: new URL(wasmBinary, location.href) }
    const response = await fetch(MODEL_URL, { integrity: __MODEL_INTEGRITY__ })
    const model = new Uint8Array(await response.arrayBuffer())

    for (const backend of ['webgpu', 'wasm'] as const) {
      try {
        const session = await ort.InferenceSession.create(model, {
          executionProviders: [backend],
          graphOptimizationLevel: 'all',
        })
        return new Detector(session, backend)
      } catch (e) {
        if (backend === 'wasm') throw e
      }
    }
    throw new Error('unreachable')
  }

  async detect(
    source: CanvasImageSource,
    width: number,
    height: number,
    threshold: number,
    tiling: TilingOptions = defaultTiling,
  ): Promise<Detection[]> {
    const found: Detection[] = []
    const size = `${width}x${height}`
    if (this.imageSize !== size) {
      this.canvases.clear()
      this.imageSize = size
    }
    for (const { region, inputWidth, inputHeight } of planPasses(width, height, tiling)) {
      const ctx = this.context(inputWidth, inputHeight)
      ctx.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, inputWidth, inputHeight)
      const { data } = ctx.getImageData(0, 0, inputWidth, inputHeight)
      const input = new ort.Tensor('float32', toTensor(data, inputWidth, inputHeight), [1, 3, inputHeight, inputWidth])
      const out = await this.session.run({ 'input.1': input }, ['537', '538', '539'])
      const h = inputHeight / 4
      const w = inputWidth / 4
      const sx = region.width / inputWidth
      const sy = region.height / inputHeight
      for (const d of decode(out['537'].data as Float32Array, out['538'].data as Float32Array, out['539'].data as Float32Array, h, w, threshold)) {
        found.push({
          x1: region.x + d.x1 * sx,
          y1: region.y + d.y1 * sy,
          x2: region.x + d.x2 * sx,
          y2: region.y + d.y2 * sy,
          score: d.score,
        })
      }
      input.dispose()
      for (const t of Object.values(out)) t.dispose()
    }
    return nms(found, NMS_THRESHOLD)
  }

  private context(width: number, height: number): OffscreenCanvasRenderingContext2D {
    const key = `${width}x${height}`
    let ctx = this.canvases.get(key)
    if (!ctx) {
      ctx = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })!
      this.canvases.set(key, ctx)
    }
    ctx.clearRect(0, 0, width, height)
    return ctx
  }
}
