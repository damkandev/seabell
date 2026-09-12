"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { Folder, FolderOpen, FileText, FilePlus } from "lucide-react";
import { ExpedienteState, ExpedienteNode, EXPEDIENTE_COLORS } from "@/lib/expediente";
import { ImportedPdf } from "@/lib/pdf-import";
import { clsx } from "clsx";

export type OpenPdf = ImportedPdf & { id: string };

export type FileTreeProps = {
  expedienteId: string;
  state: ExpedienteState;
  documents: OpenPdf[];
  onSelectPdf: (nodeId: string, documentId: string) => void;
  onAddPdfs: (files: File[], folderId: string | null) => void;
  onCreateFolder: (parentId: string | null, name: string) => void;
  /** Drop externo: un documento que viene de otra pestaña o fuente externa */
  onDrop: (documentId: string, folderId: string | null) => void;
  /** Movimiento interno: un nodo ya existente en el árbol se reubica */
  onMove: (nodeId: string, folderId: string | null) => void;
  /** Eliminar un nodo del árbol por su nodeId */
  onRemoveNode: (nodeId: string) => void;
  /** Renombrar un nodo del árbol */
  onRenameNode: (nodeId: string, newName: string) => void;
};

const BORDER_COLORS = {
  blue: "border-l-blue-500",
  green: "border-l-green-500",
  orange: "border-l-orange-500",
  purple: "border-l-purple-500",
  rose: "border-l-rose-500",
  teal: "border-l-teal-500",
};

const BG_COLORS = {
  blue: "bg-blue-500/10",
  green: "bg-green-500/10",
  orange: "bg-orange-500/10",
  purple: "bg-purple-500/10",
  rose: "bg-rose-500/10",
  teal: "bg-teal-500/10",
};

const TEXT_COLORS = {
  blue: "text-blue-500",
  green: "text-green-500",
  orange: "text-orange-500",
  purple: "text-purple-500",
  rose: "text-rose-500",
  teal: "text-teal-500",
};

// ---------------------------------------------------------------------------
// Menú contextual compartido
// ---------------------------------------------------------------------------
type MenuPos = { x: number; y: number };

function useContextMenu() {
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      setMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menu]);

  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return { menu, setMenu, open, menuRef };
}

interface ContextMenuProps {
  pos: MenuPos;
  menuRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

function ContextMenu({ pos, menuRef, children }: ContextMenuProps) {
  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-[11rem] rounded-md border border-border bg-popover py-1 shadow-md text-sm text-popover-foreground"
      style={{ top: pos.y, left: pos.x }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function ContextMenuItem({
  label,
  destructive,
  onClick,
}: {
  label: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={clsx(
        "flex w-full items-center px-3 py-1.5 hover:bg-muted cursor-pointer text-left select-none",
        destructive ? "text-destructive hover:text-destructive" : "text-popover-foreground"
      )}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Input de renombrado inline
// ---------------------------------------------------------------------------
function RenameInput({
  initialValue,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialValue) onCommit(trimmed);
    else onCancel();
  };

  return (
    <input
      ref={ref}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        else if (e.key === "Escape") onCancel();
      }}
      onBlur={commit}
      className="h-5 flex-1 min-w-0 bg-background border border-input rounded px-1 text-sm outline-none focus:ring-1 focus:ring-ring"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ---------------------------------------------------------------------------
// FolderNode
// ---------------------------------------------------------------------------
function FolderNode({
  node,
  state,
  level,
  documents,
  onSelectPdf,
  onAddPdfs,
  onCreateFolder,
  onDrop,
  onMove,
  onRemoveNode,
  onRenameNode,
}: {
  node: ExpedienteNode & { kind: "folder" };
  state: ExpedienteState;
  level: number;
  documents: OpenPdf[];
  onSelectPdf: (nodeId: string, documentId: string) => void;
  onAddPdfs: (files: File[], folderId: string | null) => void;
  onCreateFolder: (parentId: string | null, name: string) => void;
  onDrop: (documentId: string, folderId: string | null) => void;
  onMove: (nodeId: string, folderId: string | null) => void;
  onRemoveNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const { menu, setMenu, open: openMenu, menuRef } = useContextMenu();

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const nodeId = e.dataTransfer.getData("text/x-seabell-node-id");
    if (nodeId) { onMove(nodeId, node.id); return; }

    const documentId = e.dataTransfer.getData("text/x-seabell-document-id");
    if (documentId) { onDrop(documentId, node.id); return; }

    if (e.dataTransfer.files?.length) {
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
      );
      if (files.length) onAddPdfs(files, node.id);
    }
  };

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData("text/x-seabell-node-id", node.id);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <>
      <div className="flex flex-col">
        <div
          className={clsx(
            "flex items-center gap-2 py-1 px-2 cursor-grab active:cursor-grabbing hover:bg-muted/50 rounded-md text-sm",
            isDragOver && "bg-muted/80 ring-1 ring-ring"
          )}
          draggable={!isRenaming}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => !isRenaming && setIsOpen(!isOpen)}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onContextMenu={openMenu}
        >
          {isOpen ? (
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="size-4 shrink-0 text-muted-foreground" />
          )}
          {isRenaming ? (
            <RenameInput
              initialValue={node.name}
              onCommit={(name) => { onRenameNode(node.id, name); setIsRenaming(false); }}
              onCancel={() => setIsRenaming(false)}
            />
          ) : (
            <span className="truncate">{node.name}</span>
          )}
        </div>
        <div
          className={clsx(
            "grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none",
            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
          aria-hidden={!isOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col">
              {node.children.map((child) =>
              child.kind === "folder" ? (
                <FolderNode
                  key={child.id}
                  node={child}
                  state={state}
                  level={level + 1}
                  documents={documents}
                  onSelectPdf={onSelectPdf}
                  onAddPdfs={onAddPdfs}
                  onCreateFolder={onCreateFolder}
                  onDrop={onDrop}
                  onMove={onMove}
                  onRemoveNode={onRemoveNode}
                  onRenameNode={onRenameNode}
                />
              ) : (
                <PdfNode
                  key={child.id}
                  node={child}
                  state={state}
                  level={level + 1}
                  documents={documents}
                  onSelectPdf={onSelectPdf}
                  onRemoveNode={onRemoveNode}
                  onRenameNode={onRenameNode}
                />
              )
              )}
            </div>
          </div>
        </div>
      </div>

      {menu && (
        <ContextMenu pos={menu} menuRef={menuRef}>
          <ContextMenuItem
            label="Renombrar carpeta"
            onClick={() => { setMenu(null); setIsRenaming(true); }}
          />
          <ContextMenuItem
            label="Eliminar carpeta"
            destructive
            onClick={() => { setMenu(null); onRemoveNode(node.id); }}
          />
        </ContextMenu>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// PdfNode
// ---------------------------------------------------------------------------
function PdfNode({
  node,
  state,
  level,
  documents,
  onSelectPdf,
  onRemoveNode,
  onRenameNode,
}: {
  node: ExpedienteNode & { kind: "pdf" };
  state: ExpedienteState;
  level: number;
  documents: OpenPdf[];
  onSelectPdf: (nodeId: string, documentId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
}) {
  const isActive = state.activeNodeId === node.id;
  const isLoaded = documents.some((doc) => doc.id === node.documentId);
  const [isRenaming, setIsRenaming] = useState(false);
  const { menu, setMenu, open: openMenu, menuRef } = useContextMenu();

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData("text/x-seabell-node-id", node.id);
    e.dataTransfer.setData("text/x-seabell-document-id", node.documentId);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <>
      <div
        draggable={!isRenaming}
        className={clsx(
          "flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded-r-md text-sm border-l-2",
          isRenaming ? "cursor-default" : "cursor-grab active:cursor-grabbing",
          isActive ? clsx(BORDER_COLORS[state.color], BG_COLORS[state.color]) : "border-l-transparent"
        )}
        style={{ paddingLeft: `${level * 12 + 6}px` }}
        onClick={() => !isRenaming && onSelectPdf(node.id, node.documentId)}
        onDragStart={handleDragStart}
        onContextMenu={openMenu}
      >
        <FileText className={clsx("size-4 shrink-0", isActive ? TEXT_COLORS[state.color] : "text-muted-foreground")} />
        {isRenaming ? (
          <RenameInput
            initialValue={node.name}
            onCommit={(name) => { onRenameNode(node.id, name); setIsRenaming(false); }}
            onCancel={() => setIsRenaming(false)}
          />
        ) : (
          <span
            className={clsx("truncate", !isLoaded && "opacity-50")}
            title={!isLoaded ? "PDF no cargado en memoria" : ""}
          >
            {node.name}
          </span>
        )}
      </div>

      {menu && (
        <ContextMenu pos={menu} menuRef={menuRef}>
          <ContextMenuItem
            label="Renombrar documento"
            onClick={() => { setMenu(null); setIsRenaming(true); }}
          />
          <ContextMenuItem
            label="Eliminar documento"
            destructive
            onClick={() => { setMenu(null); onRemoveNode(node.id); }}
          />
        </ContextMenu>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// FileTree raíz
// ---------------------------------------------------------------------------
export function FileTree({
  state,
  documents,
  onSelectPdf,
  onAddPdfs,
  onCreateFolder,
  onDrop,
  onMove,
  onRemoveNode,
  onRenameNode,
}: FileTreeProps) {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { menu, setMenu, open: openMenu, menuRef } = useContextMenu();

  useEffect(() => {
    if (isCreatingFolder && folderInputRef.current) {
      folderInputRef.current.focus();
    }
  }, [isCreatingFolder]);

  const handleCreateFolderSubmit = () => {
    if (newFolderName.trim()) onCreateFolder(null, newFolderName.trim());
    setIsCreatingFolder(false);
    setNewFolderName("");
  };

  const startCreateFolder = () => {
    setMenu(null);
    setIsCreatingFolder(true);
  };

  const handleFolderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreateFolderSubmit();
    else if (e.key === "Escape") { setIsCreatingFolder(false); setNewFolderName(""); }
  };

  const handleRootDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(true);
  };

  const handleRootDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);
  };

  const handleRootDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);

    const nodeId = e.dataTransfer.getData("text/x-seabell-node-id");
    if (nodeId) { onMove(nodeId, null); return; }

    const documentId = e.dataTransfer.getData("text/x-seabell-document-id");
    if (documentId) { onDrop(documentId, null); return; }

    if (e.dataTransfer.files?.length) {
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
      );
      if (files.length) onAddPdfs(files, null);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const files = Array.from(e.target.files).filter(
        (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
      );
      if (files.length) onAddPdfs(files, null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="sb-file-tree flex flex-col h-full bg-muted/10">
      <div className="p-3 border-b border-border/50 flex items-center justify-between">
        <h2 className={clsx("font-semibold text-sm truncate flex items-center gap-2")}>
          <div className={clsx("size-2 rounded-full", EXPEDIENTE_COLORS[state.color].dot)} />
          {state.name}
        </h2>
        <div className="flex items-center gap-1">
          <button
            title="Nueva carpeta"
            className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
            onClick={startCreateFolder}
          >
            <Folder className="size-4" />
          </button>
          <button
            title="Agregar PDF"
            className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <FilePlus className="size-4" />
          </button>
        </div>
      </div>

      <div
        className={clsx("flex-1 overflow-y-auto p-2", isDragOverRoot && "bg-muted/30")}
        onContextMenu={openMenu}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >
        <div className="flex flex-col space-y-0.5">
          {state.tree.map((node) =>
            node.kind === "folder" ? (
              <FolderNode
                key={node.id}
                node={node}
                state={state}
                level={0}
                documents={documents}
                onSelectPdf={onSelectPdf}
                onAddPdfs={onAddPdfs}
                onCreateFolder={onCreateFolder}
                onDrop={onDrop}
                onMove={onMove}
                onRemoveNode={onRemoveNode}
                onRenameNode={onRenameNode}
              />
            ) : (
              <PdfNode
                key={node.id}
                node={node}
                state={state}
                level={0}
                documents={documents}
                onSelectPdf={onSelectPdf}
                onRemoveNode={onRemoveNode}
                onRenameNode={onRenameNode}
              />
            )
          )}

          {isCreatingFolder && (
            <div className="flex items-center gap-2 py-1 px-2 ml-2">
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={folderInputRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={handleFolderKeyDown}
                onBlur={handleCreateFolderSubmit}
                className="h-6 flex-1 bg-background border border-input rounded px-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                placeholder="Nombre..."
              />
            </div>
          )}

          {state.tree.length === 0 && !isCreatingFolder && (
            <div className="text-xs text-muted-foreground text-center mt-8 px-4">
              Arrastrá PDFs o carpetas aquí, o usá los botones superiores.
            </div>
          )}
        </div>
      </div>

      {menu && (
        <ContextMenu pos={menu} menuRef={menuRef}>
          <ContextMenuItem
            label="Abrir PDF"
            onClick={() => { setMenu(null); fileInputRef.current?.click(); }}
          />
          <ContextMenuItem label="Crear carpeta" onClick={startCreateFolder} />
        </ContextMenu>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={handleFileSelect}
      />
    </div>
  );
}
