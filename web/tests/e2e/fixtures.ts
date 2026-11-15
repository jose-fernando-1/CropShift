import { test as base, expect } from "@playwright/test";

/** Blocks OpenStreetMap tiles so tests never depend on the network. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
    await provide(page);
  },
});

export { expect };

export const SBU = { lat: -8.6, lon: -36.4, name: "São Bento do Una" };
