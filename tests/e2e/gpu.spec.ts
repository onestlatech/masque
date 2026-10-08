import { expect, test } from './fixtures'

test.use({ launchOptions: { args: ['--enable-unsafe-webgpu'] } })

// ONNX Runtime ignores invalid GPU commands, such as a phone GPU rejecting a large buffer, and returns no faces.
const failingGpu = `{
  const createBindGroup = GPUDevice.prototype.createBindGroup
  GPUDevice.prototype.createBindGroup = function (descriptor) {
    const [first, ...rest] = descriptor.entries
    const resource = { ...first.resource, size: first.resource.buffer.size + 256 }
    return createBindGroup.call(this, { ...descriptor, entries: [{ ...first, resource }, ...rest] })
  }
}
`

test('falls back to the CPU when the GPU fails', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only Chromium enables WebGPU from the command line')
  await page.route('**/assets/worker-*.js', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, body: failingGpu + (await response.text()) })
  })
  await page.goto('/')
  test.skip(!(await page.evaluate(async () => !!(await navigator.gpu?.requestAdapter()))), 'No WebGPU adapter')
  await expect(page.getByText('Detection runs on your GPU')).toBeVisible({ timeout: 60_000 })

  await page.locator('input[type=file]').setInputFiles(new URL('../fixtures/city.jpg', import.meta.url).pathname)
  await expect(page.locator('summary')).toHaveText(/^[1-9]\d+ masks$/, { timeout: 60_000 })
})
