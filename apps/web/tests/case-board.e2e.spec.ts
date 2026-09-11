import { expect, test } from "./fixtures";

test("creates a guided expediente with documents, facts and notes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Crear expediente" }).click();
  await expect(page.getByRole("heading", { name: "Crea tu expediente" })).toBeVisible();

  await page.getByRole("button", { name: "Crear expediente" }).click();
  await page.getByLabel("¿Cómo quieres llamar a este expediente?").fill("Caso de estudio");
  await page.getByRole("button", { name: "Crear expediente" }).click();
  await expect(page.locator('input[value="Caso de estudio"]')).toBeVisible();

  await page.getByRole("button", { name: "Agregar hecho" }).click();
  await page.getByPlaceholder("Ej.: Se firma el contrato").fill("Se firma el contrato");
  await page.getByLabel(/Fecha/).fill("2025-03-10");
  await page.getByPlaceholder("¿Qué ocurrió?").fill("Las partes celebraron el contrato.");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("10 de marzo de 2025")).toBeVisible();

  await page.getByRole("button", { name: "Agregar nota" }).click();
  await page.getByPlaceholder("Ej.: Revisar jurisprudencia").fill("Revisar jurisprudencia");
  await page.getByPlaceholder("Escribe tu apunte...").fill("Buscar fallos de la Corte Suprema.");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Buscar fallos de la Corte Suprema.")).toBeVisible();

  await page.getByRole("button", { name: "Agregar documentos" }).click();
  await page.locator("input[type=file]").setInputFiles([
    { name: "demanda.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
    { name: "contrato.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
  ]);
  await expect(page.getByRole("button", { name: /demanda\.pdf PDF/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /contrato\.pdf PDF/ })).toBeVisible();

  await page.getByRole("button", { name: "Ver mapa del caso" }).click();
  await expect(page.getByRole("heading", { name: "Caso de estudio" })).toBeVisible();
  await expect(page.getByText("Mapa del caso")).toBeVisible();
  await expect(page.getByRole("button", { name: "Volver al expediente" })).toBeVisible();
});
