import type { Detection } from './centerface.ts'
import type { Backend } from './detector.ts'
import type { TilingOptions } from './tiling.ts'
import type { Request, Response } from './worker.ts'

type Pending = { resolve: (v: never) => void; reject: (e: Error) => void }

/** Main-thread handle on the detection worker. */
export class DetectorClient {
  private worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  private pending = new Map<number, Pending>()
  private nextId = 0

  constructor() {
    this.worker.addEventListener('message', ({ data }: MessageEvent<Response>) => {
      const p = this.pending.get(data.id)!
      this.pending.delete(data.id)
      if ('error' in data) p.reject(new Error(data.error))
      else p.resolve(data.result as never)
    })
  }

  /** Loads the model; resolves with the backend in use. */
  init(): Promise<Backend> {
    return this.call({ id: this.nextId++, type: 'init' })
  }

  /** Takes ownership of the image and closes it. */
  detect(image: ImageBitmap | VideoFrame, threshold: number, tiling?: TilingOptions): Promise<Detection[]> {
    return this.call({ id: this.nextId++, type: 'detect', image, threshold, tiling }, [image])
  }

  private call<T>(request: Request, transfer: Transferable[] = []): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.set(request.id, { resolve: resolve as (v: never) => void, reject })
      this.worker.postMessage(request, transfer)
    })
  }
}
