// Fills in the colors of src/lib/anonymize/emojis.ts. Run on macOS, where Chromium draws Apple Color Emoji.
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const path = new URL("../src/lib/anonymize/emojis.ts", import.meta.url);
const line = /^ {2}"(.+)": "#[0-9a-f]{6}",$/gmu;
const source = readFileSync(path, "utf8");
const emojis = [...source.matchAll(line)].map((m) => m[1]);

const browser = await chromium.launch();
const page = await browser.newPage();
const colors = await page.evaluate((emojis) => {
  const size = 128;
  const ctx = new OffscreenCanvas(size, size).getContext("2d", {
    willReadFrequently: true,
  });
  ctx.font = `${size * 0.75}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const hex = (v) => Math.round(v).toString(16).padStart(2, "0");
  return emojis.map((emoji) => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillText(emoji, size / 2, size / 2);
    const { data } = ctx.getImageData(0, 0, size, size);
    // Coarse buckets, so that a gradient counts as one color; the most common one wins.
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 250) continue;
      const key =
        (data[i] >> 5) * 64 + (data[i + 1] >> 5) * 8 + (data[i + 2] >> 5);
      const b = buckets.get(key) ?? [0, 0, 0, 0];
      b[0] += data[i];
      b[1] += data[i + 1];
      b[2] += data[i + 2];
      b[3]++;
      buckets.set(key, b);
    }
    const [r, g, b, n] = [...buckets.values()].reduce((a, b) =>
      b[3] > a[3] ? b : a,
    );
    return `#${hex(r / n)}${hex(g / n)}${hex(b / n)}`;
  });
}, emojis);
await browser.close();

let i = 0;
writeFileSync(
  path,
  source.replace(line, (_, emoji) => `  "${emoji}": "${colors[i++]}",`),
);
