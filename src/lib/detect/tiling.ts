import { padTo32 } from './centerface.ts'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** One network run: a region of the source image, resized to an input size the network accepts. */
export interface Pass {
  region: Rect
  inputWidth: number
  inputHeight: number
}

export interface TilingOptions {
  /** Images whose longest side fits are processed in one pass. */
  direct: number
  tile: number
  /** Faces up to this size are guaranteed to fit entirely in at least one tile. */
  overlap: number
}

export const defaultTiling: TilingOptions = { direct: 1920, tile: 1280, overlap: 160 }

function spans(length: number, tile: number, overlap: number): [start: number, size: number][] {
  if (length <= tile) return [[0, length]]
  const step = tile - overlap
  const count = Math.ceil((length - overlap) / step)
  return Array.from({ length: count }, (_, i) => [Math.min(i * step, length - tile), tile])
}

/**
 * Plans full-resolution tiles so small, distant faces stay detectable, plus a downscaled whole-image pass for faces
 * too large to fit in a tile. All tiles share one input shape so WebGPU compiles its shaders once.
 */
export function planPasses(width: number, height: number, options = defaultTiling): Pass[] {
  const { direct, tile, overlap } = options
  const whole = (w: number, h: number): Pass => ({
    region: { x: 0, y: 0, width, height },
    inputWidth: padTo32(w),
    inputHeight: padTo32(h),
  })
  if (Math.max(width, height) <= direct) return [whole(width, height)]

  const s = tile / Math.max(width, height)
  const passes = [whole(Math.round(width * s), Math.round(height * s))]
  for (const [y, h] of spans(height, tile, overlap)) {
    for (const [x, w] of spans(width, tile, overlap)) {
      passes.push({ region: { x, y, width: w, height: h }, inputWidth: padTo32(w), inputHeight: padTo32(h) })
    }
  }
  return passes
}
