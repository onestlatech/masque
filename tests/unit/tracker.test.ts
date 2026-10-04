import { expect, test } from 'vitest'
import type { Detection } from '../../src/lib/detect/centerface.ts'
import { boxAt, boxesAt, buildTracks, newTrack, setKeyframe } from '../../src/lib/track/tracker.ts'

const det = (x: number, score = 0.9): Detection => ({ x1: x, y1: 0, x2: x + 10, y2: 10, score })
const options = { maxGap: 3, pad: 1, minIou: 0.2 }

test('follows a moving face and bridges missed frames', () => {
  const frames = [[det(0)], [det(1)], [], [], [det(4)], [], [], []]
  const [t, ...rest] = buildTracks(frames, 0.5, options)
  expect(rest).toEqual([])
  expect(t.frames).toEqual([0, 1, 4])
  expect(t.start).toBe(0)
  expect(t.end).toBe(5)
  expect(boxAt(t, 2)!.x1).toBeCloseTo(2)
  expect(boxAt(t, 3)!.x1).toBeCloseTo(3)
  // Held after the last detection for `pad` frames.
  expect(boxAt(t, 5)!.x1).toBe(4)
  expect(boxAt(t, 6)).toBeUndefined()
})

test('splits tracks after a long gap', () => {
  const frames = [[det(0)], [], [], [], [], [det(0)]]
  expect(buildTracks(frames, 0.5, options)).toHaveLength(2)
})

test('keeps distinct faces apart and ignores low scores', () => {
  const frames = [
    [det(0), det(100), det(200, 0.1)],
    [det(1), det(101), det(201, 0.1)],
  ]
  const tracks = buildTracks(frames, 0.5, options)
  expect(tracks.map((t) => t.boxes.map((b) => b.x1))).toEqual([
    [0, 1],
    [100, 101],
  ])
})

test('pads at the start, clamped to the first frame', () => {
  const frames = [[], [], [det(0)], [det(0)]]
  const [t] = buildTracks(frames, 0.5, options)
  expect(t.start).toBe(1)
  expect(t.end).toBe(3)
  expect(boxesAt([t], 0)).toEqual([])
  expect(boxesAt([t], 1)).toHaveLength(1)
})

test('keyframes move a manual mask over time', () => {
  const t = newTrack(0, { x1: 0, y1: 0, x2: 10, y2: 10 }, 0, 10, 1, true)
  setKeyframe(t, 10, { x1: 100, y1: 0, x2: 110, y2: 10 })
  setKeyframe(t, 10, { x1: 50, y1: 0, x2: 60, y2: 10 })
  expect(t.frames).toEqual([0, 10])
  expect(boxAt(t, 5)!.x1).toBeCloseTo(25)
  setKeyframe(t, 12, { x1: 0, y1: 0, x2: 10, y2: 10 })
  expect(t.end).toBe(12)
})
