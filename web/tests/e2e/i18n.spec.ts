import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test.describe("language", () => {
  test("defaults to English and switches to pt-BR, results and all", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));

    await page.goto("/?mun=2613008");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId("rank-card-cowpea")).toContainText("Cowpea");

    await page.getByTestId("language-switcher").getByRole("radio", { name: "Português (Brasil)" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page).toHaveTitle(/o que plantar e quando/);
    await expect(page.getByRole("heading", { name: "Ranking das culturas" })).toBeVisible();
    // API-generated text arrives in pt-BR too (Accept-Language), not just the UI chrome.
    await expect(page.getByTestId("rank-card-cowpea")).toContainText("Feijão-caupi");
    await expect(page.getByTestId("excluded-card-castor")).toContainText("Estimativa própria não confiável");
    await expect(page.getByText("Limites destes resultados")).toBeVisible();
    await expect(page.getByTestId("explanation-source")).toContainText("modelo de texto");
    await expect(page.getByTestId("mock-banner")).toContainText("Dados de demonstração");

    // The choice survives a reload.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page.getByTestId("rank-card-cowpea")).toContainText("Feijão-caupi");

    // And switching back restores English results.
    await page.getByTestId("language-switcher").getByRole("radio", { name: "English" }).click();
    await expect(page.getByTestId("rank-card-cowpea")).toContainText("Cowpea");

    expect(errors.filter((e) => !/tile\.openstreetmap|net::ERR_FAILED/.test(e))).toEqual([]);
  });

  test("pt-BR error copy and decimal-comma coordinates", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("language-switcher").getByRole("radio", { name: "Português (Brasil)" }).click();
    const input = page.getByRole("textbox", { name: /digite as coordenadas/ });
    await input.fill("-12,97; -38,50");
    await page.getByRole("button", { name: "Ir" }).click();
    await expect(page.getByTestId("notice-out-of-state")).toContainText("Fora de Pernambuco");
    await input.fill("-8,60; -36,40");
    await page.getByRole("button", { name: "Ir" }).click();
    await expect(page.getByTestId("result-municipality")).toHaveText(/São Bento do Una/);
  });

  test("no serious accessibility violations in pt-BR", async ({ page }) => {
    await page.goto("/?mun=2613008");
    await page.getByTestId("language-switcher").getByRole("radio", { name: "Português (Brasil)" }).click();
    await expect(page.getByTestId("rank-card-cowpea")).toContainText("Feijão-caupi");
    await expect(page.getByTestId("explanation-source")).toBeVisible();
    const results = await new AxeBuilder({ page }).exclude(".leaflet-container").analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} nodes`)).toEqual([]);
  });
});
