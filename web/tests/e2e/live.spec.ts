import { expect, SBU, test } from "./fixtures";

/**
 * Journey against the REAL backend (API_MODE=live). Skipped unless E2E_LIVE=1, because the other specs assert on mock data.
 *   docker compose: API_MODE=live API_ORIGIN=http://api:8000 docker compose --profile live up --build
 *   E2E_LIVE=1 E2E_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/live.spec.ts
 */
test.describe("main journey (live backend)", () => {
  test.skip(process.env.E2E_LIVE !== "1", "set E2E_LIVE=1 and E2E_BASE_URL to a web server in live mode");

  test("example point -> real ranking, no mock markers", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("mock-banner")).toHaveCount(0);
    await page.getByTestId("try-example").click();
    await expect(page.getByTestId("result-municipality")).toHaveText(new RegExp(SBU.name));
    await expect(page).not.toHaveURL(/-8\.6|36\.4/);

    const cards = page.locator('[data-testid^="rank-card-"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId("rank-card-peanut")).toBeVisible();
    await expect(page.getByTestId("excluded-card-castor")).toContainText("Own estimate not reliable");
    await expect(page.getByTestId("explanation-source")).toContainText(/template|ai/);
    await expect(page.getByText("Synthetic mock values")).toHaveCount(0);
  });

  test("a point outside Pernambuco is out of coverage", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: /type coordinates/ }).fill("-12.97, -38.50");
    await page.getByRole("button", { name: "Go" }).click();
    await expect(page.getByTestId("notice-out-of-state")).toBeVisible();
  });
});
