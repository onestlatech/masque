const directives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'worker-src': ["'self'"],
  'connect-src': ["'self'"],
  'img-src': ["'self'", 'blob:', 'data:'],
  'media-src': ["'self'", 'blob:'],
  'style-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
  'require-trusted-types-for': ["'script'"],
  'trusted-types': ['svelte-trusted-html', 'default'],
}

const serialize = (d: Record<string, string[]>) =>
  Object.entries(d)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ')

export const csp = serialize(directives)

// Browsers ignore frame-ancestors in <meta> and log an error.
const { 'frame-ancestors': _, ...metaDirectives } = directives
export const metaCsp = serialize(metaDirectives)

export const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export const securityHeaders = {
  'Content-Security-Policy': csp,
  ...isolationHeaders,
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), usb=(), serial=(), bluetooth=(), payment=()',
}
