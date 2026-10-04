import { expect, test } from 'vitest'
import { stripJpeg, stripPng } from '../../src/lib/media/strip.ts'

const segment = (marker: number, payload: string) => {
  const data = new TextEncoder().encode(payload)
  return [0xff, marker, (data.length + 2) >> 8, (data.length + 2) & 0xff, ...data]
}

test('stripJpeg drops Exif, XMP, Photoshop and comments; keeps JFIF, Adobe and image data', () => {
  const jpeg = Uint8Array.from([
    0xff, 0xd8,
    ...segment(0xe0, 'JFIF'),
    ...segment(0xe1, 'Exif GPS'),
    ...segment(0xe1, 'http://ns.adobe.com/xap/1.0/'),
    ...segment(0xed, 'Photoshop 3.0'),
    ...segment(0xee, 'Adobe'),
    ...segment(0xfe, 'comment'),
    ...segment(0xdb, 'DQT'),
    0xff, 0xda, 0x00, 0x02, 0x12, 0xff, 0xe1, 0x34, 0xff, 0xd9,
  ])
  const out = stripJpeg(jpeg)
  expect([...out]).toEqual([
    0xff, 0xd8,
    ...segment(0xe0, 'JFIF'),
    ...segment(0xee, 'Adobe'),
    ...segment(0xdb, 'DQT'),
    0xff, 0xda, 0x00, 0x02, 0x12, 0xff, 0xe1, 0x34, 0xff, 0xd9,
  ])
})

test('stripJpeg rejects non-JPEG input', () => {
  expect(() => stripJpeg(Uint8Array.from([0x89, 0x50]))).toThrow()
})

const chunk = (type: string, payload: string) => {
  const data = new TextEncoder().encode(payload)
  const len = data.length
  return [len >>> 24, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff, ...new TextEncoder().encode(type), ...data, 0, 0, 0, 0]
}

test('stripPng keeps only rendering chunks', () => {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const png = Uint8Array.from([
    ...sig,
    ...chunk('IHDR', 'h'),
    ...chunk('sRGB', 's'),
    ...chunk('eXIf', 'exif'),
    ...chunk('tEXt', 'Author'),
    ...chunk('iCCP', 'icc'),
    ...chunk('IDAT', 'pixels'),
    ...chunk('tIME', 't'),
    ...chunk('IEND', ''),
  ])
  expect([...stripPng(png)]).toEqual([...sig, ...chunk('IHDR', 'h'), ...chunk('sRGB', 's'), ...chunk('IDAT', 'pixels'), ...chunk('IEND', '')])
})
