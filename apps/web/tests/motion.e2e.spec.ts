import { expect, test, type Page } from "@playwright/test";

import { createSelectionPdf } from "./helpers/pdf-fixture";

async function openPdf(page: Page) {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({ name: "motion.pdf", mimeType: "application/pdf", buffer: createSelectionPdf() });
  await expect(page.locator(".textLayer span").first()).toBeVisible();
}

const dialogAnimation = (page: Page) =>
  page.locator("dialog[open]").evaluate((dialog) => ({
    names: dialog.getAnimations().map((animation) => (animation as CSSAnimation).animationName),
    duration: getComputedStyle(dialog).animationDuration,
  }));

test("anima resaltes nuevos, el indicador de pestañas y los diálogos", async ({ page }) => {
  await openPdf(page);

  const line = page.locator(".textLayer span").filter({ hasText: "Hola mundo seleccionable" });
  const box = (await line.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.locator("[data-selection-popover]").getByRole("button", { name: "Resaltar texto" }).click();
  await expect(page.locator(".pdfHighlightFresh")).not.toHaveCount(0);
  // Al volver a dibujar (zoom) el trazo no se repite. dispatchEvent: en WebKit headless
  // el aviso de IndexedDB puede tapar la barra de zoom.
  await page.getByRole("button", { name: "Acercar" }).dispatchEvent("click");
  await expect(page.locator(".pdfHighlight")).not.toHaveCount(0);
  await expect(page.locator(".pdfHighlightFresh")).toHaveCount(0);

  const tabs = page.getByRole("tablist", { name: "Panel" });
  const indicator = () => tabs.evaluate((el) => getComputedStyle(el, "::before").translate);
  expect(await indicator()).toBe("none");
  await tabs.getByRole("tab", { name: "Fechas" }).click();
  await expect.poll(indicator).not.toBe("none");

  await page.getByRole("button", { name: "Volver a Inicio" }).click();
  await page.getByRole("button", { name: "Nuevo expediente" }).first().click();
  expect((await dialogAnimation(page)).names).toContain("sb-pop");
});

test("sin movimiento con prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Nuevo expediente" }).first().click();
  expect((await dialogAnimation(page)).duration).toBe("0s");
});
