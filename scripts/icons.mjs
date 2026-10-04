// Rasterizes public/icon.svg to the PNG sizes that home screens require. Usage: node scripts/icons.mjs
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  // iOS rounds the corners itself and fills transparency with black.
  const source = size === 180 ? svg.replace('rx="112"', 'rx="0"') : svg
  await page.setContent(`<body style="margin:0">${source.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`)
  await page.screenshot({ path: new URL(`../public/icon-${size}.png`, import.meta.url).pathname, omitBackground: true })
}
await browser.close()
