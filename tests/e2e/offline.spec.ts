import { expect, test } from './fixtures'

test('works offline once loaded', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright cannot navigate offline in WebKit, even to service worker responses')
  await page.addInitScript(async () => {
    const cache = await caches.open('another-app')
    await cache.put('/', new Response('Unrelated cached page'))
  })
  await page.goto('/')
  await expect(page.getByText('works without an internet connection')).toBeVisible({ timeout: 60_000 })
  expect(await page.evaluate(() => caches.has('another-app'))).toBe(true)

  await context.setOffline(true)
  await page.reload()
  // Cached responses keep their headers, so threads stay available offline.
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true)
  await page.locator('input[type=file]').setInputFiles(new URL('../fixtures/city.jpg', import.meta.url).pathname)
  await expect(page.locator('summary')).toHaveText(/^[1-9]\d* masks$/, { timeout: 60_000 })
})
