import { readFileSync } from 'node:fs'
import { expect, test } from './fixtures'

const fixture = new URL('../fixtures/city.jpg', import.meta.url).pathname
const golden: number[][] = JSON.parse(readFileSync(new URL('../fixtures/city.golden.json', import.meta.url), 'utf8'))

type Box = [x1: number, y1: number, x2: number, y2: number, score: number]

const iou = (a: Box | number[], b: Box | number[]) => {
  const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]))
  const h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
  const inter = w * h
  return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(fixture)
  await expect(page.locator('summary')).toHaveText(/^[1-9]\d* masks$/, { timeout: 60_000 })
})

test('finds the same faces as deface', async ({ page }) => {
  const boxes = (await page.locator('[data-box]').evaluateAll((els) => els.map((e) => e.getAttribute('data-box')!))).map(
    (s) => s.split(',').map(Number),
  )
  // Scores near the threshold can flip between implementations.
  expect(Math.abs(boxes.length - golden.length)).toBeLessThanOrEqual(2)
  // Resizing differs slightly from OpenCV: a 2 px shift on a 12 px face already costs 0.3 IoU.
  const best = golden.filter((g) => g[4] >= 0.3).map((g) => Math.max(...boxes.map((b) => iou(b, g))))
  for (const b of best) expect(b).toBeGreaterThan(0.5)
  expect(best.reduce((a, b) => a + b) / best.length).toBeGreaterThan(0.85)
})

test('downloads a masked image without metadata', async ({ page }) => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  expect(dl.suggestedFilename()).toMatch(/^masque-[0-9a-f]{8}\.jpg$/)
  const bytes = readFileSync(await dl.path())
  for (const marker of ['Exif', 'Photoshop', 'ICC_PROFILE', 'http://ns.adobe.com']) expect(bytes.includes(marker), marker).toBe(false)
  expect(readFileSync(fixture).includes('Exif')).toBe(true)

  // Solid masks: the center of every confident face is black.
  const centers = golden.filter((g) => g[4] >= 0.5).map((g) => [Math.round((g[0] + g[2]) / 2), Math.round((g[1] + g[3]) / 2)])
  const pixels = await page.evaluate(
    async ({ data, centers }) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))]))
      const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      return centers.map(([x, y]) => Math.max(...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)))
    },
    { data: bytes.toString('base64'), centers },
  )
  for (const p of pixels) expect(p).toBeLessThan(16)
})

test('removes a mask with the keyboard and adds one by dragging', async ({ page }) => {
  const masks = page.locator('[data-box]')
  const count = await masks.count()

  await page.locator('summary').click()
  await page.getByRole('button', { name: 'Remove mask 1', exact: true }).click()
  await expect(masks).toHaveCount(count - 1)

  const canvas = page.locator('canvas')
  await canvas.evaluate((e) => e.scrollIntoView())
  const box = (await canvas.boundingBox())!
  // Top-left sky: no faces there.
  await page.mouse.move(box.x + 5, box.y + 5)
  await page.mouse.down()
  await page.mouse.move(box.x + 40, box.y + 40, { steps: 4 })
  await page.mouse.up()
  await expect(masks).toHaveCount(count)
  await expect(page.getByRole('button', { name: 'Manual mask' })).toBeVisible()

  await canvas.press('Delete')
  await expect(masks).toHaveCount(count - 1)
})
