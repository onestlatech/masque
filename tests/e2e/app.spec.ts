import { expect, test } from './fixtures'

test('loads cross-origin isolated', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Masque' })).toBeVisible()
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)
})
