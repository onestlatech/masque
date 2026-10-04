import { expect, test } from 'vitest'
import { maskRect } from '../../src/lib/anonymize/render.ts'

test('maskRect matches deface scale_bb', () => {
  // deface: s = 0.3, w = h = 100 => each side grows by 30 px.
  expect(maskRect({ x1: 100, y1: 100, x2: 200, y2: 200 }, 1.3, 1000, 1000)).toEqual({ x: 70, y: 70, width: 160, height: 160 })
})

test('maskRect clamps to the image', () => {
  expect(maskRect({ x1: 0, y1: 0, x2: 100, y2: 100 }, 1.3, 120, 1000)).toEqual({ x: 0, y: 0, width: 120, height: 130 })
})
