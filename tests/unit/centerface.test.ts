import { describe, expect, test } from 'vitest'
import { decode, iou, nms, padTo32, toTensor, type Detection } from '../../src/lib/detect/centerface.ts'

const box = (x1: number, y1: number, x2: number, y2: number, score = 1): Detection => ({ x1, y1, x2, y2, score })

test('padTo32', () => {
  expect([1, 32, 33, 564, 1080].map(padTo32)).toEqual([32, 32, 64, 576, 1088])
})

test('toTensor writes planar RGB and drops alpha', () => {
  const rgba = new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255])
  expect([...toTensor(rgba, 2, 1)]).toEqual([1, 4, 2, 5, 3, 6])
})

describe('decode', () => {
  // 4×4 output grid, i.e. a 16×16 input.
  const h = 4
  const w = 4
  const outputs = () => ({
    heatmap: new Float32Array(h * w),
    scale: new Float32Array(2 * h * w),
    offset: new Float32Array(2 * h * w),
  })

  test('matches deface arithmetic', () => {
    const { heatmap, scale, offset } = outputs()
    const i = 1 * w + 2 // y=1, x=2
    heatmap[i] = 0.9
    scale[i] = Math.log(2) // height = 8
    scale[h * w + i] = Math.log(1) // width = 4
    offset[i] = 0.25
    offset[h * w + i] = -0.5
    const [d] = decode(heatmap, scale, offset, h, w, 0.5)
    // x1 = (2 - 0.5 + 0.5) * 4 - 4 / 2 = 6, y1 = (1 + 0.25 + 0.5) * 4 - 8 / 2 = 3
    expect(d.x1).toBeCloseTo(6)
    expect(d.y1).toBeCloseTo(3)
    expect(d.x2).toBeCloseTo(10)
    expect(d.y2).toBeCloseTo(11)
    expect(d.score).toBeCloseTo(0.9)
  })

  test('ignores scores at or below the threshold', () => {
    const { heatmap, scale, offset } = outputs()
    heatmap[0] = 0.5
    expect(decode(heatmap, scale, offset, h, w, 0.5)).toEqual([])
  })

  test('clamps to the input bounds like deface', () => {
    const { heatmap, scale, offset } = outputs()
    heatmap[0] = 1
    scale[0] = Math.log(4) // 16 px tall, centered at y=2
    scale[h * w] = Math.log(4)
    const [d] = decode(heatmap, scale, offset, h, w, 0.5)
    // x1 clamps to 0 before x2 = x1 + width, shifting the box right.
    expect(d).toMatchObject({ x1: 0, y1: 0, x2: 16, y2: 16 })
  })
})

test('iou', () => {
  expect(iou(box(0, 0, 10, 10), box(0, 0, 10, 10))).toBe(1)
  expect(iou(box(0, 0, 10, 10), box(10, 10, 20, 20))).toBe(0)
  expect(iou(box(0, 0, 10, 10), box(5, 0, 15, 10))).toBeCloseTo(1 / 3)
})

test('nms keeps the best of overlapping boxes', () => {
  const kept = nms([box(0, 0, 10, 10, 0.5), box(1, 1, 11, 11, 0.9), box(50, 50, 60, 60, 0.3)], 0.3)
  expect(kept).toEqual([box(1, 1, 11, 11, 0.9), box(50, 50, 60, 60, 0.3)])
})
