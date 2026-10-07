import { expect, test } from './fixtures'

test('loads cross-origin isolated', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Masque' })).toBeVisible()
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)
  // AGPL: users of the hosted app must be able to get the source.
  await expect(page.getByRole('link', { name: 'github.com/onestlatech/masque' })).toHaveAttribute('href', 'https://github.com/onestlatech/masque')
})
