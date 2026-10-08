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

const colorSpace = typeof VideoFrame === 'undefined' ? undefined : Object.getOwnPropertyDescriptor(VideoFrame.prototype, 'colorSpace')
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

/** How long a downloaded export outlives its replacement or "Open another file": the browser may still be saving it. */
const DOWNLOAD_GRACE = 10_000

/** All coordinates are in display space: rotation metadata is applied before detection and masking. */
export class Video {
  private sink: VideoSampleSink
  private canvas: OffscreenCanvasRenderingContext2D
  private exported?: { root: FileSystemDirectoryHandle; name: string }

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
    try {
      const track = await input.getPrimaryVideoTrack()
      if (!track) throw new Error('error.noVideo')
      if (!(await track.canDecode())) throw new Error('error.cannotDecode')
      const info = {
        width: await track.getDisplayWidth(),
        height: await track.getDisplayHeight(),
        duration: await track.computeDuration(),
      }
      return new Video(file, input, track, info)
    } catch (e) {
      input.dispose()
      throw e
    }
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
        this.canvas.clearRect(0, 0, this.info.width, this.info.height)
        sample.draw(this.canvas, 0, 0)
        timestamps.push(sample.timestamp)
        detections.push(await detect(this.canvas.canvas))
        onProgress(Math.min(1, (sample.timestamp + sample.duration) / this.info.duration))
      } finally {
        sample.close()
      }
    }
    signal.throwIfAborted()
    if (!timestamps.length) throw new Error('error.noVideo')
    return { fps: timestamps.length / (this.info.duration - timestamps[0]), timestamps, detections }
  }

  async frame(timestamp: number): Promise<ImageBitmap> {
    const sample = await this.sink.getSample(timestamp)
    if (!sample) throw new Error(`No frame at ${timestamp}s`)
    try {
      this.canvas.clearRect(0, 0, this.info.width, this.info.height)
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
    signal.throwIfAborted()
    this.releaseExport()
    const input = new Input({ source: new BlobSource(this.file), formats: ALL_FORMATS })
    const name = outputName('video/mp4')
    let opfs: FileSystemSyncAccessHandle | undefined
    let conversion: Conversion | undefined
    let output: Output | undefined
    let cancellation: Promise<void> | undefined
    let complete = false
    const cancel = () => { cancellation ??= conversion!.cancel() }

    try {
      const storage = await openOpfs(name).catch(() => undefined)
      if (storage) {
        opfs = storage.access
        this.exported = { root: storage.root, name }
      }
      const memory = new BufferTarget()
      const write = (data: Uint8Array, at: number) => {
        if (opfs!.write(data, { at }) !== data.length) throw new Error('Incomplete video write')
      }
      output = new Output({
        format: new Mp4OutputFormat(),
        target: opfs
          ? new StreamTarget(new WritableStream<StreamTargetChunk>({ write: (c) => write(c.data, c.position) }))
          : memory,
      })
      const video = await input.getPrimaryVideoTrack()
      if (!video) throw new Error('error.noVideo')
      const audio = discardAudio ? null : await input.getPrimaryAudioTrack()
      const start = Math.max(0, await input.getFirstTimestamp(audio ? [video, audio] : [video]))
      const ctx = this.canvas
      conversion = await Conversion.init({
        input,
        output,
        tracks: 'primary',
        trim: { start },
        tags: {},
        showWarnings: false,
        video: {
          forceTranscode: true,
          allowTransformationMetadata: false,
          quality: QUALITY_HIGH,
          processedWidth: this.info.width,
          processedHeight: this.info.height,
          process: (sample) => {
            ctx.clearRect(0, 0, this.info.width, this.info.height)
            sample.draw(ctx, 0, 0)
            // Conversion rebases timestamps; masks refer to the source timeline.
            applyMasks(ctx, boxesAt(tracks, nearest(timestamps, sample.timestamp + start)), options)
            return new VideoSample(
              new VideoFrame(ctx.canvas, { timestamp: sample.microsecondTimestamp, duration: sample.microsecondDuration }),
            )
          },
        },
        audio: discardAudio ? { discard: true } : undefined,
      })
      if (!conversion.isValid || !conversion.utilizedTracks.includes(video)) throw new Error('error.cannotEncode')
      conversion.onProgress = onProgress
      signal.addEventListener('abort', cancel, { once: true })
      signal.throwIfAborted()
      await conversion.execute()
      signal.throwIfAborted()

      if (!opfs) {
        const bytes = new Uint8Array(memory.buffer!)
        const moov = findBox((at, length) => bytes.subarray(at, at + length), bytes.length, 'moov')
        if (!moov) throw new Error('Missing video metadata')
        zeroTimes(bytes, moov.at, moov.at + moov.size)
        complete = true
        return new File([bytes], name, { type: 'video/mp4' })
      }

      const read = (at: number, length: number) => {
        const bytes = new Uint8Array(length)
        if (opfs!.read(bytes, { at }) !== length) throw new Error('Incomplete video read')
        return bytes
      }
      const moov = findBox(read, opfs.getSize(), 'moov')
      if (!moov) throw new Error('Missing video metadata')
      const bytes = read(moov.at, moov.size)
      zeroTimes(bytes)
      write(bytes, moov.at)
      opfs.flush()
      opfs.close()
      opfs = undefined
      const file = await (await storage!.root.getFileHandle(name)).getFile()
      complete = true
      return file
    } finally {
      signal.removeEventListener('abort', cancel)
      try {
        if (cancellation) await cancellation
        else if (!complete && output?.state !== 'canceled') await conversion?.cancel()
        // Conversion can start output cancellation without awaiting its resource cleanup.
        if (!complete && output && output.state !== 'finalized') await output.cancel()
      } finally {
        input.dispose()
        opfs?.close()
        if (!complete) await this.removeExport()
      }
    }
  }

  private async removeExport() {
    const exported = this.exported
    this.exported = undefined
    if (exported) await removeEntry(exported.root, exported.name)
  }

  private releaseExport() {
    const exported = this.exported
    this.exported = undefined
    if (exported) setTimeout(() => removeEntry(exported.root, exported.name).catch(console.error), DOWNLOAD_GRACE)
  }

  close() {
    this.input.dispose()
    this.canvas.canvas.width = this.canvas.canvas.height = 1
    this.releaseExport()
  }
}

async function removeEntry(root: FileSystemDirectoryHandle, name: string) {
  try {
    await root.removeEntry(name)
  } catch (e) {
    // Already gone, for instance after the user cleared site data.
    if (!(e instanceof DOMException && e.name === 'NotFoundError')) throw e
  }
}

async function openOpfs(name: string) {
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(name, { create: true })
  try {
    return { root, access: await handle.createSyncAccessHandle() }
  } catch (e) {
    await root.removeEntry(name)
    throw e
  }
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
