import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const fixture = new URL("../fixtures/city.jpg", import.meta.url).pathname;

// Settings show up while faces are detected: tests that reload do not wait for detection, which can stall then.
const open = (page: Page) =>
  page.locator("input[type=file]").setInputFiles(fixture);

const detected = (page: Page) =>
  expect(
    page.getByRole("button", { name: "Download", exact: true }),
  ).toBeEnabled({ timeout: 60_000 });

type Point = [x: number, y: number];

/** RGB of the downloaded photo at each point. */
async function exported(page: Page, points: Point[]) {
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download", exact: true }).click(),
  ]);
  return page.evaluate(
    async ({ data, points }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))]),
      );
      const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext(
        "2d",
      )!;
      ctx.drawImage(bitmap, 0, 0);
      return points.map(([x, y]) => [
        ...ctx.getImageData(x, y, 1, 1).data.slice(0, 3),
      ]);
    },
    { data: readFileSync(await dl.path()).toString("base64"), points },
  );
}

/** RGB of the editor's canvas at each point. */
const previewed = (page: Page, points: Point[]) =>
  page
    .locator("canvas")
    .evaluate(
      (c: HTMLCanvasElement, points) =>
        points.map(([x, y]) => [
          ...c.getContext("2d")!.getImageData(x, y, 1, 1).data.slice(0, 3),
        ]),
      points,
    );

test("remembers settings until they are reset", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await page.getByLabel("Style").selectOption("mosaic");
  await page.getByLabel("Oval masks").uncheck();

  await page.reload();
  await open(page);
  await expect(page.getByLabel("Style")).toHaveValue("mosaic");
  await expect(page.getByLabel("Oval masks")).not.toBeChecked();

  await page.getByRole("button", { name: "Reset settings" }).click();
  await expect(page.getByLabel("Style")).toHaveValue("solid");
  await expect(page.getByLabel("Oval masks")).toBeChecked();
  await page.reload();
  await open(page);
  await expect(page.getByLabel("Style")).toHaveValue("solid");
});

test("an emoji comes with a matching background color", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await page.getByLabel("Style").selectOption("emoji");
  await page.getByText("🐼", { exact: true }).click();
  await expect(page.getByLabel("Background color")).toHaveValue("#edecec");
});

test("watermarks photos where the user drags it", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await detected(page);
  const png = await page.evaluate(async () => {
    const ctx = new OffscreenCanvas(100, 100).getContext("2d")!;
    ctx.fillStyle = "#f00";
    ctx.fillRect(0, 0, 100, 100);
    return [
      ...new Uint8Array(await (await ctx.canvas.convertToBlob()).arrayBuffer()),
    ];
  });
  await page.getByLabel("Add an image…").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from(png),
  });
  await page.getByLabel("Opacity").fill("1");
  // city.jpg is 800 × 564: the 113 px watermark sits 17 px from the corner.
  const corners: Point[] = [
    [726, 490],
    [73, 73],
  ];
  const red = ([r, g, b]: number[]) => r > 200 && g < 50 && b < 50;
  expect((await exported(page, corners)).map(red)).toEqual([true, false]);

  const masks = await page.locator("[data-box]").count();
  const canvas = page.locator("canvas");
  await canvas.evaluate((e) => e.scrollIntoView());
  const box = (await canvas.boundingBox())!;
  const scale = box.width / 800;
  await page.mouse.move(box.x + 726 * scale, box.y + 490 * scale);
  await page.mouse.down();
  await page.mouse.move(box.x, box.y, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator("[data-box]")).toHaveCount(masks);
  expect((await previewed(page, corners)).map(red)).toEqual([false, true]);

  await page.reload();
  await open(page);
  await expect(
    page.getByRole("img", { name: "Watermark image" }),
  ).toBeVisible();
  await expect
    .poll(async () => (await previewed(page, corners)).map(red))
    .toEqual([false, true]);
});
