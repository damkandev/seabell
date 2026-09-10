import { expect, test } from "@playwright/test";

import { findLawReferences } from "../src/lib/law-references";

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
