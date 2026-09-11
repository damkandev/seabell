"use client";

import { ExpedienteState, ExpedienteNode, findNode, addFolder, removePdfNode, renameNode } from "@/lib/expediente";
import { FileTree, OpenPdf } from "./file-tree";
import { PdfViewer, type PdfViewState } from "./pdf-viewer";

import type { ExpedienteTab } from "./pdf-importer";

export type ExpedienteViewProps = {
  tab: ExpedienteTab;
  state: ExpedienteState;
  documents: OpenPdf[];
  onStateChange: (state: ExpedienteState) => void;
  onAddPdfs: (files: File[], folderId: string | null) => void;
  onDropDocumentFromTab: (documentId: string, folderId: string | null) => void;
  onMoveNode: (nodeId: string, folderId: string | null) => void;
  onRemoveNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
  pdfViewStates: Record<string, PdfViewState>;
  onPdfViewStateChange: (documentId: string, state: PdfViewState) => void;
};

export function ExpedienteView({
  tab,
  state,
  documents,
  onStateChange,
  onAddPdfs,
  onDropDocumentFromTab,
  onMoveNode,
  onRemoveNode,
  onRenameNode,
  pdfViewStates,
  onPdfViewStateChange,
}: ExpedienteViewProps) {
  const activePdf = state.activeNodeId
    ? (findNode(state.tree, state.activeNodeId as string)?.kind === "pdf"
        ? documents.find(
            (d) =>
              d.id ===
              (
                findNode(state.tree, state.activeNodeId as string) as Extract<
                  ExpedienteNode,
                  { kind: "pdf" }
                >
              ).documentId
          )
        : null)
    : null;

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="w-64 shrink-0 border-r border-border/70 flex flex-col h-full bg-background">
        <FileTree
          expedienteId={tab.id}
          state={state}
          documents={documents}
          onSelectPdf={(nodeId) => {
            onStateChange({ ...state, activeNodeId: nodeId });
          }}
          onAddPdfs={onAddPdfs}
          onCreateFolder={(parentId, name) => {
            onStateChange({ ...state, tree: addFolder(state.tree, parentId, name) });
          }}
          onDrop={onDropDocumentFromTab}
          onMove={onMoveNode}
          onRemoveNode={(nodeId) => {
            const { tree: newTree } = removePdfNode(state.tree, nodeId);
            const newActive = state.activeNodeId && findNode(newTree, state.activeNodeId) ? state.activeNodeId : null;
            onStateChange({ ...state, tree: newTree, activeNodeId: newActive });
            onRemoveNode?.(nodeId);
          }}
          onRenameNode={(nodeId, newName) => {
            const newTree = renameNode(state.tree, nodeId, newName);
            onStateChange({ ...state, tree: newTree });
            onRenameNode?.(nodeId, newName);
          }}
        />
      </div>
      <div className="flex-1 min-w-0 h-full relative">
        {activePdf ? (
          <PdfViewer
            key={activePdf.id}
            importedPdf={activePdf}
            initialState={pdfViewStates[activePdf.id]}
            onStateChange={(viewState) => onPdfViewStateChange(activePdf.id, viewState)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
            Seleccioná un PDF del árbol para comenzar.
          </div>
        )}
      </div>
    </div>
  );
}
