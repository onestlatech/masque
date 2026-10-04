import '../trusted-types.ts'
import type { MaskOptions } from '../anonymize/render.ts'
import { MIN_THRESHOLD } from '../faces.ts'
import { Video, type Analysis, type VideoInfo } from '../media/video.ts'
import type { Track } from '../track/tracker.ts'
import type { Detection } from './centerface.ts'
import { Detector, type Backend } from './detector.ts'

export interface Requests {
  init: { args: {}; result: Backend }
  detect: { args: { image: ImageBitmap; threshold: number }; result: Detection[] }
  open: { args: { file: File }; result: VideoInfo & { video: number } }
  analyze: { args: { video: number }; result: Analysis }
  frame: { args: { video: number; timestamp: number }; result: ImageBitmap }
  render: {
    args: { video: number; timestamps: number[]; tracks: Track[]; options: MaskOptions; discardAudio: boolean }
    result: File
  }
  close: { args: { video: number }; result: void }
  cancel: { args: { target: number }; result: void }
}

export type Request = { [K in keyof Requests]: { id: number; type: K } & Requests[K]['args'] }[keyof Requests]

export type Response = { id: number; result: unknown } | { id: number; error: string } | { id: number; progress: number }

// Video frames run in one full-resolution pass: tiling every frame would be too slow.
const VIDEO_TILING = { direct: Infinity, tile: 0, overlap: 0 }

let detector: Promise<Detector> | undefined
const videos = new Map<number, Video>()
const running = new Map<number, AbortController>()
let nextVideo = 0

const getDetector = () => (detector ??= Detector.create())

function video(id: number): Video {
  const v = videos.get(id)
  if (!v) throw new Error(`Unknown video ${id}`)
  return v
}

async function handle(req: Request, signal: AbortSignal): Promise<[unknown, Transferable[]?]> {
  // In Firefox, demuxing while ONNX Runtime starts its threads stalls the runtime: let it finish first.
  if (req.type !== 'cancel') await getDetector()
  const progress = (p: number) => postMessage({ id: req.id, progress: p } satisfies Response)
  switch (req.type) {
    case 'init':
      return [(await getDetector()).backend]
    case 'detect': {
      const { image } = req
      try {
        return [await (await getDetector()).detect(image, image.width, image.height, req.threshold)]
      } finally {
        image.close()
      }
    }
    case 'open': {
      const v = await Video.open(req.file)
      const id = nextVideo++
      videos.set(id, v)
      return [{ ...v.info, video: id }]
    }
    case 'analyze': {
      const d = await getDetector()
      const v = video(req.video)
      return [await v.analyze((f) => d.detect(f, f.width, f.height, MIN_THRESHOLD, VIDEO_TILING), progress, signal)]
    }
    case 'frame': {
      const bitmap = await video(req.video).frame(req.timestamp)
      return [bitmap, [bitmap]]
    }
    case 'render':
      return [await video(req.video).render(req.timestamps, req.tracks, req.options, req.discardAudio, progress, signal)]
    case 'close':
      video(req.video).close()
      videos.delete(req.video)
      return [undefined]
    case 'cancel':
      running.get(req.target)?.abort()
      return [undefined]
  }
}

addEventListener('message', async ({ data }: MessageEvent<Request>) => {
  const controller = new AbortController()
  running.set(data.id, controller)
  try {
    const [result, transfer = []] = await handle(data, controller.signal)
    postMessage({ id: data.id, result } satisfies Response, { transfer })
  } catch (e) {
    postMessage({ id: data.id, error: e instanceof Error ? e.message : String(e) } satisfies Response)
  } finally {
    running.delete(data.id)
  }
})
