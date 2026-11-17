import { expect, test } from "vitest";
import {
  defaultPlacement,
  moveWatermark,
  watermarkRect,
} from "../../src/lib/watermark.ts";

const image = { width: 1000, height: 500 };
const mark = { width: 200, height: 100 };

test("the default watermark sits in the bottom-right corner", () => {
  // 20% of the 500 px side, 15 px from the edges.
  expect(watermarkRect(image, mark, defaultPlacement)).toEqual({
    x: 885,
    y: 435,
    width: 100,
    height: 50,
  });
});

test("dragging stops at the margins", () => {
  const p = moveWatermark(image, mark, defaultPlacement, -435, -1000);
  expect(p).toMatchObject({ x: 0.5, y: 0 });
  expect(watermarkRect(image, mark, p)).toMatchObject({ x: 450, y: 15 });
});
