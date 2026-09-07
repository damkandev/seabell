export type ExpedienteColor = "blue" | "green" | "orange" | "purple" | "rose" | "teal";

export type ExpedienteNode =
  | { kind: "folder"; id: string; name: string; children: ExpedienteNode[] }
  | { kind: "pdf"; id: string; name: string; documentId: string };

export type ExpedienteState = {
  name: string;
  color: ExpedienteColor;
  tree: ExpedienteNode[];
  activeNodeId: string | null;
};

export const EXPEDIENTE_COLORS: Record<ExpedienteColor, { dot: string }> = {
  blue: { dot: "bg-blue-500" },
  green: { dot: "bg-green-500" },
  orange: { dot: "bg-orange-500" },
  purple: { dot: "bg-purple-500" },
  rose: { dot: "bg-rose-500" },
  teal: { dot: "bg-teal-500" },
};

export const EXPEDIENTE_COLOR_LIST: ExpedienteColor[] = [
  "blue",
  "green",
  "orange",
  "purple",
  "rose",
  "teal",
];

export function createExpedienteState(name: string, colorIndex: number): ExpedienteState {
  const color = EXPEDIENTE_COLOR_LIST[colorIndex % EXPEDIENTE_COLOR_LIST.length] || "blue";
  return {
    name,
    color,
    tree: [],
    activeNodeId: null,
  };
}

export function addFolder(tree: ExpedienteNode[], parentId: string | null, name: string): ExpedienteNode[] {
  const newFolder: ExpedienteNode = { kind: "folder", id: createLocalId(), name, children: [] };
  if (!parentId) {
    return [...tree, newFolder];
  }
  return tree.map(node => {
    if (node.kind === "folder") {
      if (node.id === parentId) {
        return { ...node, children: [...node.children, newFolder] };
      }
      return { ...node, children: addFolder(node.children, parentId, name) };
    }
    return node;
  });
}

export function addPdfNode(tree: ExpedienteNode[], parentId: string | null, newNode: ExpedienteNode): ExpedienteNode[] {
  if (!parentId) {
    return [...tree, newNode];
  }
  return tree.map(node => {
    if (node.kind === "folder") {
      if (node.id === parentId) {
        return { ...node, children: [...node.children, newNode] };
      }
      return { ...node, children: addPdfNode(node.children, parentId, newNode) };
    }
    return node;
  });
}

export function findNode(tree: ExpedienteNode[], nodeId: string): ExpedienteNode | undefined {
  for (const node of tree) {
    if (node.id === nodeId) return node;
    if (node.kind === "folder") {
      const found = findNode(node.children, nodeId);
      if (found) return found;
    }
  }
  return undefined;
}

export function collectDocumentIds(tree: ExpedienteNode[]): string[] {
  const ids: string[] = [];
  for (const node of tree) {
    if (node.kind === "pdf") {
      ids.push(node.documentId);
    } else if (node.kind === "folder") {
      ids.push(...collectDocumentIds(node.children));
    }
  }
  return ids;
}

/** Elimina un nodo del árbol por su nodeId y lo devuelve junto con el árbol modificado. */
export function removePdfNode(tree: ExpedienteNode[], nodeId: string): { tree: ExpedienteNode[]; removed: ExpedienteNode | null } {
  let removed: ExpedienteNode | null = null;
  const next = tree.reduce<ExpedienteNode[]>((acc, node) => {
    if (node.id === nodeId) {
      removed = node;
      return acc;
    }
    if (node.kind === "folder") {
      const result = removePdfNode(node.children, nodeId);
      if (result.removed) removed = result.removed;
      acc.push({ ...node, children: result.tree });
    } else {
      acc.push(node);
    }
    return acc;
  }, []);
  return { tree: next, removed };
}

/** Mueve un nodo PDF existente a una nueva carpeta destino (o a la raíz si folderId es null). */
export function movePdfNode(tree: ExpedienteNode[], nodeId: string, targetFolderId: string | null): ExpedienteNode[] {
  const { tree: treeWithout, removed } = removePdfNode(tree, nodeId);
  if (!removed) return tree;
  return addPdfNode(treeWithout, targetFolderId, removed);
}

/** Renombra un nodo (pdf o folder) por su nodeId. */
export function renameNode(tree: ExpedienteNode[], nodeId: string, newName: string): ExpedienteNode[] {
  return tree.map((node) => {
    if (node.id === nodeId) {
      return { ...node, name: newName };
    }
    if (node.kind === "folder") {
      return { ...node, children: renameNode(node.children, nodeId, newName) };
    }
    return node;
  });
}
import { createLocalId } from "@/lib/utils";
