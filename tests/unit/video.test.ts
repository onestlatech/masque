import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Conversion, Input, type ConversionOptions, type VideoSample } from 'mediabunny'
import { applyMasks, defaultMaskOptions } from '../../src/lib/anonymize/render.ts'
import { newTrack, setKeyframe } from '../../src/lib/track/tracker.ts'
import { Video } from '../../src/lib/media/video.ts'

vi.mock('../../src/lib/anonymize/render.ts', async (original) => ({
  ...await original<typeof import('../../src/lib/anonymize/render.ts')>(),
  applyMasks: vi.fn(),
}))
vi.mock('mediabunny', async (original) => ({
  ...await original<typeof import('mediabunny')>(),
  Input: vi.fn(),
  VideoSampleSink: vi.fn(),
  VideoSample: vi.fn(),
  Conversion: { init: vi.fn() },
}))

const track = {
  canDecode: vi.fn(async () => true),
  getDisplayWidth: async () => 100,
  getDisplayHeight: async () => 100,
  computeDuration: async () => 12,
}
const dispose = vi.fn()
const cancel = vi.fn(async () => {})
const execute = vi.fn(async () => {})
const moov = [0, 0, 0, 8, 109, 111, 111, 118]
const access = {
  close: vi.fn(),
  write: vi.fn((bytes: Uint8Array) => bytes.length),
  read: vi.fn((bytes: Uint8Array) => (bytes.set(moov), bytes.length)),
  getSize: vi.fn(() => moov.length),
  flush: vi.fn(),
}
const root = {
  getFileHandle: vi.fn(async (_name: string) => ({ createSyncAccessHandle: async () => access, getFile: async () => new File([], 'export.mp4') })),
  removeEntry: vi.fn(async () => {}),
}
let configuration: ConversionOptions

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('OffscreenCanvas', class {
    getContext() { return { canvas: {}, clearRect() {} } }
  })
  vi.stubGlobal('VideoFrame', class {})
  vi.stubGlobal('navigator', { storage: { getDirectory: async () => root } })
  vi.mocked(Input).mockImplementation(function () {
    return {
      getPrimaryVideoTrack: async () => track,
      getPrimaryAudioTrack: async () => null,
      getFirstTimestamp: async () => 10,
      dispose,
    } as unknown as Input
  })
  vi.mocked(Conversion.init).mockImplementation(async (options) => {
    configuration = options
    return { isValid: true, utilizedTracks: [track], execute, cancel } as unknown as Conversion
  })
  execute.mockRejectedValue(new Error('Stop after processing'))
})

afterEach(() => vi.unstubAllGlobals())

const render = (video: Video, signal = new AbortController().signal) =>
  video.render([10, 11], [], defaultMaskOptions, true, () => {}, signal)

test('rebased export samples use masks from the source timestamp', async () => {
  const video = await Video.open(new Blob())
  const first = { x1: 0, y1: 0, x2: 10, y2: 10 }
  const second = { x1: 50, y1: 50, x2: 60, y2: 60 }
  const track = newTrack(0, first, 0, 1, 1, true)
  setKeyframe(track, 1, second)
  execute.mockImplementationOnce(async () => {
    const options = configuration.video as Exclude<ConversionOptions['video'], Function | unknown[] | undefined>
    await options.process!({ timestamp: 1, microsecondTimestamp: 1_000_000, microsecondDuration: 1_000_000, draw() {} } as unknown as VideoSample)
    throw new Error('Stop after processing')
  })
  await expect(video.render([10, 11], [track], defaultMaskOptions, true, () => {}, new AbortController().signal)).rejects.toThrow('Stop')
  expect(applyMasks).toHaveBeenCalledWith(expect.anything(), [second], defaultMaskOptions)
})

test('failed exports release input, close OPFS and remove only their own file', async () => {
  const video = await Video.open(new Blob())
  await expect(render(video)).rejects.toThrow('Stop')
  expect(dispose).toHaveBeenCalledOnce()
  expect(access.close).toHaveBeenCalledOnce()
  expect(cancel).toHaveBeenCalledOnce()
  expect(root.removeEntry).toHaveBeenCalledExactlyOnceWith(root.getFileHandle.mock.calls[0][0])
})

test('waits for automatic output cancellation before releasing the file', async () => {
  const video = await Video.open(new Blob())
  let finish!: () => void
  let outputCancel: ReturnType<typeof vi.spyOn>
  execute.mockImplementationOnce(async () => {
    configuration.output.state = 'canceled'
    outputCancel = vi.spyOn(configuration.output, 'cancel').mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    throw new Error('Encoder failed')
  })
  const pending = expect(render(video)).rejects.toThrow('Encoder failed')
  await vi.waitFor(() => expect(outputCancel).toHaveBeenCalledOnce())
  expect(cancel).not.toHaveBeenCalled()
  expect(access.close).not.toHaveBeenCalled()
  expect(dispose).not.toHaveBeenCalled()
  finish()
  await pending
  expect(access.close).toHaveBeenCalledOnce()
  expect(root.removeEntry).toHaveBeenCalledOnce()
})

test('a vanished export does not hide the export error', async () => {
  const video = await Video.open(new Blob())
  root.removeEntry.mockRejectedValueOnce(new DOMException('Gone', 'NotFoundError'))
  await expect(render(video)).rejects.toThrow('Stop')
})

test('closing keeps the export long enough for its download', async () => {
  vi.useFakeTimers()
  try {
    const video = await Video.open(new Blob())
    execute.mockResolvedValueOnce()
    await render(video)
    video.close()
    expect(root.removeEntry).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(root.removeEntry).toHaveBeenCalledExactlyOnceWith(root.getFileHandle.mock.calls[0][0])
  } finally {
    vi.useRealTimers()
  }
})

test('cancellation during conversion initialization prevents execution and removes its file', async () => {
  const controller = new AbortController()
  const video = await Video.open(new Blob())
  vi.mocked(Conversion.init).mockImplementationOnce(async () => {
    controller.abort()
    return { isValid: true, utilizedTracks: [track], execute, cancel } as unknown as Conversion
  })
  await expect(render(video, controller.signal)).rejects.toThrow()
  expect(execute).not.toHaveBeenCalled()
  expect(access.close).toHaveBeenCalledOnce()
  expect(root.removeEntry).toHaveBeenCalledOnce()
})

test('conversion initialization failures also release resources', async () => {
  const video = await Video.open(new Blob())
  vi.mocked(Conversion.init).mockRejectedValueOnce(new Error('Cannot initialize'))
  await expect(render(video)).rejects.toThrow('Cannot initialize')
  expect(dispose).toHaveBeenCalledOnce()
  expect(access.close).toHaveBeenCalledOnce()
  expect(root.removeEntry).toHaveBeenCalledOnce()
})

test('unsupported input is disposed', async () => {
  track.canDecode.mockResolvedValueOnce(false)
  await expect(Video.open(new Blob())).rejects.toThrow('error.cannotDecode')
  expect(dispose).toHaveBeenCalledOnce()
})
