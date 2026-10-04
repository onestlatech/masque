/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
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

export default defineConfig({
  plugins: [svelte(), security()],
  server: { headers: isolationHeaders },
  preview: { headers: securityHeaders },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
