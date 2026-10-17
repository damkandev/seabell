import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "retain-on-failure",
  },
  webServer: {
    // El export estático se sirve tal cual lo empaqueta Tauri.
    command: "pnpm build && python3 -m http.server 3200 --bind 127.0.0.1 --directory out",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: false,
    timeout: 240_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /.*\.unit\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testIgnore: /.*\.unit\.spec\.ts/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testIgnore: /.*\.unit\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
