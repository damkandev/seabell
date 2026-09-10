import { expect, test } from "@playwright/test";
import type { PDFPageProxy } from "pdfjs-dist";

import {
  computeRangeRects,
  createPageTextModel,
  selectedText,
} from "../src/lib/pdf-selection/layout";

type FixtureItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  eol?: boolean;
};

function fakePage(items: FixtureItem[]): PDFPageProxy {
  return {
    getTextContent: async () => ({
      items: items.map((item) => ({
        str: item.text,
        dir: "ltr",
        transform: [12, 0, 0, 12, item.x, item.y],
        width: item.width,
        height: 12,
        fontName: "f1",
        hasEOL: item.eol ?? true,
      })),
      styles: { f1: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: "sans-serif" } },
      lang: "es",
    }),
    getStructTree: async () => null,
    getViewport: () => ({
      width: 612,
      height: 792,
      scale: 1,
      rotation: 0,
      transform: [1, 0, 0, -1, 0, 792],
    }),
  } as unknown as PDFPageProxy;
}

test("orders two long columns vertically before moving to the next column", async () => {
  const page = fakePage([
    { text: "Primera linea extensa de la columna izquierda", x: 50, y: 740, width: 210 },
    { text: "Primera linea extensa de la columna derecha", x: 330, y: 740, width: 210 },
    { text: "Segunda linea extensa de la columna izquierda", x: 50, y: 715, width: 210 },
    { text: "Segunda linea extensa de la columna derecha", x: 330, y: 715, width: 210 },
    { text: "Tercera linea extensa de la columna izquierda", x: 50, y: 690, width: 210 },
    { text: "Tercera linea extensa de la columna derecha", x: 330, y: 690, width: 210 },
  ]);
  const model = await createPageTextModel(page, 1);

  expect(model.orderedRuns.map((run) => run.sourceIndex)).toEqual([0, 2, 4, 1, 3, 5]);
});

test("copies table cells row by row with tabs", async () => {
  const page = fakePage([
    { text: "A1", x: 50, y: 740, width: 30 },
    { text: "B1", x: 300, y: 740, width: 30 },
    { text: "A2", x: 50, y: 715, width: 30 },
    { text: "B2", x: 300, y: 715, width: 30 },
    { text: "A3", x: 50, y: 690, width: 30 },
    { text: "B3", x: 300, y: 690, width: 30 },
  ]);
  const model = await createPageTextModel(page, 1);
  const pages = new Map([[1, model]]);
  const first = model.orderedRuns[0];
  const last = model.orderedRuns.at(-1)!;

  expect(
    selectedText(
      { pageNumber: 1, runId: first.id, offset: 0 },
      { pageNumber: 1, runId: last.id, offset: last.graphemes.length },
      pages,
    ),
  ).toBe("A1\tB1\nA2\tB2\nA3\tB3");
});

test("normalizes accents and conservative line-end hyphenation", async () => {
  const page = fakePage([
    { text: "informacio\u0301n docu-", x: 50, y: 740, width: 150 },
    { text: "mentada", x: 50, y: 715, width: 70 },
  ]);
  const model = await createPageTextModel(page, 1);
  const pages = new Map([[1, model]]);
  const first = model.orderedRuns[0];
  const last = model.orderedRuns.at(-1)!;

  expect(
    selectedText(
      { pageNumber: 1, runId: first.id, offset: 0 },
      { pageNumber: 1, runId: last.id, offset: last.graphemes.length },
      pages,
    ),
  ).toBe("información documentada");
});

test("computes range rects for partial text selection", async () => {
  const page = fakePage([
    { text: "Texto de prueba para destacar", x: 50, y: 740, width: 200 },
  ]);
  const model = await createPageTextModel(page, 1);
  const run = model.orderedRuns[0];

  const rects = computeRangeRects(
    { pageNumber: 1, runId: run.id, offset: 0 },
    { pageNumber: 1, runId: run.id, offset: 5 },
    1,
    model,
  );

  expect(rects).toHaveLength(1);
  expect(rects[0].width).toBeCloseTo((run.rect.width * 5) / run.graphemes.length, 4);
  expect(rects[0].x).toBeCloseTo(run.rect.x, 4);
});

