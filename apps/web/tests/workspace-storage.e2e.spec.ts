import { expect, test } from "@playwright/test";

test("migrates an existing workspace database without its index", async ({ page }) => {
  // Una página sin la app, para preparar IndexedDB antes de que el workspace lo abra.
  await page.goto("/404.html", { waitUntil: "commit" });
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("seabell-workspaces", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("documents", { keyPath: "id" });
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  }));

  await page.goto("/");
  await page.getByRole("button", { name: "Nuevo expediente" }).first().click();
  await page.getByLabel("Nombre o rol").fill("Migración");
  await page.getByRole("button", { name: "Crear", exact: true }).click();

  await expect.poll(() => page.evaluate(() => new Promise<boolean>((resolve, reject) => {
    const request = indexedDB.open("seabell-workspaces");
    request.onsuccess = () => {
      const exists = request.result.transaction("documents", "readonly").objectStore("documents").indexNames.contains("workspaceKey");
      request.result.close();
      resolve(exists);
    };
    request.onerror = () => reject(request.error);
  }))).toBe(true);
});
