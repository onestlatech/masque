import { readFileSync } from 'node:fs'
import { expect, test } from './fixtures'

test.use({ launchOptions: { args: ['--enable-unsafe-webgpu'] } })

// Phone GPUs get WebGPU's default limits, which reject the buffers ONNX Runtime needs for large photos.
const defaultLimits = `{
  const requestDevice = GPUAdapter.prototype.requestDevice
  GPUAdapter.prototype.requestDevice = function (descriptor) {
    return requestDevice.call(this, { ...descriptor, requiredLimits: {} })
  }
}
`

test('falls back to the CPU when the GPU rejects a large photo', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only Chromium enables WebGPU from the command line')
  await page.route('**/assets/worker-*.js', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, body: defaultLimits + (await response.text()) })
  })
  await page.goto('/')
  test.skip(!(await page.evaluate(async () => !!(await navigator.gpu?.requestAdapter()))), 'No WebGPU adapter')
  await expect(page.getByText('Detection runs on your GPU')).toBeVisible({ timeout: 60_000 })

  const jpeg = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))]))
    const ctx = new OffscreenCanvas(1900, 1340).getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, 1900, 1340)
    return [...new Uint8Array(await (await ctx.canvas.convertToBlob({ type: 'image/jpeg' })).arrayBuffer())]
  }, readFileSync(new URL('../fixtures/city.jpg', import.meta.url)).toString('base64'))
  await page.locator('input[type=file]').setInputFiles({ name: 'large.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg) })
  await expect(page.locator('summary')).toHaveText(/^[1-9]\d+ masks$/, { timeout: 60_000 })
})
