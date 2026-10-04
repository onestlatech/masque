import { test as base, expect } from '@playwright/test'

// Every test fails if the page contacts another origin or violates the CSP.
export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page, baseURL }, use) => {
      const foreign: string[] = []
      page.on('request', (r) => {
        const url = new URL(r.url())
        if (url.origin !== baseURL && url.protocol !== 'blob:' && url.protocol !== 'data:') foreign.push(r.url())
      })

      const violations: string[] = []
      await page.exposeFunction('__cspViolation', (v: string) => violations.push(v))
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) =>
          (window as unknown as { __cspViolation: (v: string) => void }).__cspViolation(
            `${e.violatedDirective} ${e.blockedURI}`,
          ),
        )
      })

      await use()

      expect(foreign, 'requests to other origins').toEqual([])
      expect(violations, 'CSP violations').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
