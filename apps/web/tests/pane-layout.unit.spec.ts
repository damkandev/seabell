import { expect, test } from "@playwright/test";

import { allPanes, insertPane, movePane, newPane, resizePair, restoreLayout, withoutPane, zoneAt, type Column } from "../src/lib/pane-layout";

const layout = (): Column[] => {
  const a = { key: "a", doc: "A", size: 1 };
  const b = { key: "b", doc: "B", size: 1 };
  const c = { key: "c", doc: "C", size: 1 };
  return [{ key: "c1", size: 1, panes: [a] }, { key: "c2", size: 1, panes: [b, c] }];
};

test("picks the nearest edge within 25 % and the centre otherwise", () => {
  expect(zoneAt(0.1, 0.5)).toBe("left");
  expect(zoneAt(0.5, 0.9)).toBe("bottom");
  expect(zoneAt(0.5, 0.5)).toBe("center");
});

test("splits columns and rows by halving the target", () => {
  const right = insertPane(layout(), newPane("D"), "a", "right");
  expect(right.map((col) => col.size)).toEqual([0.5, 0.5, 1]);
  expect(right[1].panes[0].doc).toBe("D");

  const below = insertPane(layout(), newPane("D"), "b", "bottom");
  expect(below[1].panes.map((p) => [p.doc, p.size])).toEqual([["B", 0.5], ["D", 0.5], ["C", 1]]);
});

test("moves panes to an edge and swaps documents in the centre", () => {
  const moved = movePane(layout(), "c", "a", "left");
  expect(moved.map((col) => col.panes.map((p) => p.doc))).toEqual([["C"], ["A"], ["B"]]);

  const swapped = movePane(layout(), "a", "c", "center");
  expect(allPanes(swapped).map((p) => p.doc)).toEqual(["C", "B", "A"]);
  expect(movePane(layout(), "a", "a", "left")).toEqual(layout());
});

test("drops empty columns when a pane closes", () => {
  expect(withoutPane(layout(), "a").map((col) => col.key)).toEqual(["c2"]);
});

test("closing a pane gives its space back to the rest", () => {
  // Los pesos son flex-grow: si suman menos que la cantidad de elementos queda un hueco.
  const fills = (sizes: number[]) => expect(sizes.reduce((sum, n) => sum + n, 0)).toBeCloseTo(sizes.length, 5);
  const split = insertPane(insertPane(layout(), newPane("D"), "a", "right"), newPane("E"), "b", "bottom");
  const closed = withoutPane(withoutPane(split, "a"), "b");
  fills(closed.map((col) => col.size));
  closed.forEach((col) => fills(col.panes.map((p) => p.size)));

  // Dividir un único panel deja dos columnas de 0,5; al cerrar una, la otra vuelve a 1.
  const halves = insertPane([{ key: "c1", size: 1, panes: [{ key: "a", doc: "A", size: 1 }] }], newPane("D"), "a", "right");
  expect(withoutPane(halves, "a")[0].size).toBe(1);
  expect(restoreLayout({ cols: halves, focus: "a" }, ["D"]).cols[0].size).toBe(1);
});

test("resizes a pair without crossing the minimum", () => {
  expect(resizePair([1, 1, 1], 1, 0.5, 0.2)).toEqual([1.5, 0.5, 1]);
  expect(resizePair([1, 1], 1, 5, 0.2)).toEqual([1.8, 0.2].map((n) => expect.closeTo(n, 5)));
});

test("restores a saved layout against the documents that still exist", () => {
  const restored = restoreLayout({ cols: layout(), focus: "c" }, ["A", "B"], "B");
  expect(allPanes(restored.cols).map((p) => p.doc)).toEqual(["A", "B"]);
  expect(restored.focus).toBe("b");

  const fresh = restoreLayout(undefined, ["A", "B"]);
  expect(allPanes(fresh.cols).map((p) => p.doc)).toEqual(["A"]);
  expect(fresh.focus).toBe(allPanes(fresh.cols)[0].key);
  expect(restoreLayout(undefined, []).cols).toEqual([]);
});
