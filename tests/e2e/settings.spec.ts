import { expect, test } from "./fixtures";

const fixture = new URL("../fixtures/city.jpg", import.meta.url).pathname;

const open = async (page: import("@playwright/test").Page) => {
  await page.locator("input[type=file]").setInputFiles(fixture);
  await expect(
    page.getByRole("button", { name: "Download", exact: true }),
  ).toBeEnabled({ timeout: 60_000 });
};

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
