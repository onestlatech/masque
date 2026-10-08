import { expect, test } from 'vitest'
import { defaultTiling, planPasses, type Pass } from '../../src/lib/detect/tiling.ts'

const tiles = (passes: Pass[]) => passes.slice(1).map((p) => p.region)

test('small images run in one pass', () => {
  expect(planPasses(800, 564)).toEqual([
    { region: { x: 0, y: 0, width: 800, height: 564 }, inputWidth: 800, inputHeight: 576 },
  ])
})

test('large images get a downscaled pass then same-shape tiles', () => {
  const passes = planPasses(4000, 3000)
  expect(passes[0]).toMatchObject({ region: { x: 0, y: 0, width: 4000, height: 3000 }, inputWidth: 640, inputHeight: 480 })
  expect(tiles(passes)).toHaveLength(48)
  for (const p of passes.slice(1)) expect(p).toMatchObject({ inputWidth: 640, inputHeight: 640 })
})

test('tiles cover the image and overlap enough for any small face', () => {
  const { tile, overlap } = defaultTiling
  for (const [width, height] of [
    [4000, 3000],
    [6000, 1000],
    [1025, 1025],
  ]) {
    const regions = tiles(planPasses(width, height))
    for (const axis of ['x', 'y'] as const) {
      const size = axis === 'x' ? 'width' : 'height'
      const length = axis === 'x' ? width : height
      const starts = [...new Set(regions.map((r) => r[axis]))].sort((a, b) => a - b)
      expect(starts[0]).toBe(0)
      const last = regions.find((r) => r[axis] === starts.at(-1))!
      expect(last[axis] + last[size]).toBe(length)
      for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeLessThanOrEqual(tile - overlap)
    }
  }
})
