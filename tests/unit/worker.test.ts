import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Request } from '../../src/lib/detect/worker.ts'

const { detect, create } = vi.hoisted(() => ({ detect: vi.fn(), create: vi.fn() }))
vi.mock('../../src/lib/detect/detector.ts', () => ({ Detector: { create } }))
vi.mock('../../src/lib/media/video.ts', () => ({ Video: {} }))

let send: (event: { data: Request }) => void
const post = vi.fn()
let events: EventTarget

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  create.mockResolvedValue({ detect, backend: 'wasm' })
  detect.mockResolvedValue([])
  events = new EventTarget()
  vi.stubGlobal('addEventListener', (event: string, listener: EventListener) => {
    if (event === 'message') send = listener as unknown as typeof send
    else events.addEventListener(event, listener)
  })
  vi.stubGlobal('postMessage', post)
  await import('../../src/lib/detect/worker.ts')
})
afterEach(() => vi.unstubAllGlobals())

const image = () => ({ width: 32, height: 32, close: vi.fn() }) as unknown as ImageBitmap

test('requests run serially while cancellation bypasses the queue', async () => {
  let finish!: (value: never[]) => void
  detect.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  const images = [image(), image(), image()]
  for (const [id, image] of images.entries()) send({ data: { id, type: 'detect', image, threshold: 0.2 } })
  await vi.waitFor(() => expect(detect).toHaveBeenCalledOnce())
  send({ data: { id: 3, type: 'cancel', target: 2 } })
  finish([])
  await vi.waitFor(() => expect(post).toHaveBeenCalledWith({ id: 2, error: expect.any(String) }))
  expect(detect).toHaveBeenCalledTimes(2)
  for (const image of images) expect(image.close).toHaveBeenCalledOnce()
})

test('detector initialization failure still closes transferred images', async () => {
  create.mockRejectedValueOnce(new Error('Model unavailable'))
  const bitmap = image()
  send({ data: { id: 0, type: 'detect', image: bitmap, threshold: 0.2 } })
  await vi.waitFor(() => expect(post).toHaveBeenCalledWith({ id: 0, error: 'Model unavailable' }))
  expect(bitmap.close).toHaveBeenCalledOnce()
})
