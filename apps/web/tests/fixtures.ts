import { test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, continueTest) => {
    await page.route("**/auth/me", (route) => route.fulfill({
      json: { user: { id: "e2e-user", email: "e2e@seabell.local", createdAt: new Date().toISOString() } },
    }));
    await continueTest(page);
  },
});

export { expect } from "@playwright/test";
