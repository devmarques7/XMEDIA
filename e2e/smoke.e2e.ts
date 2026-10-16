import { test, expect } from "@playwright/test";

test("a app abre", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/);
});
