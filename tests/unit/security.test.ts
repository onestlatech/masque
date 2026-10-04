import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { securityHeaders } from '../../security.ts'

test('Caddyfile sends the same security headers as security.ts', () => {
  const caddyfile = readFileSync(new URL('../../deploy/Caddyfile', import.meta.url), 'utf8')
  for (const [name, value] of Object.entries(securityHeaders)) {
    expect(caddyfile).toContain(`${name} "${value}"`)
  }
})
