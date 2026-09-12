import { expect, test } from "@playwright/test";

import { findArticleReferences, findLawReferences } from "../src/lib/law-references";

test("finds common Chilean legal citations without duplicate references", () => {
  const references = findLawReferences(
    "Según la Ley N° 20.000 y el Decreto Ley Nº 3.500, la Ley 20.000 es aplicable.",
    4,
  );

  expect(references).toEqual(expect.arrayContaining([
    expect.objectContaining({ pageNumber: 4, type: "ley", number: "20000", label: "Ley 20.000", start: expect.any(Number), end: expect.any(Number) }),
    expect.objectContaining({ pageNumber: 4, type: "dl", number: "3500", label: "DL 3.500" }),
  ]));
});

test("captures a directly cited article and leaves unrelated laws without one", () => {
  const references = findLawReferences(
    "Conforme al art. 2° de la Ley N° 18.120 y la Ley N° 20.000.",
    1,
  );

  expect(references).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "ley", number: "18120", articleNumber: "2" }),
    expect.objectContaining({ type: "ley", number: "20000" }),
  ]));
  expect(references.find((reference) => reference.number === "20000")?.articleNumber).toBeUndefined();
});

test("supports common article citation spellings before and after a law", () => {
  const references = findLawReferences(
    "el artículo 1441 de la Ley N° 18.120; articulo N° 2 Ley N° 20.000; art. N° 3 DFL N° 1; Ley N° 3.500, en su art. 4.",
    1,
  );

  expect(references).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "ley", number: "18120", articleNumber: "1441" }),
    expect.objectContaining({ type: "ley", number: "20000", articleNumber: "2" }),
    expect.objectContaining({ type: "dfl", number: "1", articleNumber: "3" }),
    expect.objectContaining({ type: "ley", number: "3500", articleNumber: "4" }),
  ]));
});

test("detects articles cited with named codes and laws", () => {
  const references = findLawReferences(
    "El art. 1441 del Codigo Civil y el artículo 2 de la Ley Karin. Luego el art. 5 del Código Penal.",
    1,
  );

  expect(references).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "cod", number: "1855", label: "Código Civil", articleNumber: "1441", idNorma: 1973 }),
    expect.objectContaining({ type: "ley", number: "21643", label: "Ley Karin", articleNumber: "2" }),
    expect.objectContaining({ type: "cod", number: "1984", label: "Código Penal", articleNumber: "5", idNorma: 1984 }),
  ]));
});

test("does not create a law reference for a standalone article mention", () => {
  expect(findLawReferences("Es una subdivisión de los contratos, el artículo 1441.", 1)).toEqual([]);
});

test("assigns standalone article mentions to the document's only law", () => {
  const law = findLawReferences("Ley N° 18.120.", 1)[0]!;
  const references = findArticleReferences(
    "en el art. 1438 y el artículo 1460.",
    2,
    law,
  );

  expect(references).toEqual([
    expect.objectContaining({ pageNumber: 2, articleNumber: "1438", number: "18120" }),
    expect.objectContaining({ pageNumber: 2, articleNumber: "1460", number: "18120" }),
  ]);
});
