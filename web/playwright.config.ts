import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
/** Second server from the same build with SHOW_DATA_FLOW=false (tests/e2e/data-flow-flag.spec.ts). */
const NO_DATA_FLOW_PORT = PORT + 5;

/**
 * E2E against the production build in mock mode. Map tiles are blocked in
 * the tests so runs are hermetic. Set E2E_BASE_URL to test a running server.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    // Pin the browser language: the app defaults to English regardless, and tests assert on English text.
    locale: "en-US",
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Servers start in order, so the second one reuses the build the first one made.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: "npm run build && npm start",
          url: `http://localhost:${PORT}/api/health`,
          timeout: 240_000,
          reuseExistingServer: !process.env.CI,
          env: { API_MODE: "mock", MOCK_LATENCY_MS: "100", PORT: String(PORT) },
        },
        {
          command: "npm start",
          url: `http://localhost:${NO_DATA_FLOW_PORT}/api/health`,
          timeout: 60_000,
          reuseExistingServer: !process.env.CI,
          env: { API_MODE: "mock", MOCK_LATENCY_MS: "100", PORT: String(NO_DATA_FLOW_PORT), SHOW_DATA_FLOW: "false" },
        },
      ],
});
