import { readFileSync } from 'node:fs'
import { findBox } from '../../src/lib/media/mp4.ts'
import { expect, test } from './fixtures'

const fixture = new URL('../fixtures/city.mp4', import.meta.url).pathname
const golden: number[][] = JSON.parse(readFileSync(new URL('../fixtures/city.golden.json', import.meta.url), 'utf8'))

test.setTimeout(180_000)

test('exports a masked video without metadata or sound', async ({ page, browserName }) => {
  await page.goto('/')
  const storageAvailable = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    await root.getFileHandle('masque-other-tab.mp4', { create: true })
    return true
  }).catch(() => false)
  if (browserName !== 'webkit') expect(storageAvailable).toBe(true)
  await page.locator('input[type=file]').setInputFiles(fixture)
  await expect(page.getByRole('slider', { name: 'Frame' })).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('summary')).toHaveText(/^[1-9]\d* masks$/)

  await page.getByLabel('Remove sound').check()
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(dl.suggestedFilename()).toMatch(/^masque-[0-9a-f]{8}\.mp4$/)
  const bytes = readFileSync(await dl.path())

  for (const marker of ['Secret title', '48.8566', 'Lavf', 'soun']) expect(bytes.includes(marker), marker).toBe(false)
  expect(readFileSync(fixture).includes('Secret title')).toBe(true)

  const moov = findBox((at, length) => bytes.subarray(at, at + length), bytes.length, 'moov')!
  const mvhd = bytes.indexOf('mvhd', moov.at)
  const version = bytes[mvhd + 4]
  expect([...bytes.subarray(mvhd + 8, mvhd + 8 + (version === 1 ? 16 : 8))].every((b) => b === 0)).toBe(true)

  // The fixture crops city.jpg at x = 40·t, y = 56: confident faces must be black at both times.
  const pixels = await page.evaluate(
    async ({ data, golden }) => {
      const video = document.createElement('video')
      video.muted = true
      video.src = URL.createObjectURL(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: 'video/mp4' }))
      await new Promise((r) => video.addEventListener('loadeddata', r, { once: true }))
      const ctx = new OffscreenCanvas(video.videoWidth, video.videoHeight).getContext('2d')!
      const out: number[] = []
      for (const t of [0, 1]) {
        video.currentTime = t
        await new Promise((r) => video.addEventListener('seeked', r, { once: true }))
        ctx.drawImage(video, 0, 0)
        for (const [x1, y1, x2, y2, score] of golden) {
          const x = Math.round((x1 + x2) / 2 - 40 * t)
          const y = Math.round((y1 + y2) / 2 - 56)
          if (score < 0.5 || x < 10 || x > video.videoWidth - 10 || y < 10) continue
          out.push(Math.max(...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)))
        }
      }
      return out
    },
    { data: bytes.toString('base64'), golden },
  )
  expect(pixels.length).toBeGreaterThan(10)
  for (const p of pixels) expect(p).toBeLessThan(40)
  const stored = () => page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const files: string[] = []
    for await (const key of root.keys()) files.push(key)
    return files.sort()
  })
  if (storageAvailable) expect(await stored()).toEqual([expect.stringMatching(/^masque-[0-9a-f]{8}\.mp4$/), 'masque-other-tab.mp4'])
  await page.getByRole('button', { name: 'Open another file' }).click()
  // Deletion waits for the download grace period.
  if (storageAvailable) await expect.poll(stored, { timeout: 20_000 }).toEqual(['masque-other-tab.mp4'])
})

test('scrubs frames and adds a mask spanning the video', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(fixture)
  const slider = page.getByRole('slider', { name: 'Frame' })
  await expect(slider).toBeVisible({ timeout: 120_000 })

  await slider.fill('15')
  await expect(page.locator('.timeline output')).toHaveText('0:01.00')

  const canvas = page.locator('canvas')
  await canvas.evaluate((e) => e.scrollIntoView())
  const box = (await canvas.boundingBox())!
  const count = await page.locator('[data-box]').count()
  await page.mouse.move(box.x + box.width - 60, box.y + box.height - 60)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 20, box.y + box.height - 20, { steps: 4 })
  await page.mouse.up()
  await expect(page.locator('[data-box]')).toHaveCount(count + 1)
  await expect(page.getByText(/Selected mask: frames 0–29/)).toBeVisible()

  await page.getByRole('button', { name: 'Ends here' }).click()
  await expect(page.getByText('Selected mask: frames 0–15')).toBeVisible()
})

test('mask range buttons follow the displayed frame during a pending seek', async ({ page }) => {
  await page.addInitScript(() => {
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (message, transfer) {
      if (message.type === 'frame' && message.timestamp > 0) return
      post.call(this, message, Array.isArray(transfer) ? { transfer } : transfer)
    }
  })
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(fixture)
  const slider = page.getByRole('slider', { name: 'Frame' })
  await expect(slider).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('summary')).toHaveText(/^[1-9]\d* masks$/)
  const canvas = page.locator('canvas')
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + box.width - 60, box.y + box.height - 60)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 20, box.y + box.height - 20)
  await page.mouse.up()
  await expect(page.getByText('Selected mask: frames 0–29')).toBeVisible()

  await slider.fill('15')
  await expect(page.locator('.timeline output')).toHaveText('0:00.00')
  await page.getByRole('button', { name: 'Starts here' }).click()
  await expect(page.getByText('Selected mask: frames 0–29')).toBeVisible()
  await page.getByRole('button', { name: 'Ends here' }).click()
  await expect(page.getByText('Selected mask: frames 0–0')).toBeVisible()
})
