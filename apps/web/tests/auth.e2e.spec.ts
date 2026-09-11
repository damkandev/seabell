import { expect, test } from "@playwright/test";

test("creates an account from the access screen", async ({ page }) => {
  await page.route("**/auth/me", (route) => route.fulfill({ status: 401, json: { error: "Not authenticated" } }));
  await page.route("**/auth/register", (route) => route.fulfill({
    status: 201,
    json: { user: { id: "new-user", email: "new@seabell.local", createdAt: new Date().toISOString() } },
  }));

  await page.goto("/");
  await page.getByRole("button", { name: "Crea una cuenta", exact: true }).click();
  await page.getByLabel("Email").fill("new@seabell.local");
  await page.getByLabel("Contraseña").fill("correct-horse-battery-staple");
  await page.getByLabel("Repite la contraseña").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();

  await expect(page.getByText("new@seabell.local")).toBeVisible();
  await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
});
