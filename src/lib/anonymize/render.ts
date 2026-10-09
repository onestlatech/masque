import type { Rect } from '../detect/tiling.ts'

export type Mode = 'solid' | 'mosaic' | 'blur'

export interface MaskOptions {
  mode: Mode
  /** deface's --mask-scale: 1.3 grows each side by 30% of the box size. */
  maskScale: number
  ellipse: boolean
}

export const defaultMaskOptions: MaskOptions = { mode: 'solid', maskScale: 1.3, ellipse: true }

export interface Box {
  x1: number
  y1: number
  x2: number
  y2: number
}

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** deface's scale_bb, clamped to the image. */
export function maskRect(b: Box, maskScale: number, width: number, height: number): Rect {
  const s = maskScale - 1
  const w = b.x2 - b.x1
  const h = b.y2 - b.y1
  const x1 = Math.max(0, Math.round(b.x1 - w * s))
  const y1 = Math.max(0, Math.round(b.y1 - h * s))
  const x2 = Math.min(width, Math.round(b.x2 + w * s))
  const y2 = Math.min(height, Math.round(b.y2 + h * s))
  return { x: x1, y: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) }
}

/** Number of samples across the longest side. */
const SAMPLES: Record<Exclude<Mode, 'solid'>, number> = { mosaic: 6, blur: 3 }

let scratch: OffscreenCanvasRenderingContext2D | undefined

/** `source` holds the unmasked pixels: sampling the canvas being drawn copies all of it for every mask in WebKit. */
export function applyMasks(ctx: Context, boxes: Box[], options: MaskOptions, source: CanvasImageSource = ctx.canvas) {
  const { width, height } = ctx.canvas
  for (const b of boxes) {
    const r = maskRect(b, options.maskScale, width, height)
    if (r.width < 1 || r.height < 1) continue

    ctx.save()
    ctx.beginPath()
    if (options.ellipse) ctx.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, 2 * Math.PI)
    else ctx.rect(r.x, r.y, r.width, r.height)
    ctx.clip()

    if (options.mode === 'solid') {
      ctx.fillStyle = '#000'
      ctx.fillRect(r.x, r.y, r.width, r.height)
    } else {
      const n = SAMPLES[options.mode]
      const k = n / Math.max(r.width, r.height)
      const sw = Math.max(1, Math.round(r.width * k))
      const sh = Math.max(1, Math.round(r.height * k))
      scratch ??= new OffscreenCanvas(1, 1).getContext('2d')!
      scratch.canvas.width = sw
      scratch.canvas.height = sh
      scratch.imageSmoothingQuality = 'high'
      scratch.drawImage(source, r.x, r.y, r.width, r.height, 0, 0, sw, sh)
      ctx.imageSmoothingEnabled = options.mode === 'blur'
      ctx.clearRect(r.x, r.y, r.width, r.height)
      ctx.drawImage(scratch.canvas, 0, 0, sw, sh, r.x, r.y, r.width, r.height)
    }
    ctx.restore()
  }
}
