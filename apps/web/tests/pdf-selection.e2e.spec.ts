import { expect, test } from "./fixtures";

import { createSelectionPdf } from "./helpers/pdf-fixture";

declare global {
  interface Window {
    __copiedPdfText?: string;
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.addEventListener("copy", (event) => {
      window.__copiedPdfText = event.clipboardData?.getData("text/plain") ?? "";
    });
  });
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "selection-fixture.pdf",
    mimeType: "application/pdf",
    buffer: createSelectionPdf(),
  });
  await expect(page.locator(".textLayer span").first()).toBeVisible();
  await expect(page.getByText("/ 2")).toBeVisible();
});

test("selects a range, copies it and keeps the overlay after zoom", async ({ page }) => {
  const firstLine = page.locator(".textLayer span").filter({ hasText: "Hola mundo seleccionable" });
  const secondLine = page.locator(".textLayer span").filter({ hasText: "segunda linea de prueba" });
  const firstBox = await firstLine.boundingBox();
  const secondBox = await secondLine.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();

  await page.mouse.move(firstBox!.x + 2, firstBox!.y + firstBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    secondBox!.x + secondBox!.width - 2,
    secondBox!.y + secondBox!.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();

  await expect(page.locator(".selectionHighlight")).not.toHaveCount(0);
  await page.keyboard.press("Control+C");
  await expect.poll(() => page.evaluate(() => window.__copiedPdfText)).toContain("Hola mundo seleccionable");
  await expect.poll(() => page.evaluate(() => window.__copiedPdfText)).toContain("segunda linea de prueba");

  const highlightCount = await page.locator(".selectionHighlight").count();
  await page.getByRole("button", { name: "Acercar" }).click();
  await expect(page.locator(".selectionHighlight")).toHaveCount(highlightCount);
});

test("double click selects one word", async ({ page }) => {
  const line = page.locator(".textLayer span").filter({ hasText: "Hola mundo seleccionable" });
  const box = await line.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.dblclick(box!.x + box!.width * 0.32, box!.y + box!.height / 2);
  await expect(page.locator(".selectionHighlight")).not.toHaveCount(0);
  await page.keyboard.press("Control+C");

  await expect.poll(() => page.evaluate(() => window.__copiedPdfText)).toMatch(/^(Hola|mundo|seleccionable)$/);
});

test("select all covers both pages and copies their natural text", async ({ page }) => {
  await page.getByLabel("Documento PDF").focus();
  await page.keyboard.press("Control+A");
  await expect.poll(() => page.locator(".selectionHighlight").count()).toBeGreaterThan(0);
  await page.keyboard.press("Control+C");

  await expect.poll(() => page.evaluate(() => window.__copiedPdfText ?? "")).toContain("Hola mundo seleccionable");
  const copied = await page.evaluate(() => window.__copiedPdfText ?? "");
  expect(copied).toContain("Texto de la segunda pagina");
});

test("shows popover on selection and copies text with popover button", async ({ page }) => {
  const firstLine = page.locator(".textLayer span").filter({ hasText: "Hola mundo seleccionable" });
  const box = await firstLine.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width - 2, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();

  const popover = page.locator("[data-selection-popover]");
  await expect(popover).toBeVisible();

  const copyButton = popover.getByRole("button", { name: "Copiar texto" });
  await expect(copyButton).toBeVisible();

  await copyButton.click();
  await expect(copyButton).toContainText("¡Copiado!");
  await expect.poll(() => page.evaluate(() => window.__copiedPdfText)).toContain("Hola mundo seleccionable");
});

test("shows popover on selection and creates a persistent highlight", async ({ page }) => {
  const line = page.locator(".textLayer span").filter({ hasText: "Hola mundo seleccionable" });
  const box = await line.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width - 2, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();

  const popover = page.locator("[data-selection-popover]");
  await expect(popover).toBeVisible();

  await popover.getByRole("button", { name: "Destacar texto" }).click();
  await expect(popover).not.toBeVisible();
  await expect(page.locator(".selectionHighlight")).toHaveCount(0);
  await expect(page.locator(".pdfHighlight")).not.toHaveCount(0);

  const highlightCount = await page.locator(".pdfHighlight").count();
  await page.getByRole("button", { name: "Acercar" }).click();
  await expect(page.locator(".pdfHighlight")).toHaveCount(highlightCount);
});

test("clicking an existing highlight allows removing it", async ({ page }) => {
  const line = page.locator(".textLayer span").filter({ hasText: "Hola mundo seleccionable" });
  const box = await line.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width - 2, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();

  await page.locator("[data-selection-popover]").getByRole("button", { name: "Destacar texto" }).click();
  await expect(page.locator(".pdfHighlight")).not.toHaveCount(0);

  const highlight = page.locator(".pdfHighlight").first();
  const hlBox = await highlight.boundingBox();
  expect(hlBox).not.toBeNull();
  await page.mouse.click(hlBox!.x + hlBox!.width / 2, hlBox!.y + hlBox!.height / 2);

  const highlightPopover = page.locator("[data-highlight-popover]");
  await expect(highlightPopover).toBeVisible();

  await highlightPopover.getByRole("button", { name: "Eliminar destacado" }).click();
  await expect(page.locator(".pdfHighlight")).toHaveCount(0);
});

test("lists persistent highlights in a side panel and removes them", async ({ page }) => {
  const line = page.locator(".textLayer span").filter({ hasText: "Hola mundo seleccionable" });
  const box = await line.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width - 2, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.locator("[data-selection-popover]").getByRole("button", { name: "Destacar texto" }).click();

  await page.getByRole("button", { name: "Ver destacados" }).click();
  const panel = page.getByLabel("Destacados del documento");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Hola mundo seleccionable");
  await expect(panel).toContainText("Página 1");

  await panel.getByRole("button", { name: "Eliminar destacado" }).click();
  await expect(page.locator(".pdfHighlight")).toHaveCount(0);
  await expect(panel).toContainText("Aún no hay destacados");
});

test("detects a cited law and opens it in the legal panel", async ({ page }) => {
  await page.route("**/api/laws/ley/20000", (route) => route.fulfill({
    json: {
      kind: "law",
      sourceUrl: "https://www.leychile.cl/Navegar?idNorma=235507",
      law: {
        titulo: "ESTABLECE NORMAS SOBRE COMPARECENCIA",
        organismo: "MINISTERIO DE JUSTICIA",
        fecha_publicacion: "1982-05-18",
        articles: [
          { label: "__preamble__", body: "La Junta de Gobierno de la República de Chile\nha dado su aprobación al siguiente:" },
          { label: "articulo 1", body: "La primera presentación de cada parte o interesado.\n\n## Título I\n\n> **Nota.** Esta modificación ha sido incorporada al presente texto actualizado." },
          { label: "articulo 2", body: "La comparecencia podrá efectuarse en la forma establecida por esta ley." },
          { label: "articulo 1438", body: "El contrato es una convención por la cual una parte se obliga para con otra." },
          { label: "articulo 1460", body: "Toda declaración de voluntad debe tener un objeto lícito." },
        ],
      },
    },
  }));
  await page.route("**/api/laws/ley/30000", (route) => route.fulfill({
    json: {
      kind: "law",
      sourceUrl: "https://www.leychile.cl/Navegar?idNorma=30000",
      law: {
        titulo: "OTRA NORMA DE PRUEBA",
        organismo: "MINISTERIO DE JUSTICIA",
        fecha_publicacion: "2020-01-01",
        articles: [
          { label: "articulo 1438", body: "El artículo 1438 de la norma anterior." },
          { label: "articulo 1460", body: "El artículo 1460 de la norma anterior." },
        ],
      },
    },
  }));
  await page.route("**/api/laws/cod/1855**", (route) => route.fulfill({
    json: {
      kind: "law",
      sourceUrl: "https://www.leychile.cl/Navegar?idNorma=1973",
      law: {
        titulo: "CÓDIGO CIVIL",
        organismo: "MINISTERIO DE JUSTICIA",
        fecha_publicacion: "1855-12-14",
        articles: [{ label: "articulo 1441", body: "El contrato es una convención." }],
      },
    },
  }));
  const lawLink = page.getByRole("button", { name: "Consultar Ley 20.000" });
  await expect(lawLink.first()).toBeVisible();
  await lawLink.first().click();
  const panel = page.getByLabel("Leyes citadas en el documento");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Artículo 1");
  const targetArticle = panel.locator('[data-law-article="2"]');
  await expect(targetArticle).toHaveClass(/ring-2/);
  await expect.poll(() => targetArticle.evaluate((element) => {
    const panel = element.closest("[aria-label='Leyes citadas en el documento']");
    if (!panel) return false;
    const target = element.getBoundingClientRect();
    const bounds = panel.getBoundingClientRect();
    return target.top >= bounds.top && target.bottom <= bounds.bottom;
  })).toBe(true);
  await expect(panel.locator("h5")).toHaveText("Título I");
  await expect(panel.locator("strong")).toHaveText("Nota.");
  await expect(panel).not.toContainText("## Título I");
  await expect(panel).not.toContainText("> **");
  await expect(panel).not.toContainText("__preamble__");

  await panel.getByRole("button", { name: "Volver a las leyes citadas" }).click();
  const codeLink = page.getByRole("button", { name: "Consultar Código Civil" });
  await expect(codeLink).toBeVisible();
  await codeLink.click();
  await expect(page.getByLabel("Leyes citadas en el documento").locator('[data-law-article="1441"]')).toHaveClass(/ring-2/);
  await page.getByLabel("Leyes citadas en el documento").getByRole("button", { name: "Volver a las leyes citadas" }).click();
  const lawLinks = page.getByRole("button", { name: "Consultar Ley 30.000" });
  await expect(lawLinks).toHaveCount(3);
  await lawLinks.nth(1).click();
  await expect(page.getByLabel("Leyes citadas en el documento").locator('[data-law-article="1438"]')).toHaveClass(/ring-2/);
});
