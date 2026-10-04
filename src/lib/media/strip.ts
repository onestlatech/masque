// Browser encoders add their own metadata (WebKit writes Exif and Photoshop segments), so keep only what decoding needs.

/** Keeps APP0 (JFIF) and APP14 (Adobe color transform); drops other APPn and comments. */
export function stripJpeg(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG')
  const parts: Uint8Array[] = [bytes.subarray(0, 2)]
  let i = 2
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) throw new Error('Corrupt JPEG')
    const marker = bytes[i + 1]
    // Entropy-coded data follows SOS: copy the rest verbatim.
    if (marker === 0xda) {
      parts.push(bytes.subarray(i))
      break
    }
    const end = i + 2 + ((bytes[i + 2] << 8) | bytes[i + 3])
    const isApp = marker >= 0xe0 && marker <= 0xef
    if (!(isApp && marker !== 0xe0 && marker !== 0xee) && marker !== 0xfe) parts.push(bytes.subarray(i, end))
    i = end
  }
  return concat(parts)
}

const PNG_KEEP = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND', 'sRGB', 'gAMA', 'cHRM'])

export function stripPng(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const parts: Uint8Array[] = [bytes.subarray(0, 8)]
  let i = 8
  while (i + 8 <= bytes.length) {
    const end = i + 12 + view.getUint32(i)
    const type = String.fromCharCode(...bytes.subarray(i + 4, i + 8))
    if (PNG_KEEP.has(type)) parts.push(bytes.subarray(i, end))
    i = end
  }
  return concat(parts)
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}
