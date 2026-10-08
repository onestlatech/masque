import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  StreamTarget,
  VideoSample,
  VideoSampleSink,
  type InputVideoTrack,
  type StreamTargetChunk,
} from 'mediabunny'
import { applyMasks, type MaskOptions } from '../anonymize/render.ts'
import type { Detection } from '../detect/centerface.ts'
import { boxesAt, type Track } from '../track/tracker.ts'
import { findBox, zeroTimes } from './mp4.ts'
import { outputName } from './image.ts'

// WebKit's colour enums go beyond WebCodecs ("unspecified", "smpte240m"...) and Mediabunny rejects such frames.
// Report out-of-spec values as unknown until https://github.com/Vanilagy/mediabunny/pull/556 ships.
const SPEC_COLOR_VALUES = {
  primaries: ['bt709', 'bt470bg', 'smpte170m', 'bt2020', 'smpte432'],
  transfer: ['bt709', 'smpte170m', 'iec61966-2-1', 'linear', 'pq', 'hlg'],
  matrix: ['rgb', 'bt709', 'bt470bg', 'smpte170m', 'bt2020-ncl'],
} satisfies Record<'primaries' | 'transfer' | 'matrix', string[]>

const colorSpace = Object.getOwnPropertyDescriptor(VideoFrame.prototype, 'colorSpace')
if (colorSpace?.get) {
  const get = colorSpace.get
  Object.defineProperty(VideoFrame.prototype, 'colorSpace', {
    ...colorSpace,
    get(this: VideoFrame) {
      const c: VideoColorSpace = get.call(this)
      const spec = <K extends keyof typeof SPEC_COLOR_VALUES>(key: K) =>
        c[key] !== null && SPEC_COLOR_VALUES[key].includes(c[key]) ? c[key] : undefined
      if ((['primaries', 'transfer', 'matrix'] as const).every((k) => c[k] === null || spec(k) !== undefined)) return c
      return new VideoColorSpace({
        primaries: spec('primaries'),
        transfer: spec('transfer'),
        matrix: spec('matrix'),
        fullRange: c.fullRange ?? undefined,
      })
    },
  })
}

export interface VideoInfo {
  width: number
  height: number
  duration: number
}

export interface Analysis {
  fps: number
  /** Presentation time of each frame, in seconds; frame indices everywhere else refer to this array. */
  timestamps: number[]
  detections: Detection[][]
}

export type Progress = (fraction: number) => void

/** All coordinates are in display space: rotation metadata is applied before detection and masking. */
export class Video {
  private sink: VideoSampleSink
  private canvas: OffscreenCanvasRenderingContext2D

  private constructor(
    private file: Blob,
    private input: Input,
    track: InputVideoTrack,
    readonly info: VideoInfo,
  ) {
    this.sink = new VideoSampleSink(track)
    this.canvas = new OffscreenCanvas(info.width, info.height).getContext('2d')!
  }

  static async open(file: Blob): Promise<Video> {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
    const track = await input.getPrimaryVideoTrack()
    if (!track) throw new Error('error.noVideo')
    if (!(await track.canDecode())) throw new Error('error.cannotDecode')
    const info = {
      width: await track.getDisplayWidth(),
      height: await track.getDisplayHeight(),
      duration: await track.computeDuration(),
    }
    return new Video(file, input, track, info)
  }

  async analyze(
    detect: (frame: OffscreenCanvas) => Promise<Detection[]>,
    onProgress: Progress,
    signal: AbortSignal,
  ): Promise<Analysis> {
    const timestamps: number[] = []
    const detections: Detection[][] = []
    for await (const sample of this.sink.samples()) {
      try {
        signal.throwIfAborted()
        sample.draw(this.canvas, 0, 0)
        timestamps.push(sample.timestamp)
        detections.push(await detect(this.canvas.canvas))
        onProgress(Math.min(1, (sample.timestamp + sample.duration) / this.info.duration))
      } finally {
        sample.close()
      }
    }
    return { fps: timestamps.length / this.info.duration, timestamps, detections }
  }

  async frame(timestamp: number): Promise<ImageBitmap> {
    const sample = await this.sink.getSample(timestamp)
    if (!sample) throw new Error(`No frame at ${timestamp}s`)
    try {
      sample.draw(this.canvas, 0, 0)
    } finally {
      sample.close()
    }
    return createImageBitmap(this.canvas.canvas)
  }

  /** Writes the masked video to the origin private file system, falling back to memory where it is unavailable. */
  async render(
    timestamps: number[],
    tracks: Track[],
    options: MaskOptions,
    discardAudio: boolean,
    onProgress: Progress,
    signal: AbortSignal,
  ): Promise<File> {
    // A fresh Input: Conversion takes ownership and disposes it.
    const input = new Input({ source: new BlobSource(this.file), formats: ALL_FORMATS })
    const name = outputName('video/mp4')
    const opfs = await openOpfs(name).catch(() => undefined)
    const memory = new BufferTarget()
    const output = new Output({
      format: new Mp4OutputFormat(),
      target: opfs
        ? new StreamTarget(new WritableStream<StreamTargetChunk>({ write: (c) => void opfs.write(c.data, { at: c.position }) }))
        : memory,
    })

    const ctx = this.canvas
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      // Drops title, GPS location, device and date tags.
      tags: {},
      showWarnings: false,
      video: {
        forceTranscode: true,
        allowTransformationMetadata: false,
        quality: QUALITY_HIGH,
        processedWidth: this.info.width,
        processedHeight: this.info.height,
        process: (sample) => {
          sample.draw(ctx, 0, 0)
          applyMasks(ctx, boxesAt(tracks, nearest(timestamps, sample.timestamp)), options)
          return new VideoSample(
            new VideoFrame(ctx.canvas, { timestamp: sample.microsecondTimestamp, duration: sample.microsecondDuration }),
          )
        },
      },
      audio: discardAudio ? { discard: true } : undefined,
    })
    if (!conversion.isValid) throw new Error('error.cannotEncode')
    conversion.onProgress = onProgress
    signal.addEventListener('abort', () => void conversion.cancel())

    if (!opfs) {
      await conversion.execute()
      const bytes = new Uint8Array(memory.buffer!)
      const moov = findBox((at, length) => bytes.subarray(at, at + length), bytes.length, 'moov')
      if (moov) zeroTimes(bytes, moov.at, moov.at + moov.size)
      return new File([bytes], name, { type: 'video/mp4' })
    }

    try {
      await conversion.execute()
      const read = (at: number, length: number) => {
        const b = new Uint8Array(length)
        opfs.read(b, { at })
        return b
      }
      const moov = findBox(read, opfs.getSize(), 'moov')
      if (moov) {
        const bytes = read(moov.at, moov.size)
        zeroTimes(bytes)
        opfs.write(bytes, { at: moov.at })
      }
      opfs.flush()
    } finally {
      opfs.close()
    }
    const root = await navigator.storage.getDirectory()
    return (await root.getFileHandle(name)).getFile()
  }

  close() {
    this.input.dispose()
  }
}

async function openOpfs(name: string): Promise<FileSystemSyncAccessHandle> {
  const root = await navigator.storage.getDirectory()
  // Only one export is kept: earlier ones are already downloaded.
  for await (const key of root.keys()) if (key.startsWith('masque-')) await root.removeEntry(key)
  const handle = await root.getFileHandle(name, { create: true })
  return handle.createSyncAccessHandle()
}

/** Index of the timestamp closest to `t`. */
export function nearest(timestamps: number[], t: number): number {
  let lo = 0
  let hi = timestamps.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (timestamps[mid] < t) lo = mid + 1
    else hi = mid
  }
  return lo > 0 && t - timestamps[lo - 1] < timestamps[lo] - t ? lo - 1 : lo
}
