import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'
import { expect, test } from './fixtures'

const photo = readFileSync(new URL('../fixtures/city.jpg', import.meta.url))

test('masks several photos and downloads them as one zip', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles([
    { name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: photo },
    { name: 'IMG_0002.jpg', mimeType: 'image/jpeg', buffer: photo },
  ])
  const download = page.getByRole('button', { name: /Download all \(2 photos/ })
  await expect(download).toBeEnabled({ timeout: 60_000 })

  await page.getByRole('button', { name: /^2/ }).click()
  await expect(page.locator('summary')).toHaveText(/^[1-9]\d* masks$/)

  const [dl] = await Promise.all([page.waitForEvent('download'), download.click()])
  expect(dl.suggestedFilename()).toMatch(/^masque-[0-9a-f]{8}\.zip$/)
  const bytes = readFileSync(await dl.path())
  const entries = unzipSync(bytes)
  expect(Object.keys(entries)).toEqual(['001.jpg', '002.jpg'])
  for (const data of Object.values(entries)) expect(Buffer.from(data).includes('Exif')).toBe(false)
  expect(bytes.includes('IMG_0001')).toBe(false)
})

test('refuses several videos at once', async ({ page }) => {
  const video = readFileSync(new URL('../fixtures/city.mp4', import.meta.url))
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles([
    { name: 'a.mp4', mimeType: 'video/mp4', buffer: video },
    { name: 'b.jpg', mimeType: 'image/jpeg', buffer: photo },
  ])
  await expect(page.getByRole('alert')).toHaveText('Open videos one at a time: each needs its own review.')
})
