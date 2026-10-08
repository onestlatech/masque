import type { Request, Requests, Response } from './worker.ts'

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; cleanup: () => void; onProgress?: (p: number) => void }

export interface CallOptions {
  transfer?: Transferable[]
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/** Main-thread handle on the worker that runs detection and video processing. */
export class Engine {
  private worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  private pending = new Map<number, Pending>()
  private nextId = 0

  constructor() {
    this.worker.addEventListener('message', ({ data }: MessageEvent<Response>) => {
      const p = this.pending.get(data.id)
      if (!p) return
      if ('progress' in data) return p.onProgress?.(data.progress)
      this.pending.delete(data.id)
      p.cleanup()
      if ('error' in data) p.reject(new Error(data.error))
      else p.resolve(data.result)
    })
  }

  call<K extends keyof Requests>(type: K, args: Requests[K]['args'], options: CallOptions = {}): Promise<Requests[K]['result']> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      options.signal?.throwIfAborted()
      const abort = () => this.worker.postMessage({ id: this.nextId++, type: 'cancel', target: id } satisfies Request)
      const cleanup = () => options.signal?.removeEventListener('abort', abort)
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, cleanup, onProgress: options.onProgress })
      options.signal?.addEventListener('abort', abort, { once: true })
      try {
        this.worker.postMessage({ id, type, ...args }, options.transfer ?? [])
      } catch (e) {
        cleanup()
        this.pending.delete(id)
        reject(e)
      }
    })
  }
}
