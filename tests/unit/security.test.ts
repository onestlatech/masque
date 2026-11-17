import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { csp, securityHeaders } from "../../security.ts";

test("Caddyfile sends the same security headers as security.ts", () => {
  const caddyfile = readFileSync(
    new URL("../../deploy/Caddyfile", import.meta.url),
    "utf8",
  );
  for (const [name, value] of Object.entries(securityHeaders)) {
    expect(caddyfile).toContain(`${name} "${value}"`);
  }
});

// WEBCAT blocks responses whose header differs from the signed policy by a single byte.
test("WEBCAT manifest signs the CSP that security.ts sends", () => {
  const config = JSON.parse(
    readFileSync(new URL("../../webcat.config.json", import.meta.url), "utf8"),
  );
  expect(config.default_csp).toBe(csp);
});
