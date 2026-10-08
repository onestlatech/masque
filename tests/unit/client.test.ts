import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Engine } from '../../src/lib/detect/client.ts'

class WorkerMock extends EventTarget {
  static current: WorkerMock
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() {
    super()
    WorkerMock.current = this
  }
}

beforeEach(() => vi.stubGlobal('Worker', WorkerMock))
afterEach(() => vi.unstubAllGlobals())

test('already cancelled work never reaches the worker', async () => {
  const engine = new Engine()
  await expect(engine.call('init', {}, { signal: AbortSignal.abort() })).rejects.toThrow()
  expect(WorkerMock.current.postMessage).not.toHaveBeenCalled()
})

test('completed work removes its abort listener', async () => {
  const engine = new Engine()
  const controller = new AbortController()
  const pending = engine.call('init', {}, { signal: controller.signal })
  WorkerMock.current.dispatchEvent(new MessageEvent('message', { data: { id: 0, result: 'wasm' } }))
  await expect(pending).resolves.toBe('wasm')
  controller.abort()
  expect(WorkerMock.current.postMessage).toHaveBeenCalledTimes(1)
})

test('a cloning failure removes its abort listener', async () => {
  const engine = new Engine()
  const controller = new AbortController()
  WorkerMock.current.postMessage.mockImplementationOnce(() => { throw new Error('Cannot clone') })
  await expect(engine.call('init', {}, { signal: controller.signal })).rejects.toThrow('Cannot clone')
  controller.abort()
  expect(WorkerMock.current.postMessage).toHaveBeenCalledTimes(1)
})
