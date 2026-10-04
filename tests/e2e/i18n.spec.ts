import { expect, test } from './fixtures'

test.use({ locale: 'fr-FR' })

test('speaks French to French browsers and remembers the choice', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.getByText('Choisissez des photos ou une vidéo')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(new URL('../fixtures/city.jpg', import.meta.url).pathname)
  await expect(page.locator('summary')).toHaveText(/^\d+ masques$/, { timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Télécharger' })).toBeVisible()
  await expect(page.getByText('0,20')).toBeVisible()

  await page.getByLabel('Langue').selectOption('en')
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  await page.reload()
  await expect(page.getByText('Choose photos or a video')).toBeVisible()
})
