import { readFileSync } from 'node:fs'
import { expect, test } from './fixtures'

const fixture = new URL('../fixtures/city.jpg', import.meta.url).pathname

test('mosaic replaces semitransparent source pixels', async ({ page }) => {
  await page.goto('/')
  const png = await page.evaluate(async () => {
    const ctx = new OffscreenCanvas(128, 128).getContext('2d')!
    for (let x = 0; x < 128; x++) {
      ctx.fillStyle = x % 2 ? 'rgba(255,0,0,0.5)' : 'rgba(0,0,255,0.5)'
      ctx.fillRect(x, 0, 1, 128)
    }
    return [...new Uint8Array(await (await ctx.canvas.convertToBlob()).arrayBuffer())]
  })
  await page.locator('input[type=file]').setInputFiles({ name: 'stripes.png', mimeType: 'image/png', buffer: Buffer.from(png) })
  const download = page.getByRole('button', { name: 'Download', exact: true })
  await expect(download).toBeEnabled({ timeout: 60_000 })
  await page.getByLabel('Style').selectOption('mosaic')
  await page.getByLabel('Oval masks').uncheck()
  const canvas = page.locator('canvas')
  await canvas.scrollIntoViewIfNeeded()
  const bounds = (await canvas.boundingBox())!
  await page.mouse.move(bounds.x + 5, bounds.y + 5)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width - 5, bounds.y + bounds.height - 5)
  await page.mouse.up()
  const [dl] = await Promise.all([page.waitForEvent('download'), download.click()])
  const bytes = readFileSync(await dl.path())
  const pixels = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))]))
    const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    return [...ctx.getImageData(60, 60, 2, 1).data]
  }, bytes.toString('base64'))
  expect(Math.abs(pixels[0] - pixels[4])).toBeLessThan(5)
  expect(Math.abs(pixels[2] - pixels[6])).toBeLessThan(5)
  expect(pixels[3]).toBeLessThan(135)
})

test('transparent photos do not inherit detections from a previous photo', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(fixture)
  await expect(page.locator('summary')).toHaveText(/^[1-9]\d* masks$/, { timeout: 60_000 })
  const png = await page.locator('canvas').evaluate(async (canvas: HTMLCanvasElement) => {
    const blank = new OffscreenCanvas(canvas.width, canvas.height)
    blank.getContext('2d')
    return [...new Uint8Array(await (await blank.convertToBlob()).arrayBuffer())]
  })
  await page.getByRole('button', { name: 'Start over' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'transparent.png', mimeType: 'image/png', buffer: Buffer.from(png) })
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeEnabled({ timeout: 60_000 })
  await expect(page.locator('summary')).toHaveText('0 masks')
})
