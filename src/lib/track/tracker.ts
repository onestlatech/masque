import type { Box } from '../anonymize/render.ts'
import { iou, type Detection } from '../detect/centerface.ts'

/**
 * A face (or manual mask) over time. Between keyframes the box is interpolated; outside them it holds still until
 * `start`/`end`, so a face is still masked on frames where the detector missed it.
 */
export interface Track {
  id: number
  /** Sorted frame indices. */
  frames: number[]
  boxes: Box[]
  start: number
  end: number
  score: number
  manual: boolean
}

export interface TrackerOptions {
  /** Longest run of missed frames bridged by interpolation. */
  maxGap: number
  /** Frames masked before the first and after the last detection. */
  pad: number
  minIou: number
}

/** Bridges one second of misses and pads half a second on each side. */
export const trackerOptions = (fps: number): TrackerOptions => ({
  maxGap: Math.round(fps),
  pad: Math.round(fps / 2),
  minIou: 0.2,
})

let nextId = 0

export function newTrack(frame: number, box: Box, start: number, end: number, score: number, manual: boolean): Track {
  return { id: nextId++, frames: [frame], boxes: [toBox(box)], start, end, score, manual }
}

const toBox = ({ x1, y1, x2, y2 }: Box): Box => ({ x1, y1, x2, y2 })

/** Greedy IoU association, frame by frame. */
export function buildTracks(detections: Detection[][], threshold: number, options: TrackerOptions): Track[] {
  const last = detections.length - 1
  const done: Track[] = []
  let active: Track[] = []

  detections.forEach((found, frame) => {
    active = active.filter((t) => {
      if (frame - t.frames.at(-1)! <= options.maxGap) return true
      done.push(t)
      return false
    })

    const pairs: [number, Track, Detection][] = []
    for (const t of active) {
      for (const d of found) {
        if (d.score < threshold) continue
        const overlap = iou({ ...t.boxes.at(-1)!, score: 0 }, d)
        if (overlap >= options.minIou) pairs.push([overlap, t, d])
      }
    }
    pairs.sort((a, b) => b[0] - a[0])
    const usedTracks = new Set<Track>()
    const usedDetections = new Set<Detection>()
    for (const [, t, d] of pairs) {
      if (usedTracks.has(t) || usedDetections.has(d)) continue
      usedTracks.add(t)
      usedDetections.add(d)
      t.frames.push(frame)
      t.boxes.push(toBox(d))
      t.score = Math.max(t.score, d.score)
    }
    for (const d of found) {
      if (d.score >= threshold && !usedDetections.has(d)) active.push(newTrack(frame, d, frame, frame, d.score, false))
    }
  })

  return [...done, ...active].map((t) => ({
    ...t,
    start: Math.max(0, t.frames[0] - options.pad),
    end: Math.min(last, t.frames.at(-1)! + options.pad),
  }))
}

/** Index of the last keyframe at or before `frame`, or -1. */
function keyframeBefore(t: Track, frame: number): number {
  let lo = 0
  let hi = t.frames.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (t.frames[mid] <= frame) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

export function boxAt(t: Track, frame: number): Box | undefined {
  if (frame < t.start || frame > t.end) return
  const i = keyframeBefore(t, frame)
  if (i === -1) return t.boxes[0]
  if (i === t.frames.length - 1 || t.frames[i] === frame) return t.boxes[i]
  const a = t.boxes[i]
  const b = t.boxes[i + 1]
  const k = (frame - t.frames[i]) / (t.frames[i + 1] - t.frames[i])
  const lerp = (p: number, q: number) => p + (q - p) * k
  return { x1: lerp(a.x1, b.x1), y1: lerp(a.y1, b.y1), x2: lerp(a.x2, b.x2), y2: lerp(a.y2, b.y2) }
}

export const boxesAt = (tracks: Track[], frame: number) =>
  tracks.flatMap((t) => {
    const b = boxAt(t, frame)
    return b ? [b] : []
  })

/** Pins the box on one frame; neighbouring frames follow by interpolation. Marks the track as user-owned. */
export function setKeyframe(t: Track, frame: number, box: Box) {
  const i = keyframeBefore(t, frame)
  if (i !== -1 && t.frames[i] === frame) t.boxes[i] = toBox(box)
  else {
    t.frames.splice(i + 1, 0, frame)
    t.boxes.splice(i + 1, 0, toBox(box))
  }
  t.start = Math.min(t.start, frame)
  t.end = Math.max(t.end, frame)
  t.manual = true
}
