// Port of deface's CenterFace pre- and post-processing: https://github.com/ORB-HD/deface/blob/master/deface/centerface.py

export interface Detection {
  x1: number
  y1: number
  x2: number
  y2: number
  score: number
}

export const NMS_THRESHOLD = 0.3

/** The network downsamples by 32, so input sides must be multiples of it. */
export const padTo32 = (n: number) => Math.ceil(n / 32) * 32

/** Converts RGBA pixels to the planar RGB float tensor CenterFace expects (0-255, no normalization). */
export function toTensor(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const plane = width * height
  const out = new Float32Array(3 * plane)
  for (let i = 0, p = 0; p < plane; i += 4, p++) {
    out[p] = rgba[i]
    out[plane + p] = rgba[i + 1]
    out[2 * plane + p] = rgba[i + 2]
  }
  return out
}

/**
 * Decodes the heatmap (1×1×h×w), scale (1×2×h×w) and offset (1×2×h×w) outputs into boxes in input pixel coordinates.
 * Mirrors deface's arithmetic, including clamping x1/y1 before deriving x2/y2.
 */
export function decode(
  heatmap: Float32Array,
  scale: Float32Array,
  offset: Float32Array,
  h: number,
  w: number,
  threshold: number,
): Detection[] {
  const plane = h * w
  const inH = h * 4
  const inW = w * 4
  const boxes: Detection[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const score = heatmap[i]
      if (score <= threshold) continue
      const s0 = Math.exp(scale[i]) * 4
      const s1 = Math.exp(scale[plane + i]) * 4
      const o0 = offset[i]
      const o1 = offset[plane + i]
      const x1 = Math.min(Math.max(0, (x + o1 + 0.5) * 4 - s1 / 2), inW)
      const y1 = Math.min(Math.max(0, (y + o0 + 0.5) * 4 - s0 / 2), inH)
      boxes.push({ x1, y1, x2: Math.min(x1 + s1, inW), y2: Math.min(y1 + s0, inH), score })
    }
  }
  return nms(boxes, NMS_THRESHOLD)
}

const area = (b: Detection) => (b.x2 - b.x1) * (b.y2 - b.y1)

export function iou(a: Detection, b: Detection): number {
  const w = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1))
  const h = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1))
  const inter = w * h
  return inter / (area(a) + area(b) - inter)
}

/** Greedy non-maximum suppression; keeps the highest-scoring box of each overlapping group. */
export function nms(boxes: Detection[], threshold: number): Detection[] {
  const sorted = [...boxes].sort((a, b) => b.score - a.score)
  const kept: Detection[] = []
  for (const box of sorted) {
    if (kept.every((k) => iou(k, box) < threshold)) kept.push(box)
  }
  return kept
}
