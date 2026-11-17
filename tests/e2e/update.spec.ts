import { expect, test } from "./fixtures";

test("updates to a new version", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("works without an internet connection"),
  ).toBeVisible({ timeout: 60_000 });
  await page.reload();
  // The app registers /sw.js once the detector is ready: registering later would replace the new version.
  await expect(page.getByText("Detection runs on your")).toBeVisible({
    timeout: 60_000,
  });
  const banner = page.getByRole("status").filter({ hasText: "new version" });
  await expect(banner).toBeHidden();

  // A different script URL stands for a new deployment.
  await page.evaluate(() => navigator.serviceWorker.register("/sw.js?v=2"));
  await banner.getByRole("button", { name: "Update" }).click();
  await page.waitForFunction(() =>
    navigator.serviceWorker.controller?.scriptURL.endsWith("?v=2"),
  );
});
