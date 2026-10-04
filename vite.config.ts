/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defaultClientConditions, defineConfig, type Plugin } from 'vite'
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

const modelSha256 = readFileSync('public/models/SHA256SUMS', 'utf8').split(' ')[0]

export default defineConfig({
  plugins: [svelte(), security()],
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
