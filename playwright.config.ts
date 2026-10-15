import { defineConfig } from "@playwright/test";

/**
 * E2E suite runs against a production build (`next build && next start`) with
 * `OPEN_LIBRARY_SEARCH_URL` pointed at the local mock API (e2e/mock-api.mjs),
 * so tests are fully deterministic and never hit the public Open Library API.
 *
 * Ports 3100/3200 avoid colliding with any dev server running on 3000/3001.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  timeout: 45_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node e2e/mock-api.mjs",
      url: "http://localhost:3200/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run build && npm run start",
      url: "http://localhost:3100",
      env: {
        PORT: "3100",
        OPEN_LIBRARY_SEARCH_URL: "http://localhost:3200/search.json",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
