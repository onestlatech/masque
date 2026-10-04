/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defaultClientConditions, defineConfig, transformWithOxc, type Plugin, type ResolvedConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { isolationHeaders, metaCsp, securityHeaders } from './security.ts'

// Hosts without header support still get the CSP through <meta>; _headers covers Cloudflare Pages and Netlify.
function security(): Plugin {
  return {
    name: 'masque:security',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: metaCsp },
        injectTo: 'head-prepend',
      },
    ],
    generateBundle() {
      const lines = Object.entries(securityHeaders).map(([k, v]) => `  ${k}: ${v}`)
      this.emitFile({ type: 'asset', fileName: '_headers', source: `/*\n${lines.join('\n')}\n` })
    },
  }
}

// Compiles src/sw.ts to a classic script (module service workers are not universal) listing every built file.
function serviceWorker(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'masque:service-worker',
    apply: 'build',
    configResolved(c) {
      config = c
    },
    async closeBundle() {
      const outDir = config.build.outDir
      const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
        .filter((f) => f.isFile())
        .map((f) => relative(outDir, join(f.parentPath, f.name)).split('\\').join('/'))
        .filter((f) => f !== '_headers' && f !== 'sw.js')
        .sort()
      const precache = files.map((f) => (f === 'index.html' ? config.base : config.base + f))
      const hash = createHash('sha256')
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)))
      const { code } = await transformWithOxc(readFileSync('src/sw.ts', 'utf8'), 'sw.ts')
      writeFileSync(
        join(outDir, 'sw.js'),
        code
          .replace('__PRECACHE__', JSON.stringify(precache))
          .replace('__VERSION__', JSON.stringify(hash.digest('hex').slice(0, 16))),
      )
    },
  }
}

const modelSha256 = readFileSync('public/models/SHA256SUMS', 'utf8').split(' ')[0]

export default defineConfig({
  plugins: [svelte(), security(), serviceWorker()],
  define: {
    __MODEL_INTEGRITY__: JSON.stringify(`sha256-${Buffer.from(modelSha256, 'hex').toString('base64')}`),
  },
  // ONNX Runtime threads start from its standalone glue file: from a bundled chunk they would re-run our worker code.
  resolve: { conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions] },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  server: { headers: isolationHeaders },
  preview: { headers: securityHeaders },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
