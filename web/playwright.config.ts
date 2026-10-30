import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // The HTTP specs share one database (one open competition, the question bank); run files one at a time in CI.
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    // Local sandboxes may ship a browser build that differs from the pinned Playwright; CI installs its own.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
