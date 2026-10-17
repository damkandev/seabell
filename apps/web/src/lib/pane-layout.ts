import { createLocalId } from "@/lib/utils";

/** Panel con un documento. `size` es su peso flex dentro de la columna. */
export type Pane = { key: string; doc: string; size: number };
/** Columna de paneles apilados. `size` es su peso flex dentro del área central. */
export type Column = { key: string; size: number; panes: Pane[] };
export type PaneLayout = { cols: Column[]; focus: string | null };
export type DropZone = "left" | "right" | "top" | "bottom" | "center";

export const MAX_PANES = 6;

export const newPane = (doc: string, size = 1): Pane => ({ key: createLocalId(), doc, size });
const newColumn = (panes: Pane[], size = 1): Column => ({ key: createLocalId(), size, panes });

export function allPanes(cols: Column[]): Pane[] {
  return cols.flatMap((col) => col.panes);
}

/** Borde más cercano si el puntero está a menos de un 25 % de él; si no, el centro. */
export function zoneAt(x: number, y: number): DropZone {
  const [zone, distance] = ([["left", x], ["right", 1 - x], ["top", y], ["bottom", 1 - y]] as const)
    .reduce((best, entry) => (entry[1] < best[1] ? entry : best));
  return distance < 0.25 ? zone : "center";
}

export function withoutPane(cols: Column[], key: string): Column[] {
  return cols
    .map((col) => ({ ...col, panes: col.panes.filter((pane) => pane.key !== key) }))
    .filter((col) => col.panes.length);
}

/** Inserta `pane` junto al panel `targetKey`, partiendo a la mitad el espacio del destino. */
export function insertPane(cols: Column[], pane: Pane, targetKey: string, zone: Exclude<DropZone, "center">): Column[] {
  const ci = cols.findIndex((col) => col.panes.some((p) => p.key === targetKey));
  if (ci < 0) return cols;
  const col = cols[ci];
  if (zone === "left" || zone === "right") {
    const half = col.size / 2;
    const next = cols.map((c, i) => (i === ci ? { ...c, size: half } : c));
    next.splice(zone === "left" ? ci : ci + 1, 0, newColumn([{ ...pane, size: 1 }], half));
    return next;
  }
  const pi = col.panes.findIndex((p) => p.key === targetKey);
  const half = col.panes[pi].size / 2;
  const panes = col.panes.map((p, i) => (i === pi ? { ...p, size: half } : p));
  panes.splice(zone === "top" ? pi : pi + 1, 0, { ...pane, size: half });
  return cols.map((c, i) => (i === ci ? { ...c, panes } : c));
}

/** Mueve un panel a un borde de otro, o intercambia sus documentos si cae en el centro. */
export function movePane(cols: Column[], sourceKey: string, targetKey: string, zone: DropZone): Column[] {
  const panes = allPanes(cols);
  const source = panes.find((p) => p.key === sourceKey);
  const target = panes.find((p) => p.key === targetKey);
  if (!source || !target || source === target) return cols;
  if (zone === "center") {
    return cols.map((col) => ({
      ...col,
      panes: col.panes.map((p) => (p === source ? { ...p, doc: target.doc } : p === target ? { ...p, doc: source.doc } : p)),
    }));
  }
  return insertPane(withoutPane(cols, sourceKey), source, targetKey, zone);
}

/** Desplaza el divisor entre `sizes[i - 1]` y `sizes[i]` sin que ninguno baje de `min`. */
export function resizePair(sizes: number[], i: number, delta: number, min: number): number[] {
  const next = [...sizes];
  const pair = sizes[i - 1] + sizes[i];
  const first = Math.min(Math.max(sizes[i - 1] + delta, min), pair - min);
  next[i - 1] = first;
  next[i] = pair - first;
  return next;
}

/** Sanea un layout guardado contra los documentos existentes y abre `openDoc` si se pide. */
export function restoreLayout(saved: PaneLayout | undefined, docIds: string[], openDoc?: string): PaneLayout {
  const available = new Set(docIds);
  const cols = (saved?.cols ?? [])
    .map((col) => ({ ...col, panes: col.panes.filter((pane) => available.has(pane.doc)) }))
    .filter((col) => col.panes.length);
  const first = openDoc && available.has(openDoc) ? openDoc : docIds[0];
  if (!cols.length) return first ? openIn({ cols: [newColumn([newPane(first)])], focus: null }, first) : { cols: [], focus: null };
  const layout = { cols, focus: allPanes(cols).some((p) => p.key === saved?.focus) ? saved!.focus : allPanes(cols)[0].key };
  return openDoc && available.has(openDoc) ? openIn(layout, openDoc) : layout;
}

/** Enfoca el panel que ya muestra `doc` o lo carga en el panel enfocado. */
export function openIn(layout: PaneLayout, doc: string): PaneLayout {
  const panes = allPanes(layout.cols);
  const open = panes.find((p) => p.doc === doc);
  if (open) return { ...layout, focus: open.key };
  const focus = panes.find((p) => p.key === layout.focus) ?? panes[0];
  if (!focus) {
    const pane = newPane(doc);
    return { cols: [newColumn([pane])], focus: pane.key };
  }
  return {
    cols: layout.cols.map((col) => ({ ...col, panes: col.panes.map((p) => (p === focus ? { ...p, doc } : p)) })),
    focus: focus.key,
  };
}
