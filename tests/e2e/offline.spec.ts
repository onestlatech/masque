import { expect, test } from './fixtures'

test('works offline once loaded', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright cannot navigate offline in WebKit, even to service worker responses')
  await page.goto('/')
  await expect(page.getByText('works without an internet connection')).toBeVisible({ timeout: 60_000 })

  await context.setOffline(true)
  await page.reload()
  // Cached responses keep their headers, so threads stay available offline.
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)
  await page.locator('input[type=file]').setInputFiles(new URL('../fixtures/city.jpg', import.meta.url).pathname)
  await expect(page.locator('summary')).toHaveText(/^[1-9]\d* masks$/, { timeout: 60_000 })
})
