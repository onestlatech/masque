import { applyMasks, type Box, type MaskOptions } from '../anonymize/render.ts'
import { stripJpeg, stripPng } from './strip.ts'

// iOS WebKit refuses canvases over 4096 × 4096 pixels, and the editor and export draw the whole photo on one.
export const MAX_AREA = 4096 * 4096

/** Decodes with EXIF orientation applied, so pixels match what the user sees, and scales down to MAX_AREA. */
export async function loadImage(file: Blob): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.sqrt(MAX_AREA / (bitmap.width * bitmap.height))
  if (scale >= 1) return bitmap
  try {
    const canvas = new OffscreenCanvas(Math.max(1, Math.floor(bitmap.width * scale)), Math.max(1, Math.floor(bitmap.height * scale)))
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.transferToImageBitmap()
  } finally {
    bitmap.close()
  }
}

/** Re-encodes from raw pixels and strips what the encoder adds: no source or browser metadata survives. */
export async function exportImage(bitmap: ImageBitmap, boxes: Box[], options: MaskOptions, type: string): Promise<Blob> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  applyMasks(ctx, boxes, options)
  const bytes = new Uint8Array(await (await canvas.convertToBlob({ type, quality: 0.92 })).arrayBuffer())
  return new Blob([type === 'image/png' ? stripPng(bytes) : stripJpeg(bytes)], { type })
}

/** PNG keeps transparency; everything else becomes JPEG. */
export const outputType = (input: string) => (input === 'image/png' ? 'image/png' : 'image/jpeg')

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'application/zip': 'zip' }

/** Random name: the original may contain a date, place, or the photographer's name. */
export const outputName = (type: string) => `masque-${crypto.randomUUID().slice(0, 8)}.${EXTENSIONS[type]}`

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
