import { readFileSync } from 'node:fs'
import { expect, test } from './fixtures'

test('loads cross-origin isolated', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Masque' })).toBeVisible()
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)
  // AGPL: users of the hosted app must be able to get the source.
  await expect(page.getByRole('link', { name: 'github.com/onestlatech/masque' })).toHaveAttribute('href', 'https://github.com/onestlatech/masque')
})

test('scales photos down to the iOS canvas limit', async ({ page }) => {
  await page.goto('/')
  const jpeg = await page.evaluate(async () => {
    const ctx = new OffscreenCanvas(6000, 4000).getContext('2d')!
    ctx.fillStyle = '#888'
    ctx.fillRect(0, 0, 6000, 4000)
    return [...new Uint8Array(await (await ctx.canvas.convertToBlob({ type: 'image/jpeg' })).arrayBuffer())]
  })
  await page.locator('input[type=file]').setInputFiles({ name: 'large.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg) })
  const download = page.getByRole('button', { name: 'Download', exact: true })
  await expect(download).toBeEnabled({ timeout: 60_000 })
  expect(await page.locator('canvas').evaluate((c: HTMLCanvasElement) => [c.width, c.height])).toEqual([5016, 3344])
  const [dl] = await Promise.all([page.waitForEvent('download'), download.click()])
  const size = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))]))
    return [bitmap.width, bitmap.height]
  }, readFileSync(await dl.path()).toString('base64'))
  expect(size).toEqual([5016, 3344])
})
