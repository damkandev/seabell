import { expect, test, type Page } from "@playwright/test";

import { createSelectionPdf } from "./helpers/pdf-fixture";

async function createExpedienteWithPdfs(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Nuevo expediente" }).first().click();
  await page.getByLabel("Nombre o rol").fill("Rol C-1-2026");
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rol C-1-2026" })).toBeVisible();

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Agregar PDF", exact: true }).first().click();
  await (await chooser).setFiles([
    { name: "demanda.pdf", mimeType: "application/pdf", buffer: createSelectionPdf() },
    { name: "contestacion.pdf", mimeType: "application/pdf", buffer: createSelectionPdf() },
  ]);
  await expect(page.getByRole("region", { name: "contestacion", exact: true }).locator(".textLayer span").first()).toBeVisible();
}

test("creates, renames and collapses folders", async ({ page }) => {
  await createExpedienteWithPdfs(page);
  const tree = page.getByRole("navigation", { name: "Documentos del expediente" });

  await tree.getByRole("button", { name: "Nueva carpeta" }).click();
  const name = tree.getByRole("textbox", { name: "Nombre de la carpeta" });
  await expect(name).toBeFocused();
  await name.fill("Presentaciones");
  await name.press("Enter");

  const folder = tree.getByRole("button", { name: /Presentaciones/ });
  await expect(folder).toHaveAttribute("aria-expanded", "true");
  await expect(tree).toContainText("Arrastra documentos aquí");
  await folder.click();
  await expect(folder).toHaveAttribute("aria-expanded", "false");

  await folder.dblclick();
  await tree.getByRole("textbox", { name: "Nombre de la carpeta" }).fill("Escritos");
  await page.keyboard.press("Enter");
  await expect(tree.getByRole("button", { name: /Escritos/ })).toBeVisible();
});

test("opens documents side by side, resizes and moves panes", async ({ page }) => {
  await createExpedienteWithPdfs(page);

  await page.getByRole("button", { name: "Abrir demanda a la derecha" }).click();
  const divider = page.getByRole("separator", { name: "Redimensionar columnas" });
  await expect(divider).toHaveAttribute("aria-valuenow", "50");
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", "55");
  await divider.dblclick();
  await expect(divider).toHaveAttribute("aria-valuenow", "50");

  // Arrastrar la barra de un panel al borde inferior de otro lo apila en filas.
  const demanda = page.getByRole("region", { name: "demanda", exact: true });
  const contestacion = page.getByRole("region", { name: "contestacion", exact: true });
  const target = await contestacion.boundingBox();
  await demanda.getByTitle("Arrastra para mover el panel").dragTo(contestacion, {
    targetPosition: { x: target!.width / 2, y: target!.height - 20 },
  });
  await expect(page.getByRole("separator", { name: "Redimensionar paneles" })).toBeVisible();
  await expect(divider).toHaveCount(0);

  await demanda.getByRole("button", { name: "Cerrar panel" }).click();
  await expect(page.getByRole("region", { name: "demanda", exact: true })).toHaveCount(0);
  await expect(contestacion.getByRole("button", { name: "Cerrar panel" })).toHaveCount(0);
});

test("searches the whole expediente and groups results by document", async ({ page }) => {
  await createExpedienteWithPdfs(page);

  await page.keyboard.press("ControlOrMeta+f");
  await expect(page.getByRole("textbox", { name: "Buscar en el expediente" })).toBeFocused();
  await page.keyboard.type("mundo seleccionable");

  const panel = page.getByRole("complementary", { name: "Panel del documento" });
  await expect(panel.getByRole("region", { name: "Resultados en demanda" })).toBeVisible();
  await expect(panel.getByRole("region", { name: "Resultados en contestacion" })).toBeVisible();
  await expect(panel).toContainText("2 coincidencias");

  await panel.getByRole("region", { name: "Resultados en demanda" }).getByRole("button").first().click();
  await expect(page.getByRole("region", { name: "demanda", exact: true })).toBeVisible();

  await panel.getByRole("button", { name: "Cerrar búsqueda" }).click();
  await panel.getByRole("tab", { name: "Fechas" }).click();
  await expect(panel.getByRole("region", { name: "Fechas del documento" })).toContainText("No se encontraron fechas");
});

test("shows the opened documents on Inicio", async ({ page }) => {
  await createExpedienteWithPdfs(page);
  await page.getByRole("button", { name: "Volver a Inicio" }).click();

  await expect(page.getByRole("table", { name: "Documentos recientes" })).toContainText("contestacion.pdf");
  await expect(page.getByRole("region", { name: "Expedientes" }).first()).toContainText("Rol C-1-2026");

  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("textbox", { name: "Buscar en todo" }).fill("demanda");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "demanda", exact: true })).toBeVisible();
});
