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

test.each([0, 7, 15, 40])('rejects invalid extended box size %i', (size) => {
  const bytes = Uint8Array.from([0, 0, 0, 1, 109, 111, 111, 118, 0, 0, 0, 0, 0, 0, 0, size])
  expect(() => zeroTimes(bytes)).toThrow()
  expect(() => findBox((at, length) => bytes.subarray(at, at + length), bytes.length, 'moov')).toThrow()
})

test('rejects truncated time fields instead of touching a neighbouring box', () => {
  expect(() => zeroTimes(Uint8Array.from(box('moov', box('mvhd', [0, 0, 0, 0]), box('free', Array(16).fill(1)))))).toThrow()
})

test('rejects excessive box nesting', () => {
  let nested = box('free')
  for (let i = 0; i < 20; i++) nested = box('moov', nested)
  expect(() => zeroTimes(Uint8Array.from(nested))).toThrow()
})

test('reads a final eight-byte box without reading past EOF', () => {
  const bytes = Uint8Array.from(box('moov'))
  expect(findBox((at, length) => {
    expect(at + length).toBeLessThanOrEqual(bytes.length)
    return bytes.subarray(at, at + length)
  }, bytes.length, 'moov')).toEqual({ at: 0, size: 8 })
})
