import AxeBuilder from "@axe-core/playwright";
import { expect, SBU, test } from "./fixtures";

test.describe("main journey (mock mode)", () => {
  test("example point -> ranking -> crop detail", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("mock-banner")).toBeVisible();
    await expect(page.getByTestId("empty-state")).toBeVisible();
    // One application version in the header (hidden below the sm breakpoint).
    if (test.info().project.name === "desktop") await expect(page.getByTestId("app-version")).toHaveText(/^v\d+\.\d+\.\d+$/);

    await page.getByTestId("try-example").click();
    await expect(page.getByTestId("result-municipality")).toHaveText(new RegExp(SBU.name));
    await expect(page).toHaveURL(/mun=2613008/);
    await expect(page).not.toHaveURL(/-8\.6|36\.4/); // coordinates never go in the URL
    await expect(page.getByTestId("result-coordinates")).toHaveText("-8.6000, -36.4000");
    await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
    await expect(page.getByText(/^csm_/)).toHaveCount(0); // no analysis-id button

    const cards = page.locator('[data-testid^="rank-card-"]');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toHaveAttribute("data-testid", "rank-card-cowpea");
    await expect(page.getByTestId("excluded-card-castor")).toContainText("Own estimate not reliable");
    await expect(page.getByText("Limits of these results")).toBeVisible();
    await expect(page.getByTestId("explanation-source")).toContainText("template");

    await page.getByRole("button", { name: "Details, chart and sources for Cowpea" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("img", { name: /Cowpea: probability of success/ })).toBeVisible();
    await expect(sheet.getByText("What the municipality actually harvested")).toBeVisible();
    const requirements = sheet.getByTestId("crop-requirements");
    await expect(requirements.getByRole("heading", { name: "Crop requirements" })).toBeVisible();
    await expect(requirements.getByRole("row", { name: /Depletion fraction p.*0\.45/ })).toBeVisible();
    await expect(requirements.getByRole("row", { name: /Optimal temperature\s*25–35 °C/ })).toBeVisible();
    const axe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    await expect(page).toHaveURL(/crop=cowpea/);
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(page).not.toHaveURL(/crop=/);
    await expect(page.getByTestId("mock-banner")).toBeVisible();
  });

  test("municipality search", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Search a municipality" }).fill("petrol");
    await page.getByRole("option", { name: "Petrolina" }).click();
    await expect(page.getByTestId("result-municipality")).toHaveText(/Petrolina/);
    await expect(page).toHaveURL(/mun=2611101/);
  });

  test("typed coordinates, inside and outside Pernambuco", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox", { name: /type coordinates/ });
    await input.fill("-12.97, -38.50");
    await page.getByRole("button", { name: "Go" }).click();
    await expect(page.getByTestId("notice-out-of-state")).toBeVisible();
    await expect(page.getByTestId("empty-state")).toBeVisible();

    await input.fill(`${SBU.lat}, ${SBU.lon}`);
    await page.getByRole("button", { name: "Go" }).click();
    await expect(page.getByTestId("result-municipality")).toHaveText(new RegExp(SBU.name));
  });

  test("invalid coordinates are rejected in the form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: /type coordinates/ }).fill("north of here");
    await page.getByRole("button", { name: "Go" }).click();
    await expect(page.getByText(/decimal degrees/)).toBeVisible();
  });

  test("irrigated regime: crops without ZARC say so", async ({ page }) => {
    await page.goto("/?mun=2613008");
    await expect(page.locator('[data-testid^="rank-card-"]')).toHaveCount(3);
    await page.getByRole("radio", { name: "Irrigated" }).click();
    await expect(page).toHaveURL(/regime=irrigated/);
    await expect(page.getByText("No ZARC to compare").first()).toBeVisible();
    await expect(page.getByText("Irrigated", { exact: true }).first()).toBeVisible();
  });

  test("no serious accessibility violations on the result page", async ({ page }) => {
    await page.goto("/?mun=2613008");
    await expect(page.locator('[data-testid^="rank-card-"]')).toHaveCount(3);
    await expect(page.getByTestId("explanation-source")).toBeVisible();
    await expect(page.getByTestId("result-coordinates")).toHaveText(/^-8\.\d{4}, -36\.\d{4}$/); // municipality centre
    const results = await new AxeBuilder({ page }).exclude(".leaflet-container").analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} nodes`)).toEqual([]);
  });
});

test.describe("geolocation", () => {
  test("denied permission shows a fallback notice", async ({ page, context }) => {
    await context.clearPermissions();
    await page.addInitScript(() => {
      // Deterministic denial regardless of browser defaults.
      navigator.geolocation.getCurrentPosition = (_ok, fail) =>
        fail?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "denied" } as GeolocationPositionError);
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.getByRole("dialog", { name: "Use your location?" })).toBeVisible();
    await page.getByRole("button", { name: "Allow and continue" }).click();
    await expect(page.getByTestId("notice-gps-denied")).toBeVisible();
  });

  test("granted permission resolves the point", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: SBU.lat, longitude: SBU.lon });
    await page.goto("/");
    await page.getByRole("button", { name: "Use my location" }).click();
    await page.getByRole("button", { name: "Allow and continue" }).click();
    await expect(page.getByTestId("selected-location")).toContainText("your point");
    await expect(page.getByTestId("result-municipality")).toHaveText(new RegExp(SBU.name));
  });
});

test.describe("failure scenarios via the data-flow inspector", () => {
  async function setScenario(page: import("@playwright/test").Page, value: string) {
    await page.getByTestId("open-inspector").click();
    await page.getByTestId("scenario-select").selectOption(value);
    await page.getByRole("button", { name: "Close" }).click();
  }

  test("POWER down: API unavailable with retry", async ({ page }) => {
    await page.goto("/");
    await setScenario(page, "power_down");
    await page.getByTestId("try-example").click();
    const error = page.getByTestId("error-upstream_unavailable");
    await expect(error).toBeVisible();
    await expect(error.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("explanation service down: browser template fallback", async ({ page }) => {
    await page.goto("/");
    await setScenario(page, "explain_down");
    await page.getByTestId("try-example").click();
    await expect(page.getByTestId("explanation-source")).toContainText("in your browser");
    await expect(page.getByTestId("explanation")).toContainText("Cowpea");
  });

  test("inspector logs calls with contract checks", async ({ page }) => {
    await page.goto("/?mun=2613008");
    await expect(page.locator('[data-testid^="rank-card-"]')).toHaveCount(3);
    await page.getByTestId("open-inspector").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("/api/v1/recommendations", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("matches contract").first()).toBeVisible();
  });
});
