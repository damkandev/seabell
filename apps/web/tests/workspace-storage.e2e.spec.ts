import { expect, test } from "./fixtures";

test("migrates an existing workspace database without its index", async ({ page }) => {
  await page.goto("/api/laws/test/0", { waitUntil: "commit" });
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("seabell-workspaces", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("documents", { keyPath: "id" });
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  }));

  await page.goto("/");
  await page.getByRole("button", { name: "Crear expediente" }).click();
  await page.getByPlaceholder("Ej. Sucesión García").fill("Migración");
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
