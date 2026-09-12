import { expect, test } from "./fixtures";

test("prepares the document for saving as PDF", async ({ page }) => {
  await page.addInitScript(() => {
    window.open = (() => ({
      document: { open() {}, write() {}, close() {} },
      focus() {},
      print() {},
      addEventListener() {},
    })) as unknown as typeof window.open;
  });
  await page.goto("/");
  await page.getByRole("menuitem", { name: "Archivo" }).click();
  await page.getByRole("menuitem", { name: "Crear documento" }).click();
  const title = page.getByLabel("Título del documento");
  await title.fill("");
  await expect(title).toHaveValue("");
  await title.fill("Acta de prueba");
  await page.getByLabel("Contenido del documento").fill("Contenido para imprimir");

  await page.getByRole("button", { name: "Guardar PDF" }).click();

  await expect(page.getByRole("status")).toContainText("Guardar como PDF");
});

test("applies justified text", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("menuitem", { name: "Archivo" }).click();
  await page.getByRole("menuitem", { name: "Crear documento" }).click();

  const editor = page.getByLabel("Contenido del documento");
  await editor.fill("Texto para comprobar la alineación justificada.");
  await page.getByRole("button", { name: "Justificar" }).click();

  await expect(editor.locator("p")).toHaveCSS("text-align", "justify");
});

test("applies a pixel font size", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("menuitem", { name: "Archivo" }).click();
  await page.getByRole("menuitem", { name: "Crear documento" }).click();

  const editor = page.getByLabel("Contenido del documento");
  await editor.fill("Texto con tamaño personalizado.");
  await editor.press("Control+A");
  await page.getByLabel("Tamaño del texto en píxeles").fill("24");

  await expect(editor.locator('font[size="7"]')).toHaveCount(0);
  await expect(editor.locator("span").first()).toHaveCSS("font-size", "24px");
});

test("creates and nests a legal list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("menuitem", { name: "Archivo" }).click();
  await page.getByRole("menuitem", { name: "Crear documento" }).click();

  const editor = page.getByLabel("Contenido del documento");
  await editor.fill("Artículo");
  await page.getByRole("button", { name: "Lista jurídica" }).click();

  await expect(editor.locator('ol[data-legal-list="true"][data-legal-level="1"]')).toHaveCount(1);
  await editor.locator("li").click();
  await editor.press("End");
  await editor.press("Enter");
  await editor.type("Numeral");
  await editor.press("Tab");

  await expect(editor.locator('ol[data-legal-level="2"] li')).toHaveText("Numeral");
});

test("normalizes legacy ordered lists and keeps independent numbering blocks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("menuitem", { name: "Archivo" }).click();
  await page.getByRole("menuitem", { name: "Crear documento" }).click();

  const editor = page.getByLabel("Contenido del documento");
  await editor.evaluate((element) => {
    element.innerHTML = "<ol><li>Uno</li><li>Dos<ol><li>Dos punto uno</li></ol></li></ol><p>Texto normal</p><ol><li>Otro uno</li></ol><ul><li>Viñeta</li></ul>";
    element.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });

  await expect(editor.locator('ol[data-legal-list="true"][data-legal-level="1"]')).toHaveCount(2);
  await expect(editor.locator('ol[data-legal-list="true"][data-legal-level="2"]')).toHaveCount(1);
  await expect(editor.locator("ul")).toHaveCount(1);
});

test("escapes an empty legal item with backspace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("menuitem", { name: "Archivo" }).click();
  await page.getByRole("menuitem", { name: "Crear documento" }).click();

  const editor = page.getByLabel("Contenido del documento");
  await editor.fill("Primera cláusula");
  await page.getByRole("button", { name: "Lista jurídica" }).click();
  await editor.locator("li").click();
  await editor.press("End");
  await editor.press("Enter");
  await editor.press("Backspace");

  await expect(editor.locator('ol[data-legal-list="true"] > li')).toHaveCount(1);
  await editor.locator('ol[data-legal-list="true"] > li').fill("");
  await editor.press("Backspace");
  await expect(editor.locator('ol[data-legal-list="true"]')).toHaveCount(0);
});
