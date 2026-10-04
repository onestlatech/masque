import '../trusted-types.ts'
import type { Detection } from './centerface.ts'
import { Detector, type Backend } from './detector.ts'
import type { TilingOptions } from './tiling.ts'

export type Request =
  | { id: number; type: 'init' }
  | { id: number; type: 'detect'; image: ImageBitmap | VideoFrame; threshold: number; tiling?: TilingOptions }

export type Response = { id: number; result: Backend | Detection[] } | { id: number; error: string }

let detector: Promise<Detector> | undefined

addEventListener('message', async ({ data }: MessageEvent<Request>) => {
  try {
    detector ??= Detector.create()
    const d = await detector
    if (data.type === 'init') {
      postMessage({ id: data.id, result: d.backend } satisfies Response)
      return
    }
    const { image } = data
    const width = image instanceof VideoFrame ? image.displayWidth : image.width
    const height = image instanceof VideoFrame ? image.displayHeight : image.height
    try {
      postMessage({ id: data.id, result: await d.detect(image, width, height, data.threshold, data.tiling) } satisfies Response)
    } finally {
      image.close()
    }
  } catch (e) {
    postMessage({ id: data.id, error: e instanceof Error ? e.message : String(e) } satisfies Response)
  }
})
