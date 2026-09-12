import { expect, test } from "@playwright/test";

import { moveNode, type ExpedienteNode } from "../src/lib/expediente";

test("moves folders and refuses cyclic moves", () => {
  const child: ExpedienteNode = { kind: "folder", id: "child", name: "Child", children: [] };
  const source: ExpedienteNode = { kind: "folder", id: "source", name: "Source", children: [child] };
  const target: ExpedienteNode = { kind: "folder", id: "target", name: "Target", children: [] };
  const tree = [source, target];

  expect(moveNode(tree, "source", "target")).toEqual([
    { ...target, children: [source] },
  ]);
  expect(moveNode(tree, "source", "child")).toBe(tree);
});
