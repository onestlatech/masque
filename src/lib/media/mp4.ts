// Muxers stamp MP4 headers with the export time, which ties the file to when the user processed it.

const CONTAINERS = new Set(['moov', 'trak', 'mdia'])
const TIMED = new Set(['mvhd', 'tkhd', 'mdhd'])

const type = (b: Uint8Array, at: number) => String.fromCharCode(b[at + 4], b[at + 5], b[at + 6], b[at + 7])

function boxSize(view: DataView, at: number, remaining: number): [size: number, header: number] {
  let size = view.getUint32(at)
  const header = size === 1 ? 16 : 8
  if (remaining < header || view.byteLength - at < header) throw new Error('Truncated MP4 header')
  if (size === 1) size = Number(view.getBigUint64(at + 8))
  else if (size === 0) size = remaining
  if (!Number.isSafeInteger(size) || size < header || size > remaining) throw new Error('Invalid MP4 box size')
  return [size, header]
}

/** Zeroes creation and modification times in a moov box, in place. */
export function zeroTimes(moov: Uint8Array, at = 0, end = moov.length, depth = 0) {
  if (depth > 16 || end > moov.length) throw new Error('Invalid MP4 structure')
  const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength)
  while (at + 8 <= end) {
    const [size, header] = boxSize(view, at, end - at)
    const t = type(moov, at)
    if (CONTAINERS.has(t)) zeroTimes(moov, at + header, at + size, depth + 1)
    else if (TIMED.has(t)) {
      const body = at + header
      // Version 1 uses 64-bit times; version 0, 32-bit.
      const length = moov[body] === 1 ? 16 : 8
      if (moov[body] > 1 || header + 4 + length > size) throw new Error('Invalid MP4 time header')
      moov.fill(0, body + 4, body + 4 + length)
    }
    at += size
  }
  if (at !== end) throw new Error('Truncated MP4 box')
}

/** Finds a top-level box by reading headers only; returns its offset and size. */
export function findBox(read: (at: number, length: number) => Uint8Array, fileSize: number, name: string) {
  let at = 0
  while (at + 8 <= fileSize) {
    const head = read(at, Math.min(16, fileSize - at))
    const [size] = boxSize(new DataView(head.buffer, head.byteOffset, head.byteLength), 0, fileSize - at)
    if (type(head, 0) === name) return { at, size }
    at += size
  }
  if (at !== fileSize) throw new Error('Truncated MP4 box')
}
