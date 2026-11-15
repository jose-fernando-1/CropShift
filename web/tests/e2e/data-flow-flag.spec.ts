import { expect, test } from "./fixtures";

// Matches NO_DATA_FLOW_PORT in playwright.config.ts.
const NO_DATA_FLOW_PORT = Number(process.env.E2E_PORT ?? 3100) + 5;

test.describe("SHOW_DATA_FLOW=false", () => {
  test.skip(!!process.env.E2E_BASE_URL, "needs the second server Playwright starts with the flag off");
  const base = `http://localhost:${NO_DATA_FLOW_PORT}`;

  test("hides the data-flow inspector in mock mode, even with ?debug=1", async ({ page }) => {
    for (const path of ["/", "/?debug=1"]) {
      await page.goto(base + path);
      await expect(page.getByTestId("mock-banner")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: "Cropshift" })).toBeVisible();
      await expect(page.getByTestId("open-inspector")).toHaveCount(0);
    }
  });
});
