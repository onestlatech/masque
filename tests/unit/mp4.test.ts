import { expect, test } from 'vitest'
import { findBox, zeroTimes } from '../../src/lib/media/mp4.ts'

const box = (name: string, ...children: number[][]) => {
  const body = children.flat()
  const size = 8 + body.length
  return [size >>> 24, (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff, ...[...name].map((c) => c.charCodeAt(0)), ...body]
}
// Full box: version, 3 flag bytes, then creation and modification times.
const v0 = (name: string) => box(name, [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9])
const v1 = (name: string) => box(name, [1, 0, 0, 0, ...Array(16).fill(7), 9, 9])

test('zeroTimes clears mvhd, tkhd and mdhd times only', () => {
  const moov = Uint8Array.from(box('moov', v0('mvhd'), box('trak', v1('tkhd'), box('mdia', v0('mdhd'))), box('udta', [1, 2, 3, 4, 5, 6, 7, 8])))
  zeroTimes(moov)
  expect([...moov]).toEqual(
    box(
      'moov',
      box('mvhd', [0, 0, 0, 0, ...Array(8).fill(0), 9, 9]),
      box('trak', box('tkhd', [1, 0, 0, 0, ...Array(16).fill(0), 9, 9]), box('mdia', box('mdhd', [0, 0, 0, 0, ...Array(8).fill(0), 9, 9]))),
      box('udta', [1, 2, 3, 4, 5, 6, 7, 8]),
    ),
  )
})

test('findBox skips to the requested top-level box', () => {
  const file = Uint8Array.from([...box('ftyp', [1, 2, 3, 4]), ...box('mdat', Array(100).fill(0)), ...box('moov', v0('mvhd'))])
  const found = findBox((at, length) => file.subarray(at, at + length), file.length, 'moov')
  expect(found).toEqual({ at: 120, size: 30 })
  expect(findBox((at, length) => file.subarray(at, at + length), file.length, 'free')).toBeUndefined()
})
